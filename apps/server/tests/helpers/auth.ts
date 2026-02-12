import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

/**
 * Generates a JWT token for testing purposes
 */
export function generateTestToken(userId: number, role: string | null = null) {
  return jwt.sign({ id: userId, role }, JWT_SECRET, { expiresIn: '1h' });
}

/**
 * Returns an Authorization header object with a valid test token
 */
export function getAuthHeader(userId: number, role: string | null = null) {
  const token = generateTestToken(userId, role);
  return { 'Authorization': `Bearer ${token}` };
}
