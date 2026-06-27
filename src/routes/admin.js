import { PrismaClient } from "@prisma/client";
import {
  authenticate,
  requireActiveSubscription,
} from "../middlewares/auth.js";

const prisma = new PrismaClient();

export async function adminRoutes(server) {
  server.addHook("preHandler", authenticate);
  server.addHook("preHandler", requireActiveSubscription);

  // Middleware para verificar se é o admin (Baseado no email configurado no .env)
  const verifyAdmin = async (request, reply) => {
    try {
      const envAdminEmail =
        process.env.ADMIN_EMAIL || "suporte@veroflux.com.br";
      const adminEmails = [
        envAdminEmail.toLowerCase(),
        "contatomatheus.oferraz@gmail.com",
      ];

      console.log("--- DEBUG ADMIN ---");
      console.log("User Email:", request.user?.email);

      if (
        !request.user?.email ||
        !adminEmails.includes(request.user.email.toLowerCase())
      ) {
        return reply
          .status(403)
          .send({ error: "Acesso negado. Apenas administradores." });
      }
    } catch (err) {
      console.log("Erro no jwtVerify:", err.message);
      return reply.status(401).send({ error: "Não autorizado" });
    }
  };

  server.get(
    "/api/admin/users",
    { preHandler: [authenticate, verifyAdmin] },
    async (request, reply) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            name: true,
            email: true,
            subscriptionStatus: true,
            isLifetime: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        });
        return reply.send(users);
      } catch (error) {
        return reply.status(500).send({ error: "Erro ao buscar usuários" });
      }
    },
  );

  server.put(
    "/api/admin/users/:id/lifetime",
    { preHandler: [authenticate, verifyAdmin] },
    async (request, reply) => {
      try {
        const { id } = request.params;
        const { isLifetime } = request.body;

        const user = await prisma.user.update({
          where: { id: Number(id) },
          data: { isLifetime },
        });

        return reply.send({ success: true, isLifetime: user.isLifetime });
      } catch (error) {
        return reply.status(500).send({ error: "Erro ao atualizar usuário" });
      }
    },
  );
}
