
import { vi } from 'vitest';

export const getSubscriptionUrl = vi.fn().mockReturnValue(
  'https://checkout.dlocalgo.com/validate/subscription/2GTsaFgWXZj4FGBczeSnqB7HJXt8np67?email=test%40example.com'
);

export const getPaymentStatus = vi.fn().mockResolvedValue({
  status: 'active',
  subscriptionId: 'sub_12345',
});

export const verifyWebhook = vi.fn().mockReturnValue(true);

export const getSubscriptions = vi.fn().mockResolvedValue({
  data: [{ id: 'sub_12345', status: 'ACTIVE' }],
});

export const listPayments = vi.fn().mockResolvedValue({
  data: [{ id: 'pay_12345', status: 'PAID' }],
});

export const cancelSubscription = vi.fn().mockResolvedValue({ success: true });
