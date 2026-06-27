import { 
  createCheckoutSession, 
  createPortalSession 
} from '../controllers/subscriptionController.js';
import { handleStripeWebhook } from '../controllers/webhookController.js';
import { authenticate } from "../middlewares/auth.js";

export async function subscriptionRoutes(server) {
  // Rota de Webhook não deve ter autenticação, pois o Stripe que chama
  server.post(
    '/api/webhooks/stripe',
    { config: { rawBody: true } },
    handleStripeWebhook
  );

  // Rotas autenticadas
  server.post(
    '/api/checkout',
    { preHandler: [authenticate] },
    createCheckoutSession
  );

  server.post(
    '/api/billing-portal',
    { preHandler: [authenticate] },
    createPortalSession
  );
}
