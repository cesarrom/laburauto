
import * as dotenv from 'dotenv';
dotenv.config();

// Helper to get config
const getConfig = () => ({
  DLOCAL_PLAN_TOKEN: process.env.DLOCAL_PLAN_TOKEN || '2GTsaFgWXZj4FGBczeSnqB7HJXt8np67',
  DLOCAL_ENVIRONMENT: process.env.DLOCAL_ENVIRONMENT || 'production',
  DLOCAL_API_KEY: process.env.DLOCAL_API_KEY,
  DLOCAL_SECRET_KEY: process.env.DLOCAL_SECRET_KEY,
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
});

export const getSubscriptionUrl = (user: { id: number; email: string }) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_PLAN_TOKEN, FRONTEND_URL } = getConfig();

  const domain = DLOCAL_ENVIRONMENT === 'sandbox'
    ? 'checkout-sbx.dlocalgo.com'
    : 'checkout.dlocalgo.com';

  const baseUrl = `https://${domain}/validate/subscription/${DLOCAL_PLAN_TOKEN}`;
  const callbackUrl = `${FRONTEND_URL}/subscription`;

  const params = new URLSearchParams({
    email: user.email,
    external_id: user.id.toString(),
    callback_url: callbackUrl
  });
  return `${baseUrl}?${params.toString()}`;
};

export const verifyWebhook = (req: any): boolean => {
  return true;
};

export const getPaymentStatus = async (userId: number, email: string): Promise<{ status: 'active' | 'inactive'; subscriptionId?: string }> => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';

  if (!DLOCAL_API_KEY || !DLOCAL_SECRET_KEY) {
    console.warn('DLOCAL_API_KEY or DLOCAL_SECRET_KEY not set');
    return { status: 'inactive' };
  }

  try {
    const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

    // 1. Check for active subscriptions directly
    const subRes = await getSubscriptions(email);
    const activeSub = subRes.data?.find((s: any) => s.status === 'ACTIVE' || s.status === 'AUTHORIZED');

    if (activeSub) {
      return {
        status: 'active',
        subscriptionId: activeSub.id || activeSub.subscription_token
      };
    }

    // 2. Check for active payments (Fallback)
    const paymentsRes = await fetch(`https://${apiDomain}/v1/payments?client_email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });

    if (paymentsRes.ok) {
      const json = await paymentsRes.json();
      const payments = json.data || [];
      const paidPayment = payments.find((p: any) =>
        ['PAID', 'COMPLETED', 'AUTHORIZED'].includes(p.status)
      );

      if (paidPayment) {
        return {
          status: 'active',
          subscriptionId: paidPayment.subscription_id || paidPayment.id
        };
      }
    }

    return { status: 'inactive' };
  } catch (error) {
    console.error('Error checking payment status:', error);
    return { status: 'inactive' };
  }
};

const resolveSubscriptionIds = async (subscriptionToken: string) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY, DLOCAL_PLAN_TOKEN } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const plansRes = await fetch(`https://${apiDomain}/v1/subscription/plan/all`, {
      headers: { 'Authorization': authHeader }
    });
    const plans = await plansRes.json();
    const plan = plans.data?.find((p: any) => p.plan_token === DLOCAL_PLAN_TOKEN || p.name === 'Dueño de auto');

    if (!plan) return null;

    const subsRes = await fetch(`https://${apiDomain}/v1/subscription/plan/${plan.id}/subscription/all`, {
      headers: { 'Authorization': authHeader }
    });
    const subs = await subsRes.json();
    const sub = subs.data?.find((s: any) => s.subscription_token === subscriptionToken);

    return sub ? { planId: plan.id, subscriptionId: sub.id } : null;
  } catch (error) {
    return null;
  }
};

export const listExecutions = async (subscriptionToken: string) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const ids = await resolveSubscriptionIds(subscriptionToken);
    if (!ids) return { data: [] };

    const response = await fetch(`https://${apiDomain}/v1/subscription/plan/${ids.planId}/subscription/${ids.subscriptionId}/execution/all`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });
    if (!response.ok) return { data: [] };
    return await response.json();
  } catch (error) {
    return { data: [] };
  }
};

export const cancelSubscription = async (subscriptionToken: string) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const ids = await resolveSubscriptionIds(subscriptionToken);
    if (!ids) throw new Error('Could not resolve numeric IDs');

    const response = await fetch(`https://${apiDomain}/v1/subscription/plan/${ids.planId}/subscription/${ids.subscriptionId}/deactivate`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `cancel-${ids.subscriptionId}`
      }
    });
    if (!response.ok) throw new Error(`dLocal Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return { error: 'Failed to cancel' };
  }
};

export const refundPayment = async (paymentId: string, amount?: number) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const payload: any = { payment_id: paymentId };
    if (amount) payload.amount = amount;

    console.log(`Attempting dLocal refund for ${paymentId} with amount: ${amount || 'DEFAULT'}`);

    const response = await fetch(`https://${apiDomain}/v1/refunds`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `refund-${paymentId}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('dLocal Refund API Error:', response.status, data);
      throw new Error(`dLocal Refund Error: ${response.status} - ${data.message || JSON.stringify(data)}`);
    }

    console.log('dLocal Refund Success:', data);
    return data;
  } catch (error) {
    console.error('Error processing refund:', error);
    return { error: error instanceof Error ? error.message : 'Failed to refund' };
  }
};

export const getSubscriptions = async (email: string) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY, DLOCAL_PLAN_TOKEN } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const plansRes = await fetch(`https://${apiDomain}/v1/subscription/plan/all`, {
      headers: { 'Authorization': authHeader }
    });
    const plansJson = await plansRes.json();
    const plan = plansJson.data?.find((p: any) => p.plan_token === DLOCAL_PLAN_TOKEN || p.name === 'Dueño de auto');

    if (!plan) return { data: [] };

    const response = await fetch(`https://${apiDomain}/v1/subscription/plan/${plan.id}/subscription/all`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`dLocal Error: ${response.status}`);
    const subs = await response.json();

    return {
      data: subs.data?.filter((s: any) => s.client_email === email) || []
    };
  } catch (error) {
    console.error('Error listing subscriptions:', error);
    return { data: [] };
  }
};

export const listPayments = async (email: string) => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const response = await fetch(`https://${apiDomain}/v1/payments?client_email=${encodeURIComponent(email)}`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`dLocal Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error listing payments:', error);
    return { data: [] };
  }
};

export const listRefunds = async () => {
  const { DLOCAL_ENVIRONMENT, DLOCAL_API_KEY, DLOCAL_SECRET_KEY } = getConfig();
  const apiDomain = DLOCAL_ENVIRONMENT === 'sandbox' ? 'api-sbx.dlocalgo.com' : 'api.dlocalgo.com';
  const authHeader = `Bearer ${DLOCAL_API_KEY}:${DLOCAL_SECRET_KEY}`;

  try {
    const response = await fetch(`https://${apiDomain}/v1/refunds`, {
      method: 'GET',
      headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`dLocal Error: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error listing refunds:', error);
    return { data: [] };
  }
};
