import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { resend } from '../lib/mail.js';

const prisma = new PrismaClient();

export function startBillingCronJobs(server) {
  // Rodar todos os dias às 08:00
  cron.schedule('0 8 * * *', async () => {
    server.log.info('Iniciando Cron Job de cobrança...');
    
    try {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // 1. Aviso de Vencimento Amanhã
      const expiringTomorrow = await prisma.user.findMany({
        where: {
          isLifetime: false,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: {
            gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
            lt: new Date(tomorrow.setHours(23, 59, 59, 999))
          }
        }
      });

      for (const user of expiringTomorrow) {
        await resend.emails.send({
          from: 'VeroFlux <suporte@veroflux.com.br>', // Altere para o domínio validado
          to: user.email,
          subject: 'Sua assinatura vence amanhã!',
          html: `<p>Olá ${user.name},</p><p>Sua assinatura do VeroFlux vence amanhã. Caso você pague no cartão, a cobrança será automática.</p>`
        });
        server.log.info(`Aviso de vencimento enviado para ${user.email}`);
      }

      // 2. Bloqueio por atraso (Venceu ontem e não pagou)
      // O Stripe também muda o status via webhook (invoice.payment_failed), mas garantimos aqui
      const expiredYesterday = await prisma.user.findMany({
        where: {
          isLifetime: false,
          subscriptionStatus: 'active',
          subscriptionExpiresAt: {
            lt: new Date(now.setHours(0, 0, 0, 0)) // Expirou antes de hoje
          }
        }
      });

      for (const user of expiredYesterday) {
        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: 'past_due' }
        });

        await resend.emails.send({
          from: 'VeroFlux <suporte@veroflux.com.br>',
          to: user.email,
          subject: 'Sua assinatura foi bloqueada por atraso',
          html: `<p>Olá ${user.name},</p><p>Não identificamos o pagamento da sua mensalidade. Seu acesso ao sistema foi bloqueado. Por favor, regularize acessando a plataforma.</p>`
        });
        server.log.info(`Aviso de bloqueio enviado e usuário ${user.email} bloqueado.`);
      }

    } catch (error) {
      server.log.error(`Erro no Cron Job de cobrança: ${error.message}`);
    }
  });
}
