import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { users } from '@laburauto/shared/schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: string | null;
      };
    }
  }
}

/**
 * Layer 1: Verify JWT and attach user to request
 * Returns 401 if no valid token present
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role?: string };

      // Attach user info to request
      req.user = {
        id: decoded.id,
        role: decoded.role || null
      };

      next();
    } catch (jwtError) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Layer 2: Check if user has one of the required roles
 * Must be used after requireAuth
 * Returns 403 if role not allowed
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!req.user.role) {
      return res.status(403).json({ error: 'User role not set. Complete onboarding first.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}`
      });
    }

    next();
  };
};

/**
 * Layer 3: Check resource ownership
 * Takes a function that extracts owner ID from the request/database
 * Returns 403 if authenticated user is not the owner
 * 
 * @param getOwnerId - Function that returns the owner ID of the resource
 */
export const requireOwnership = (
  getOwnerId: (req: Request) => Promise<number | null>
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const ownerId = await getOwnerId(req);

      if (ownerId === null) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      if (ownerId !== req.user.id) {
        // Allow admins to access any resource
        if (req.user.role === 'admin') {
          return next();
        }
        return res.status(403).json({ error: 'Access denied. You do not own this resource.' });
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};

/**
 * Combined middleware: require auth + specific roles
 * Convenience function for common pattern
 */
export const requireAdminAuth = [requireAuth, requireRole('admin')];
export const requirePublisherAuth = [requireAuth, requireRole('publisher')];
export const requireDriverAuth = [requireAuth, requireRole('driver')];

/**
 * Optional auth - attaches user if token present but doesn't require it
 * Useful for routes that work differently for authenticated vs anonymous users
 */
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No token, continue without user
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role?: string };
      req.user = {
        id: decoded.id,
        role: decoded.role || null
      };
    } catch {
      // Invalid token, continue without user
    }

    next();
  } catch (error) {
    next();
  }
};
