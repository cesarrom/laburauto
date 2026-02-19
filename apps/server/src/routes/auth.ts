import { Router } from 'express';
import { db } from '../db';
import { users, contractTemplates, contractInstances } from '../../db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { AuditService } from '../services/auditService';
import { MagicLinkService } from '../services/magicLinkService';
import { EmailService } from '../services/emailService';
import { validateRequest } from '../middleware/validate';
import { registerSchema, loginSchema, completeOnboardingSchema } from '@laburauto/shared/zod';
import { VariableContext } from '../services/contractVariableService';
import { uploadBuffer } from '../services/bytescale';
import { PdfService } from '../services/pdfService';
import { ContractVariableService } from '../services/contractVariableService';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const AUTHENTIK_ENABLED = process.env.AUTHENTIK_ENABLED === 'true';
const AUTHENTIK_ISSUER = process.env.AUTHENTIK_ISSUER || '';
const AUTHENTIK_CLIENT_ID = process.env.AUTHENTIK_CLIENT_ID || '';
const AUTHENTIK_CLIENT_SECRET = process.env.AUTHENTIK_CLIENT_SECRET || '';
const AUTHENTIK_REDIRECT_URI = process.env.AUTHENTIK_REDIRECT_URI || '';
const AUTHENTIK_SCOPES = process.env.AUTHENTIK_SCOPES || 'openid profile email groups';
const AUTHENTIK_ADMIN_GROUP = process.env.AUTHENTIK_ADMIN_GROUP || '';
const AUTHENTIK_REQUIRED_DOMAIN = process.env.AUTHENTIK_REQUIRED_DOMAIN || '';
const AUTH_SSO_STATE_SECRET = process.env.AUTH_SSO_STATE_SECRET || 'change-me-state-secret';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';
const SSO_STATE_TTL_MS = 10 * 60 * 1000;
const SSO_CODE_TTL_MS = 2 * 60 * 1000;

const ssoStates = new Map<string, { nonce: string; createdAt: number }>();
const ssoCodes = new Map<string, { userId: number; createdAt: number }>();

type OidcDiscovery = {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
};

type OidcTokenResponse = {
  access_token: string;
};

type OidcUserInfo = {
  email?: string;
  name?: string;
  given_name?: string;
  groups?: unknown;
};

const getAppUser = (user: any) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  onboardingCompleted: user.onboardingCompleted,
});

const issueAppToken = (user: any) => jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

const cleanupSsoCaches = () => {
  const now = Date.now();

  for (const [state, value] of ssoStates.entries()) {
    if (now - value.createdAt > SSO_STATE_TTL_MS) {
      ssoStates.delete(state);
    }
  }

  for (const [code, value] of ssoCodes.entries()) {
    if (now - value.createdAt > SSO_CODE_TTL_MS) {
      ssoCodes.delete(code);
    }
  }
};

const signStatePayload = (payload: string) =>
  crypto.createHmac('sha256', AUTH_SSO_STATE_SECRET).update(payload).digest('hex');

const createSsoState = () => {
  const payload = `${Date.now()}:${crypto.randomUUID()}`;
  const signature = signStatePayload(payload);
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
};

const verifySsoState = (state: string) => {
  const [encodedPayload, signature] = state.split('.');
  if (!encodedPayload || !signature) {
    return false;
  }

  const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const expectedSignature = signStatePayload(payload);
  if (signature.length !== expectedSignature.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
};

const getIssuerBase = () => AUTHENTIK_ISSUER.replace(/\/+$/, '');

const discoverOidc = async (): Promise<OidcDiscovery> => {
  const issuer = getIssuerBase();
  if (!issuer) {
    throw new Error('AUTHENTIK_ISSUER is not configured');
  }

  const response = await fetch(`${issuer}/.well-known/openid-configuration`);
  if (!response.ok) {
    throw new Error('Failed to discover Authentik OIDC configuration');
  }

  const discovery = (await response.json()) as Partial<OidcDiscovery>;

  if (!discovery.authorization_endpoint || !discovery.token_endpoint || !discovery.userinfo_endpoint) {
    throw new Error('Invalid OIDC discovery response from Authentik');
  }

  return discovery as OidcDiscovery;
};

const exchangeAuthorizationCode = async (tokenEndpoint: string, code: string): Promise<OidcTokenResponse> => {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: AUTHENTIK_CLIENT_ID,
    client_secret: AUTHENTIK_CLIENT_SECRET,
    redirect_uri: AUTHENTIK_REDIRECT_URI,
  });

  const response = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Failed to exchange OIDC authorization code');
  }

  const tokens = (await response.json()) as Partial<OidcTokenResponse>;
  if (!tokens.access_token) {
    throw new Error('OIDC token response missing access_token');
  }

  return tokens as OidcTokenResponse;
};

