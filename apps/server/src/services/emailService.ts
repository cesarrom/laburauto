import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_mock_key');
export let mockSentEmails: any[] = [];

export class EmailService {
  static async sendFinalContract({
    publisherEmail,
    renterEmail,
    adminEmails,
    pdfUrl,
    pdfBuffer,
    contractId,
    bookingId,
  }: {
    publisherEmail: string;
    renterEmail?: string;
    adminEmails: string[];
    pdfUrl: string;
    pdfBuffer?: Buffer;
    contractId: number;
    bookingId?: number;
  }) {
    const sender = process.env.RESEND_SENDER || 'onboarding@resend.dev';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const subject = bookingId
      ? `Signed Contract - Booking #${bookingId}`
      : `Signed Contract - #${contractId}`;

    const html = (role: string, email: string) => `
      <h1>Contract Fully Signed</h1>
      <p>The contract has been fully signed by all parties. Find the attached document in this email.</p>
      <p>You can also download it here: <a href="${pdfUrl}">View Contract</a></p>
      <br />
      <p>Best regards,<br />Laburauto Team</p>
      <img src="${baseUrl}/api/contracts/instances/${contractId}/track/${role}?email=${encodeURIComponent(email)}" width="1" height="1" style="display:none" />
    `;

    const recipients = [
      { email: publisherEmail!, html: html('publisher', publisherEmail!) },
      { email: renterEmail!, html: html('renter', renterEmail!) },
      ...adminEmails.map((email) => ({ email, html: html('admin', email) }))
    ].filter(({ email }) => email);

    if (process.env.NODE_ENV === 'test') {
      mockSentEmails.push({ to: recipients.map(({ email }) => email), subject, html: html('publisher', publisherEmail!), hasAttachment: !!pdfBuffer });
      return { success: true };
    }

    try {
      const attachments = pdfBuffer ? [
        {
          filename: `contract_${contractId}.pdf`,
          content: pdfBuffer,
        }
      ] : [];

      for (const recipient of recipients) {
        const { error } = await resend.emails.send({
          from: `Laburauto <${sender}>`,
          to: recipient.email,
          subject,
          html: recipient.html,
          attachments,
        });

        if (error) {
          console.error('Resend Error:', error);
          return { success: false, error };
        }
      }

      return { success: true };
    } catch (err) {
      console.error('Email Service Error:', err);
      return { success: false, error: err };
    }
  }

  static async sendSigningInvitation({
    email,
    magicLink,
    role,
    contractId,
    bookingId,
  }: {
    email: string;
    magicLink: string;
    role: string;
    contractId: number;
    bookingId?: number;
  }) {
    const sender = process.env.RESEND_SENDER || 'onboarding@resend.dev';
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

    const subject = bookingId
      ? `Action Required: Sign Contract for Booking #${bookingId}`
      : `Action Required: Sign Enrollment Contract`;

    const html = `
      <h1>Action Required: Review and Sign</h1>
      <p>A contract is ready for your signature.</p>
      <p>Please click the link below to securely review and sign the document. This link is single-use and will expire in 15 minutes.</p>
      <div style="margin: 20px 0;">
        <a href="${magicLink}" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">
          Review and Sign Contract
        </a>
      </div>
      <p>If the button doesn't work, copy and paste this URL into your browser:</p>
      <p>${magicLink}</p>
      <br />
      <p>Best regards,<br />Laburauto Team</p>
      <img src="${baseUrl}/api/contracts/instances/${contractId}/track/${role}?email=${encodeURIComponent(email)}" width="1" height="1" style="display:none" />
    `;

    if (process.env.NODE_ENV === 'test') {
      mockSentEmails.push({ to: [email], subject, html });
      return { success: true };
    }

    try {
      const { error } = await resend.emails.send({
        from: `Laburauto <${sender}>`,
        to: email,
        subject,
        html,
      });

      if (error) {
        console.error('Resend Error:', error);
        return { success: false, error };
      }

      return { success: true };
    } catch (err) {
      console.error('Email Service Error:', err);
      return { success: false, error: err };
    }
  }
}
