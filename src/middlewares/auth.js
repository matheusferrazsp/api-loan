import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

export async function authenticate(request, reply) {
  try {
    await request.jwtVerify();
    
    const user = await prisma.user.findUnique({
      where: { id: request.user.id }
    });

    if (!user) {
      return reply.status(401).send({ error: "Usuário não encontrado." });
    }
    
    request.dbUser = user;
  } catch (err) {
    reply
      .status(401)
      .send({ error: "Não autorizado. Token inválido ou ausente." });
  }
}

export async function requireActiveSubscription(request, reply) {
  const user = request.dbUser;
  
  if (!user) {
    return reply.status(401).send({ error: "Usuário não encontrado." });
  }

  if (!user.isLifetime && ['past_due', 'canceled', 'unpaid', 'pending'].includes(user.subscriptionStatus)) {
    return reply.status(403).send({ 
      error: 'Acesso bloqueado',
      code: 'SUBSCRIPTION_PAST_DUE',
      message: 'Você precisa de uma assinatura ativa para acessar esta funcionalidade.'
    });
  }
}