const fetchOidcUserInfo = async (userinfoEndpoint: string, accessToken: string): Promise<OidcUserInfo> => {
  const response = await fetch(userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch OIDC userinfo');
  }

  return (await response.json()) as OidcUserInfo;
};

const normalizeGroups = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
};

const isAllowedInternalUser = (email: string, groups: string[]) => {
  const requiredDomain = AUTHENTIK_REQUIRED_DOMAIN.trim().toLowerCase();
  const requiredGroup = AUTHENTIK_ADMIN_GROUP.trim();

  if (requiredDomain && !email.toLowerCase().endsWith(`@${requiredDomain}`)) {
    return false;
  }

  if (requiredGroup && !groups.includes(requiredGroup)) {
    return false;
  }

  return true;
};

const redirectToClient = (path: string) => `${APP_URL.replace(/\/$/, '')}${path}`;

router.get('/sso/authentik/start', async (req, res) => {
  if (!AUTHENTIK_ENABLED) {
    return res.status(404).json({ error: 'SSO is disabled' });
  }

  if (!AUTHENTIK_CLIENT_ID || !AUTHENTIK_CLIENT_SECRET || !AUTHENTIK_REDIRECT_URI) {
    return res.status(500).json({ error: 'SSO is misconfigured on server' });
  }

  try {
    cleanupSsoCaches();

    const discovery = await discoverOidc();
    const state = createSsoState();
    const nonce = crypto.randomUUID();

    ssoStates.set(state, { nonce, createdAt: Date.now() });

    const authorizeUrl = new URL(discovery.authorization_endpoint);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('client_id', AUTHENTIK_CLIENT_ID);
    authorizeUrl.searchParams.set('redirect_uri', AUTHENTIK_REDIRECT_URI);
    authorizeUrl.searchParams.set('scope', AUTHENTIK_SCOPES);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('nonce', nonce);

    return res.redirect(authorizeUrl.toString());
  } catch (error) {
    console.error('Failed to start Authentik SSO flow:', error);
    return res.status(500).json({ error: 'Failed to start SSO flow' });
  }
});

