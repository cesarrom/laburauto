import { db } from '../db';
import { magicLinks } from '@laburauto/shared/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import crypto from 'crypto';
import { AuditService } from './auditService';
import { Request } from 'express';

const SIGN_EXPIRATION_MINUTES = 15;
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export class MagicLinkService {
  /**
   * Generates a single-use magic link for a user.
   */
  static async createLink(userId: number, redirectPath: string, req?: Request): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + SIGN_EXPIRATION_MINUTES);

    await db.insert(magicLinks).values({
      userId,
      token,
      expiresAt,
      redirectPath,
    });

    await AuditService.log(
      userId,
      'auth.magic_link_generated',
      'user',
      userId,
      { redirectPath, expiresAt },
      req
    );

    return `${FRONTEND_URL}/magic-login?token=${token}`;
  }

  /**
   * Verifies a magic token and marks it as used.
   * Returns the link record if valid.
   */
  static async verifyAndConsume(token: string, req?: Request) {
    const now = new Date();
    const [link] = await db.select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.token, token),
          gt(magicLinks.expiresAt, now),
          isNull(magicLinks.usedAt)
        )
      );

    if (!link) {
      throw new Error('Invalid, expired, or already used magic link');
    }

    // Mark as used
    await db.update(magicLinks)
      .set({ usedAt: now })
      .where(eq(magicLinks.id, link.id));

    await AuditService.log(
      link.userId,
      'auth.magic_link_consumed',
      'user',
      link.userId,
      { redirectPath: link.redirectPath },
      req
    );

    return link;
  }
}
