import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { webPush } from '../lib/webpush.js';

const prisma = new PrismaClient();

export function startClientNotificationsCronJobs(server) {
  // Rodar todos os dias às 08:30 (meia hora depois da cobrança de assinaturas)
  cron.schedule('30 8 * * *', async () => {
    server.log.info('Iniciando Cron Job de notificações de clientes (Push)...');
    
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Buscar todos os usuários que têm pelo menos um PushSubscription
      const usersWithPush = await prisma.user.findMany({
        where: {
          pushSubscriptions: {
            some: {}
          }
        },
        include: {
          pushSubscriptions: true,
          clients: {
            where: {
              totalDebtPaid: false,
              isDelinquent: false
            }
          }
        }
      });

      for (const user of usersWithPush) {
        let clientsDueToday = 0;
        let clientsLate = 0;

        for (const client of user.clients) {
          if (!client.nextPaymentDate) continue;

          const dueDate = new Date(client.nextPaymentDate);
          const dueDateZero = new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());

          const isToday = dueDateZero.getTime() === now.getTime();
          const isPast = dueDateZero < now;

          if (isToday) clientsDueToday++;
          if (isPast || client.lateInstallments > 0) clientsLate++;
        }

        if (clientsDueToday > 0 || clientsLate > 0) {
          const title = "Resumo do Dia - VeroFlux";
          let bodyParts = [];
          if (clientsDueToday > 0) bodyParts.push(`${clientsDueToday} pagamento(s) vencendo hoje`);
          if (clientsLate > 0) bodyParts.push(`${clientsLate} cliente(s) em atraso`);

          const body = bodyParts.join(" e ") + ". Acesse o painel para gerenciar.";

          const payload = JSON.stringify({
            title,
            body,
            icon: '/icon-192x192.png',
            url: '/dashboard'
          });

          // Disparar push para todos os dispositivos do usuário
          for (const sub of user.pushSubscriptions) {
            try {
              await webPush.sendNotification(
                {
                  endpoint: sub.endpoint,
                  keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                  }
                },
                payload
              );
              server.log.info(`Push enviado para o usuário ${user.id}`);
            } catch (err) {
              // Se o endpoint for inválido ou não existir mais (ex: usuário removeu a permissão), a gente deleta
              if (err.statusCode === 410 || err.statusCode === 404) {
                await prisma.pushSubscription.delete({ where: { id: sub.id } });
                server.log.info(`Inscrição Push ${sub.id} deletada (inválida).`);
              } else {
                server.log.error(`Erro ao enviar push para usuário ${user.id}: ${err.message}`);
              }
            }
          }
        }
      }
    } catch (error) {
      server.log.error(`Erro no Cron Job de Notificações Push: ${error.message}`);
    }
  });
}
