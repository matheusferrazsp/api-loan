import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { webPush } from '../lib/webpush.js';

const prisma = new PrismaClient();

export function startClientNotificationsCronJobs(server) {
  // Rodar 3 vezes ao dia: às 08:00, 12:00 e 17:00 (no fuso horário de São Paulo / Brasil)
  cron.schedule('0 8,12,17 * * *', async () => {
    server.log.info('Iniciando Cron Job de notificações de clientes (Push)...');
    
    try {
      // Hora atual e data de referência no fuso do Brasil (America/Sao_Paulo)
      const nowSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
      const currentHour = nowSP.getHours();
      
      // Zero horas de hoje em UTC correspondente ao dia atual no Brasil
      const todayZero = new Date(Date.UTC(nowSP.getFullYear(), nowSP.getMonth(), nowSP.getDate()));

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
          const dueDateZero = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate()));

          const isToday = dueDateZero.getTime() === todayZero.getTime();
          const isPast = dueDateZero < todayZero;

          if (isToday) clientsDueToday++;
          if (isPast || client.lateInstallments > 0) clientsLate++;
        }

        let title = null;
        let body = null;

        if (clientsDueToday > 0 || clientsLate > 0) {
          if (currentHour < 10) {
            title = "Resumo da Manhã - VeroFlux";
          } else if (currentHour < 15) {
            title = "Lembrete do Meio-Dia - VeroFlux";
          } else {
            title = "Resumo do Fim de Tarde - VeroFlux";
          }

          let bodyParts = [];
          if (clientsDueToday > 0) bodyParts.push(`${clientsDueToday} pagamento(s) vencendo hoje`);
          if (clientsLate > 0) bodyParts.push(`${clientsLate} cliente(s) em atraso`);

          body = bodyParts.join(" e ") + ". Acesse o painel para gerenciar.";
        } else if (currentHour < 10) {
          // Se não tem pendências, envia UMA notificação diária na execução da manhã (8h)
          title = "Tudo certo por hoje! 🚀";
          body = "Você não tem cobranças pendentes ou em atraso para hoje. Aproveite o dia com tranquilidade!";
        }

        if (title && body) {
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
              server.log.info(`Push enviado para o usuário ${user.id}: ${title}`);
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
  }, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
  });
}
