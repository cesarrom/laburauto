import crypto from 'crypto';

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
