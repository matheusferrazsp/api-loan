import Stripe from 'stripe';
import { PrismaClient } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const prisma = new PrismaClient();
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder';

export const handleStripeWebhook = async (request, reply) => {
  const sig = request.headers['stripe-signature'];
  let event;

  try {
    // Fastify request.rawBody is needed for Stripe webhook verification
    // Make sure to configure Fastify to keep rawBody for this route
    event = stripe.webhooks.constructEvent(request.rawBody, sig, endpointSecret);
  } catch (err) {
    request.log.error(`Webhook signature verification failed: ${err.message}`);
    return reply.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
          
          await prisma.user.updateMany({
            where: { stripeCustomerId: invoice.customer },
            data: {
              subscriptionStatus: 'active',
              subscriptionExpiresAt: new Date(subscription.current_period_end * 1000),
              stripeSubscriptionId: subscription.id,
            },
          });
        }
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (invoice.subscription) {
          await prisma.user.updateMany({
            where: { stripeCustomerId: invoice.customer },
            data: {
              subscriptionStatus: 'past_due',
            },
          });
        }
        break;
      }
      case 'customer.subscription.deleted':
      case 'customer.subscription.canceled': {
        const subscription = event.data.object;
        await prisma.user.updateMany({
          where: { stripeCustomerId: subscription.customer },
          data: {
            subscriptionStatus: 'canceled',
          },
        });
        break;
      }
      default:
        // Outros eventos
        console.log(`Unhandled event type ${event.type}`);
    }

    return reply.send({ received: true });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ message: 'Internal Server Error processing webhook' });
  }
};
