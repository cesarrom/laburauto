import express from 'express';
import { db } from '../db';
import { users, vehicles, bookings, shifts, rentalApplications, notifications as notificationsTable } from '@laburauto/shared/schema';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { getSubscriptionUrl, listExecutions, cancelSubscription, refundPayment, getSubscriptions, listPayments, listRefunds } from '../services/dlocal';

const router = express.Router();

router.post('/subscribe', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      // In a real app we would check req.user matches userId from auth middleware
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.subscriptionStatus === 'active') {
      return res.status(400).json({
        error: 'ALREADY_SUBSCRIBED',
        message: 'You already have an active subscription.'
      });
    }

    const url = getSubscriptionUrl(user);
    res.json({ url });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // 1. Check database first (maybe webhook arrived)
    let user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { subscriptionStatus: true, email: true }
    });

    if (user?.subscriptionStatus === 'active') {
      return res.json({ status: 'active', source: 'database' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 2. If not active, query dLocal API active verification
    const { getPaymentStatus } = await import('../services/dlocal');
    const verifyResult = await getPaymentStatus(userId, user.email);

    if (verifyResult.status === 'active') {
      // Update DB immediately with both status and ID
      await db.update(users)
        .set({
          subscriptionStatus: 'active',
          subscriptionId: verifyResult.subscriptionId
        })
        .where(eq(users.id, userId));

      return res.json({
        status: 'active',
        source: 'api',
        subscriptionId: verifyResult.subscriptionId
      });
    }

    res.json({ status: 'inactive' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ error: 'Verification failed' });
  }
});

const performSubscriptionCleanup = async (userId: number) => {
  // 1. Clear status in DB
  await db.update(users)
    .set({ subscriptionStatus: 'inactive', subscriptionId: null })
    .where(eq(users.id, userId));

  // 2. Cascading Cleanup: Vehicles
  const userVehicles = await db.select({ id: vehicles.id }).from(vehicles).where(eq(vehicles.publisherId, userId));
  const vehicleIds = userVehicles.map(v => v.id);

  if (vehicleIds.length > 0) {
    // 3. Cancel active bookings for these vehicles
    const affectedBookings = await db.select({ id: bookings.id, driverId: bookings.driverId })
      .from(bookings)
      .where(and(
        inArray(bookings.vehicleId, vehicleIds),
        inArray(bookings.status, ['confirmed', 'active', 'pending_payment'])
      ));

    if (affectedBookings.length > 0) {
      // 4. Notify drivers before deleting the bookings
      const notificationPromises = affectedBookings.map(b =>
        db.insert(notificationsTable).values({
          userId: b.driverId,
          type: 'booking_cancelled',
          message: 'A booking has been cancelled because the vehicle is no longer available (publisher unsubscribed).',
          relatedEntityId: b.id
        })
      );
      await Promise.all(notificationPromises);
    }

    // 5. Delete dependent records
    await db.delete(shifts).where(inArray(shifts.vehicleId, vehicleIds));
    await db.delete(rentalApplications).where(inArray(rentalApplications.vehicleId, vehicleIds));
    await db.delete(bookings).where(inArray(bookings.vehicleId, vehicleIds));

    // 6. Finally delete vehicles
    await db.delete(vehicles).where(inArray(vehicles.id, vehicleIds));
  }
};