router.get('/sso/authentik/callback', async (req, res) => {
  if (!AUTHENTIK_ENABLED) {
    return res.status(404).json({ error: 'SSO is disabled' });
  }

  const code = req.query.code;
  const state = req.query.state;
  const oidcError = req.query.error;

  if (typeof oidcError === 'string') {
    return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('SSO login was cancelled')}`));
  }

  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('Missing SSO callback parameters')}`));
  }

  if (!verifySsoState(state)) {
    return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('Invalid SSO state')}`));
  }

  const savedState = ssoStates.get(state);
  if (!savedState || Date.now() - savedState.createdAt > SSO_STATE_TTL_MS) {
    ssoStates.delete(state);
    return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('Expired SSO state')}`));
  }

  ssoStates.delete(state);

  try {
    const discovery = await discoverOidc();
    const tokens = await exchangeAuthorizationCode(discovery.token_endpoint, code);
    const userInfo = await fetchOidcUserInfo(discovery.userinfo_endpoint, tokens.access_token);

    const email = typeof userInfo.email === 'string' ? userInfo.email.trim().toLowerCase() : '';
    const groups = normalizeGroups(userInfo.groups);

    if (!email || !isAllowedInternalUser(email, groups)) {
      return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('Your account is not authorized for admin SSO')}`));
    }

    const [existingUser] = await db.select().from(users).where(eq(users.email, email));

    let appUser = existingUser;
    const fallbackName = email.split('@')[0] || 'Admin';
    const incomingName = userInfo.name || userInfo.given_name || fallbackName;

    if (!existingUser) {
      const generatedPassword = await bcrypt.hash(crypto.randomUUID(), 10);
      [appUser] = await db.insert(users).values({
        name: incomingName,
        email,
        password: generatedPassword,
        role: 'admin',
        onboardingCompleted: true,
      }).returning();
    } else {
      const [updatedUser] = await db
        .update(users)
        .set({
          role: 'admin',
          onboardingCompleted: true,
          name: existingUser.name || incomingName,
        })
        .where(eq(users.id, existingUser.id))
        .returning();

      appUser = updatedUser;
    }

    const oneTimeCode = crypto.randomUUID();
    ssoCodes.set(oneTimeCode, { userId: appUser.id, createdAt: Date.now() });

    AuditService.log(
      appUser.id,
      'auth.sso.login',
      'user',
      appUser.id,
      { provider: 'authentik', email },
      req
    );

    return res.redirect(redirectToClient(`/sso/callback?code=${encodeURIComponent(oneTimeCode)}`));
  } catch (error) {
    console.error('Authentik callback failed:', error);
    return res.redirect(redirectToClient(`/login?error=${encodeURIComponent('SSO authentication failed')}`));
  }
});

router.post('/sso/exchange', async (req, res) => {
  if (!AUTHENTIK_ENABLED) {
    return res.status(404).json({ error: 'SSO is disabled' });
  }

  cleanupSsoCaches();

  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!code) {
    return res.status(400).json({ error: 'Missing exchange code' });
  }

  const payload = ssoCodes.get(code);
  if (!payload || Date.now() - payload.createdAt > SSO_CODE_TTL_MS) {
    ssoCodes.delete(code);
    return res.status(400).json({ error: 'Invalid or expired exchange code' });
  }

  ssoCodes.delete(code);

  const [user] = await db.select().from(users).where(eq(users.id, payload.userId));
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    token: issueAppToken(user),
    user: getAppUser(user),
  });
});

// Register - now only requires name, email, password
router.post('/register', validateRequest({ body: registerSchema }), async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [newUser] = await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: null, // Will be set during onboarding
      onboardingCompleted: false,
    }).returning();

    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        onboardingCompleted: newUser.onboardingCompleted
      }
    });

    // Audit Log
    AuditService.log(
      newUser.id,
      'auth.register',
      'user',
      newUser.id,
      { email: newUser.email },
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', validateRequest({ body: loginSchema }), async (req, res) => {
  const { email, password } = req.body;

  try {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      }
    });

    // Audit Log
    AuditService.log(
      user.id,
      'auth.login',
      'user',
      user.id,
      {},
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Complete onboarding
router.post('/complete-onboarding', validateRequest({ body: completeOnboardingSchema }), async (req, res) => {
  const { userId, role, kycData } = req.body;

  try {


    // Ensure we use the name from the DB (source of truth)
    let parsedKycData;
    try {
      parsedKycData = JSON.parse(kycData);
    } catch (e) {
      // Should catch invalid JSON if zod didn't catch it structure-wise, but it's a string.
      parsedKycData = {};
    }

    // We already have the updatedUser (which might have the old name if we didn't update it, but we didn't update name here).
    // Actually, we should fetch the user first or just use the name we have if we trust it wasn't changed.
    // Better: update the kycData payload BEFORE the update query.

    const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!currentUser) return res.status(404).json({ error: 'User not found' });

    parsedKycData.fullName = currentUser.name;
    const finalKycData = JSON.stringify(parsedKycData);

    let onboardingCompleted = true;
    let enrollmentContractId = null;

    if (role === 'publisher') {
      onboardingCompleted = false;

      // Find Template
      const template = await db.query.contractTemplates.findFirst({
        where: eq(contractTemplates.type, 'publisher_enrollment')
      });

      if (template) {
        let instance;

        // Check if user already has a pending enrollment contract
        if (currentUser.enrollmentContractId) {
          const existingInstance = await db.query.contractInstances.findFirst({
            where: eq(contractInstances.id, currentUser.enrollmentContractId)
          });

          // Reuse if pending
          if (existingInstance && existingInstance.status === 'pending') {
            instance = existingInstance;
            enrollmentContractId = instance.id;
          }
        }

        // Create new instance if none exists or previous was not pending
        if (!instance) {
          // Build variable context for enrollment
          const context: VariableContext = {
            publisher: { name: currentUser.name || '', email: currentUser.email },
            contractId: 0
          };

          //Resolve variables in template fields
          const resolvedFields = ContractVariableService.processFields(template.fields, context);

          // Compile PDF with resolved variables (Stage 1 - System)
          const pdfBuffer = await PdfService.compilePdf(template.pdfUrl, resolvedFields);
          const stage1PdfUrl = await uploadBuffer(
            pdfBuffer,
            'application/pdf',
            `contract_${Date.now()}_stage1.pdf`,
            'contracts'
          );

          // Create instance with Stage 1 already completed
          [instance] = await db.insert(contractInstances).values({
            templateId: template.id,
            publisherId: userId,
            status: 'pending',
            finalPdfUrl: stage1PdfUrl,
            variableValues: context as any,
            stage1CompletedAt: new Date(),
            stage1CompletedBy: null, // System completion
            auditLog: [{
              stage: 'stage-1-system',
              userId: null,
              timestamp: new Date().toISOString(),
              action: 'variables_resolved'
            }]
          }).returning();

          enrollmentContractId = instance.id;
        }

        // Create Magic Link for Signing
        const magicLink = await MagicLinkService.createLink(
          userId,
          `/portal/contracts/${instance.id}`,
          req
        );

        // Send Email
        await EmailService.sendSigningInvitation({
          email: currentUser.email,
          magicLink,
          role: 'publisher',
          contractId: instance.id
        });
      }
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        role,
        kycData: finalKycData,
        onboardingCompleted,
        enrollmentContractId,
      })
      .where(eq(users.id, userId))
      .returning();

    const token = jwt.sign({ id: updatedUser.id, role: updatedUser.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        onboardingCompleted: updatedUser.onboardingCompleted
      }
    });

    AuditService.log(
      userId,
      'user.onboarding.complete',
      'user',
      userId,
      { role, hasKyc: !!kycData },
      req
    );
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Magic Link Login
router.post('/magic-login', async (req, res) => {
  const { token } = req.body;

  try {
    const link = await MagicLinkService.verifyAndConsume(token, req);

    // Fetch user
    const [user] = await db.select().from(users).where(eq(users.id, link.userId));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate session token
    const sessionToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token: sessionToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      },
      redirectPath: link.redirectPath
    });
  } catch (error: any) {
    console.error('Magic login error:', error);
    res.status(400).json({ error: error.message || 'Invalid magic link' });
  }
});

// Resend Enrollment Email
router.post('/resend-enrollment', validateRequest({}), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role !== 'publisher') return res.status(400).json({ error: 'Only publishers can resend enrollment emails' });
    if (user.onboardingCompleted) return res.status(400).json({ error: 'Onboarding already completed' });
    if (!user.enrollmentContractId) return res.status(400).json({ error: 'No enrollment contract found' });

    // Validate contract status
    const contract = await db.query.contractInstances.findFirst({
      where: eq(contractInstances.id, user.enrollmentContractId)
    });

    if (!contract || contract.status !== 'pending') {
      // Should we create a new one? For now assume valid state or user needs to contact support if void.
      // Or we could trigger the creation logic again. But simpler is safer.
      return res.status(400).json({ error: 'Contract is not in pending state' });
    }

    // Create Magic Link
    const magicLink = await MagicLinkService.createLink(
      user.id,
      `/portal/contracts/${contract.id}`,
      req
    );

    // Send Email
    await EmailService.sendSigningInvitation({
      email: user.email,
      magicLink,
      role: 'publisher',
      contractId: contract.id
    });

    res.json({ message: 'Email sent successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to resend email' });
  }
});

// Get Current User
router.get('/me', validateRequest({}), async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number };
    const [user] = await db.select().from(users).where(eq(users.id, decoded.id));

    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        onboardingCompleted: user.onboardingCompleted
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;
