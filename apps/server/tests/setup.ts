
import { vi } from 'vitest';

// Set up environment variables for testing
process.env.BYTESCALE_ACCOUNT_ID = 'test_account_id';
process.env.BYTESCALE_API_KEY = 'test_api_key';
process.env.BYTESCALE_SECRET_KEY = 'test_secret_key';
process.env.BYTESCALE_API_KEY_ID = 'test_key_id';
process.env.DLOCAL_PLAN_TOKEN = 'test_plan_token';
process.env.DLOCAL_API_KEY = 'test_dlocal_key';
process.env.DLOCAL_SECRET_KEY = 'test_dlocal_secret';
process.env.JWT_SECRET = 'test_jwt_secret';
process.env.OPENROUTER_API_KEY = 'test_openrouter_key';

// Global mocks
vi.mock('../src/services/bytescale', () => ({
  uploadBuffer: vi.fn(async () => 'https://example.com/mock-file.pdf'),
  uploadFile: vi.fn(async () => 'https://example.com/mock-file.jpg'),
  uploadMultipleFiles: vi.fn(async () => ['https://example.com/mock-1.jpg']),
  getSignedUrl: vi.fn((path: string) => `https://upcdn.io/test/raw${path}`),
}));

export const mockSentEmails: any[] = [];

vi.mock('../src/services/emailService', () => ({
  mockSentEmails,
  EmailService: {
    sendFinalContract: vi.fn(async (data: any) => {
      const html = `Contract signed. Tracking: /api/contracts/instances/${data.contractId}/track/publisher?email=${data.publisherEmail}`;
      mockSentEmails.push({
        to: [data.publisherEmail, data.renterEmail],
        subject: 'Signed Contract',
        html,
        hasAttachment: !!data.pdfBuffer
      });
    }),
    sendSigningInvitation: vi.fn(async (data: any) => {
      const html = `Signing invitation. Tracking: /api/contracts/instances/${data.contractId}/track/${data.role}?email=${data.email}`;
      mockSentEmails.push({ to: [data.email], subject: 'Signing Invitation', html });
    }),

    sendWaitlistConfirmation: vi.fn(async (data: any) => {
      mockSentEmails.push({ to: [data.email], subject: 'Waitlist', html: 'mock-html' });
    }),
    sendWelcomeEmail: vi.fn(async (data: any) => {
      mockSentEmails.push({ to: [data.email], subject: 'Welcome', html: 'mock-html' });
    }),

  }
}));


vi.mock('../src/services/magicLinkService', () => ({
  MagicLinkService: {
    createLink: vi.fn(async () => 'https://example.com/magic-link'),
    verifyLink: vi.fn(async () => ({ userId: 1, redirectTo: '/' })),
  }
}));

vi.mock('../src/services/pdfService', () => ({
  PdfService: {
    compilePdf: vi.fn(async () => Buffer.from('mock-pdf-content')),
  }
}));

vi.mock('@bytescale/sdk', () => ({
  UploadManager: vi.fn(),
}));

