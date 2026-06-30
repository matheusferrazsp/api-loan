import { PrismaClient } from "@prisma/client";
import { webPush } from "../lib/webpush.js";

const prisma = new PrismaClient();

export async function pushRoutes(server) {
  // Rota para salvar a inscrição do usuário logado
  server.post(
    "/push/subscribe",
    {
      preValidation: [
        async (request, reply) => {
          try {
            await request.jwtVerify();
          } catch (err) {
            reply.status(401).send({ message: "Não autorizado" });
          }
        },
      ],
    },
    async (request, reply) => {
      const userId = request.user.id;
      const subscription = request.body;

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return reply.status(400).send({ message: "Inscrição inválida" });
      }

      try {
        // Tenta achar se essa inscrição (endpoint) já existe
        const existingSub = await prisma.pushSubscription.findUnique({
          where: { endpoint: subscription.endpoint },
        });

        if (existingSub) {
          // Se já existe e é do mesmo usuário, ok.
          if (existingSub.userId === userId) {
            return reply.status(200).send({ message: "Já inscrito." });
          }
          // Se for de outro usuário, a gente atualiza para o usuário atual
          await prisma.pushSubscription.update({
            where: { id: existingSub.id },
            data: { userId },
          });
          return reply.status(200).send({ message: "Inscrição atualizada." });
        }

        // Se não existe, a gente cria!
        await prisma.pushSubscription.create({
          data: {
            endpoint: subscription.endpoint,
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
            userId,
          },
        });

        return reply.status(201).send({ message: "Inscrito com sucesso!" });
      } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ message: "Erro ao salvar inscrição." });
      }
    }
  );
}
