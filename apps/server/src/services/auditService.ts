import { db } from '../db';
import { auditLogs } from '@laburauto/shared/schema';
import { Request } from 'express';

export class AuditService {
  /**
   * Records an audit log entry.
   * 
   * @param userId The ID of the user performing the action (or null for system/anonymous)
   * @param action The action performed (e.g., 'contract.signed')
   * @param entityType The type of entity affected (e.g., 'contract_instance')
   * @param entityId The ID of the entity
   * @param details Additional details/snapshot of changes
   * @param req Express Request object to extract metadata (IP, UA)
   */
  static async log(
    userId: number | null,
    action: string,
    entityType: string,
    entityId: number,
    details: Record<string, any> = {},
    req?: Request
  ) {
    try {
      const metadata = {
        ip: req?.ip || req?.socket?.remoteAddress || 'unknown',
        userAgent: req?.headers['user-agent'] || 'unknown',
        timestamp: new Date().toISOString(),
      };

      await db.insert(auditLogs).values({
        userId,
        action,
        entityType,
        entityId,
        details,
        metadata,
      });

      console.log(`[AUDIT] ${action} on ${entityType}:${entityId} by user:${userId}`);
    } catch (error) {
      // Audit logging should essentially never fail the main request, but we must log the error
      console.error('Failed to write audit log:', error);
    }
  }
}
