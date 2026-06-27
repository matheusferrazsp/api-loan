import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

// O STRIPE_SECRET_KEY será definido no .env
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || "sk_test_placeholder",
);
const prisma = new PrismaClient();

export const createCheckoutSession = async (request, reply) => {
  try {
    const userId = request.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return reply.status(404).send({ message: "Usuário não encontrado" });
    }

    if (user.isLifetime) {
      return reply
        .status(400)
        .send({
          message: "Você é um cliente vitalício e não precisa de assinatura.",
        });
    }

    let customerId = user.stripeCustomerId;

    // Se o usuário ainda não tiver um cliente no Stripe, criamos
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: user.id.toString(),
        },
      });
      customerId = customer.id;

      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Criar a sessão de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID || "price_placeholder",
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 3,
      },
      success_url: `${process.env.FRONTEND_URL || "https://veroflux.com.br"}/account?success=true`,
      cancel_url: `${process.env.FRONTEND_URL || "https://veroflux.com.br"}/account?canceled=true`,
    });

    return reply.send({ url: session.url });
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ message: "Erro ao criar sessão de checkout" });
  }
};

export const createPortalSession = async (request, reply) => {
  try {
    const userId = request.user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return reply.status(404).send({ message: "Usuário não encontrado" });
    }

    if (!user.stripeCustomerId) {
      return reply
        .status(400)
        .send({ message: "Você ainda não possui uma assinatura" });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL || "https://veroflux.com.br"}/account`,
    });

    return reply.send({ url: session.url });
  } catch (error) {
    request.log.error(error);
    return reply
      .status(500)
      .send({ message: "Erro ao criar portal do cliente" });
  }
};