router.get('/subscriptions/me', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const user = await db.query.users.findFirst({
      where: eq(users.id, parseInt(userId as string)),
      columns: { subscriptionId: true, email: true, subscriptionStatus: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    let executions: any[] = [];

    // 1. Fetch from Payments endpoint
    const [paymentsResult, refundsResult] = await Promise.all([
      listPayments(user.email),
      listRefunds()
    ]);

    const payments = paymentsResult.data || [];
    const refunds = refundsResult.data || [];

    // Map payments to the execution structure expected by the frontend
    executions = payments.map((p: any) => {
      const refund = refunds.find((r: any) => r.payment_id === p.id || r.payment_id === p.id.replace('DP-', ''));

      let status = p.status;
      if (refund) {
        status = refund.status === 'SUCCESS' ? 'REFUNDED' : 'IN DISPUTE';
      }

      return {
        id: p.id,
        created_at: p.created_date,
        amount_paid: p.amount,
        currency: p.currency,
        status: status, // Refined status
        order_id: p.order_id,
        external_transaction_id: p.id
      };
    });

    // 2. Fetch from Executions if we have a subscription token
    let subToken = user.subscriptionId;
    if (subToken) {
      const execResult = await listExecutions(subToken);
      const subExecs = execResult.data || [];

      subExecs.forEach((ex: any) => {
        if (!executions.find(e => e.order_id === ex.order_id)) {
          executions.push({
            id: ex.id,
            created_at: ex.created_at,
            amount_paid: ex.amount_paid,
            currency: ex.currency,
            status: ex.status || 'COMPLETED',
            order_id: ex.order_id
          });
        }
      });
    }

    res.json({
      status: user.subscriptionStatus,
      subscriptionId: subToken,
      executions: executions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    });
  } catch (error) {
    console.error('Error fetching subscription details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/subscriptions/cancel', async (req, res) => {
  try {
    const { userId, confirmation } = req.body;
    if (confirmation !== 'CANCEL SUBSCRIPTION AND DELETE ALL VEHICLES') {
      return res.status(400).json({ error: 'Invalid confirmation text' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // 1. Cancel in dLocal if ID exists
    if (user.subscriptionId) {
      await cancelSubscription(user.subscriptionId);
    }

    // 2. Run shared cleanup
    await performSubscriptionCleanup(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Cancellation error:', error);
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

router.post('/:paymentId/dispute', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.body;

    // 1. Fetch payment to verify date
    // (In a real app, we'd fetch from dLocal or our own payment logs)
    // For now, we trust the intent and check if subscription exists for user
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const allRefundsRes = await listRefunds();
    const existingRefund = allRefundsRes.data?.find((r: any) => r.payment_id === paymentId || r.payment_id === paymentId.replace('DP-', ''));
    if (existingRefund) {
      console.log(`Payment ${paymentId} already has a successful refund (${existingRefund.id}). Proceeding to cleanup.`);
    } else {
      // 2. Fetch payment details if no refund exists yet
      const paymentsResult = await listPayments(user.email);
      const payment = paymentsResult.data?.find((p: any) => p.id === paymentId);

      // 3. Request Full Refund (omit amount to avoid Sandbox currency/minimum issues)
      const refundResult = await refundPayment(paymentId);
      if (refundResult.error) {
        console.warn(`Refund attempt failed, but proceeding with cleanup: ${refundResult.error}`);
      }
    }

    // 4. Guaranteed Cancellation: Find and deactivate ALL active subscriptions for this user
    try {
      const subRes = await getSubscriptions(user.email);
      const activeSubs = subRes.data?.filter((s: any) => s.status === 'ACTIVE' || s.status === 'AUTHORIZED') || [];

      for (const sub of activeSubs) {
        const subToken = sub.id || sub.subscription_token;
        console.log(`Deactivating subscription ${subToken} as part of refund/cancel flow`);
        await cancelSubscription(subToken).catch(err => console.error(`Failed to cancel sub ${subToken}`, err));
      }
    } catch (err) {
      console.error('Failed to cleanup and cancel subscriptions:', err);
    }

    // 5. Cleanup database and notify drivers
    if (user.subscriptionId) {
      await cancelSubscription(user.subscriptionId).catch(() => { }); // Secondary attempt
    }

    await performSubscriptionCleanup(userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Dispute error:', error);
    res.status(500).json({ error: 'Dispute failed' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const event = req.body;
    console.log('Received dLocal webhook:', JSON.stringify(event, null, 2));

    const data = event;
    const externalId = data.external_id;

    if (externalId) {
      const userId = parseInt(externalId);
      const status = data.status; // e.g. 'PAID', 'ACTIVE', 'AUTHORIZED'

      if (!isNaN(userId)) {
        let subStatus = 'inactive';
        if (status === 'PAID' || status === 'ACTIVE' || status === 'AUTHORIZED') {
          subStatus = 'active';
        }

        await db.update(users)
          .set({
            subscriptionStatus: subStatus as 'active' | 'inactive' | 'past_due' | 'canceled',
            dlocalCustomerId: data.payer_id || null,
            subscriptionId: data.subscription_id || data.id || null
          })
          .where(eq(users.id, userId));

        console.log(`Updated user ${userId} subscription status to ${subStatus}`);
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).send('Error');
  }
});

export default router;
