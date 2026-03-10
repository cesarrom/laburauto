import crypto from 'crypto';

type DocusealApiTemplate = {
  id: string | number;
  slug?: string;
  name: string;
  folder_name?: string;
  external_id?: string;
  preview_image_url?: string;
  documents?: Array<{ preview_image_url?: string } & Record<string, any>>;
  schema?: Array<Record<string, any>>;
  fields?: Array<Record<string, any>>;
  submitters?: Array<Record<string, any>>;
  created_at?: string;
  updated_at?: string;
};

interface DocusealSubmitter {
  email: string;
  role: 'publisher' | 'renter';
  name?: string;
}

interface CreateSubmissionInput {
  templateId: string | number;
  contractInstanceId: number;
  submitters: DocusealSubmitter[];
}

export class DocusealService {
  static isEnabled(): boolean {
    return process.env.DOCUSEAL_ENABLED === 'true';
  }

  static getInternalUrl(): string {
    return process.env.DOCUSEAL_INTERNAL_URL || 'http://localhost:3001';
  }

  static getApiKey(): string | null {
    return process.env.DOCUSEAL_API_KEY || null;
  }

  static hasApiAccess(): boolean {
    return this.isEnabled() && !!this.getApiKey();
  }

  static getPublicUrl(): string {
    return process.env.DOCUSEAL_PUBLIC_URL || this.getInternalUrl();
  }

  static getTemplateNameRegex(): RegExp | null {
    const pattern = process.env.DOCUSEAL_TEMPLATE_NAME_REGEX;
    if (!pattern) return null;

    const regexFromDelimited = () => {
      if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
        const lastSlash = pattern.lastIndexOf('/');
        const body = pattern.slice(1, lastSlash);
        const flags = pattern.slice(lastSlash + 1);
        return new RegExp(body, flags);
      }
      return null;
    };

    try {
      const explicit = regexFromDelimited();
      if (explicit) return explicit;

      const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const globToRegex = escaped.replace(/\\\*/g, '.*');
      return new RegExp(`^${globToRegex}$`, 'i');
    } catch {
      return null;
    }
  }

  static buildTemplateUrl(templateId: string | number): string {
    const base = this.getPublicUrl().replace(/\/$/, '');
    return `${base}/templates/${templateId}`;
  }

  static getWebhookSecret(): string | null {
    return process.env.DOCUSEAL_WEBHOOK_SECRET || null;
  }

  static verifyWebhookSecret(secretCandidate?: string | null): boolean {
    const secret = this.getWebhookSecret();
    if (!secret) return false;
    if (!secretCandidate) return false;

    const expected = Buffer.from(secret);
    const actual = Buffer.from(secretCandidate);
    if (expected.length !== actual.length) return false;

    return crypto.timingSafeEqual(expected, actual);
  }

  private static async fetchTemplatesPage(after?: number | null): Promise<{ data: DocusealApiTemplate[]; pagination?: { next?: number | null } }> {
    if (!this.hasApiAccess()) {
      throw new Error('Docuseal API access is not configured');
    }

    const url = new URL('/api/templates', this.getInternalUrl());
    url.searchParams.set('limit', '100');
    if (after) {
      url.searchParams.set('after', String(after));
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Docuseal listTemplates failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  static async listTemplates(): Promise<DocusealApiTemplate[]> {
    const templates: DocusealApiTemplate[] = [];
    let after: number | null = null;

    do {
      const page = await this.fetchTemplatesPage(after);
      if (Array.isArray(page?.data)) {
        templates.push(...page.data);
      }
      after = page?.pagination?.next ?? null;
    } while (after);

    return templates;
  }

  static async createSubmission(input: CreateSubmissionInput): Promise<any> {
    if (!this.hasApiAccess()) {
      throw new Error('Docuseal API access is not configured');
    }

    const payload = {
      template_id: input.templateId,
      send_email: false,
      external_id: `contract-instance-${input.contractInstanceId}`,
      submitters: input.submitters.map((s) => ({
        email: s.email,
        role: s.role,
        name: s.name || undefined,
      })),
    };

    const response = await fetch(`${this.getInternalUrl()}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.getApiKey()}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Docuseal createSubmission failed (${response.status}): ${body}`);
    }

    return response.json();
  }

  static extractRoleUrlsFromSubmissionResponse(response: any): Record<string, string> {
    const urlsByRole: Record<string, string> = {};
    const submitters = response?.submitters || response?.data?.submitters || [];

    if (!Array.isArray(submitters)) return urlsByRole;

    for (const submitter of submitters) {
      const role = submitter?.role;
      const url = submitter?.url || submitter?.link || submitter?.embed_src || submitter?.submission_url;
      if (role && typeof url === 'string' && url.length > 0) {
        urlsByRole[role] = url;
      }
    }

    return urlsByRole;
  }
}
