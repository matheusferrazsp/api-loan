import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import crypto from "node:crypto";
import { resend } from "../lib/mail.js";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_placeholder");

export const createUser = async (request, reply) => {
  try {
    const { email, name, password } = request.body;

    if (!email || !name || !password) {
      return reply.status(400).send({
        error: "Email, name e password são obrigatórios",
      });
    }

    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      return reply.status(409).send({
        error: "Email já cadastrado",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Criar usuário
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        subscriptionStatus: 'pending',
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        subscriptionStatus: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        isLifetime: true,
      },
    });

    return reply.status(201).send(user);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return reply.status(500).send({
      error: "Erro interno do servidor",
    });
  }
};

export const getUsers = async (request, reply) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
    });

    return reply.send(users);
  } catch (error) {
    console.error("Erro ao listar usuários:", error);
    return reply.status(500).send({
      error: "Erro interno do servidor",
    });
  }
};

export const getUserById = async (request, reply) => {
  try {
    const { id } = request.params;
    const parsedId = parseInt(id, 10);

    if (Number.isNaN(parsedId)) {
      return reply.status(400).send({
        error: "ID de usuário inválido",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: parsedId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
        subscriptionStatus: true,
        isLifetime: true,
      },
    });

    if (!user) {
      return reply.status(404).send({
        error: "Usuário não encontrado",
      });
    }

    return reply.send(user);
  } catch (error) {
    console.error("Erro ao buscar usuário:", error);
    return reply.status(500).send({
      error: "Erro interno do servidor",
    });
  }
};

export const login = async (request, reply) => {
  try {
    const { email, password } = request.body;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return reply.status(401).send({ error: "Email ou senha inválidos" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return reply.status(401).send({ error: "Email ou senha inválidos" });
    }

    const token = await reply.jwtSign(
      {
        id: user.id,
        email: user.email,
      },
      {
        expiresIn: "7d",
      },
    );

    return reply.send({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        subscriptionStatus: user.subscriptionStatus,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId,
        isLifetime: user.isLifetime,
      },
      token,
    });
  } catch (error) {
    console.error("Erro ao fazer login:", error);
    return reply.status(500).send({
      error: "Erro interno do servidor",
    });
  }
};

export const forgotPassword = async (request, reply) => {
  try {
    const { email } = request.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return reply.send({ message: "Link enviado se o e-mail existir." });
    }

    const token = crypto.randomBytes(20).toString("hex");

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expira em 1 hora

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      },
    });

    // Chamada do Resend (é muito mais simples que o Nodemailer)
    await resend.emails.send({
      from: "VeroFlux <suporte@veroflux.com.br>",
      to: email,
      subject: "Redefinição de Senha - VeroFlux",
      html: `<h1>Olá ${user.name}!</h1> <br>
      <p>Clique no link abaixo para redefinir a sua senha, caso não tenha solicitado ignore este email: <br><br>
      <a href="https://veroflux.com.br/reset-password?token=${token}">Resetar</a></p>`,
    });

    return reply.status(200).send({ message: "E-mail enviado via Resend!" });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Erro ao enviar e-mail." });
  }
};

export const resetPassword = async (request, reply) => {
  try {
    const { token, password } = request.body;

    // Busca o usuário que tenha esse token E que não tenha expirado
    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: {
          gt: new Date(),
        },
      },
    });

    if (!user) {
      return reply.status(400).send({ error: "Token inválido ou expirado." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Atualiza a senha e limpa os campos de reset
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    });

    return reply.send({ message: "Senha atualizada com sucesso!" });
  } catch (error) {
    return reply.status(500).send({ error: "Erro ao atualizar senha." });
  }
};

export const updateUserProfile = async (request, reply) => {
  try {
    const { id } = request.params;
    const { email, name } = request.body;

    const userId = parseInt(id, 10);
    const authenticatedUserId = Number(request.user?.id);

    if (Number.isNaN(userId)) {
      return reply.status(400).send({ error: "ID de usuário inválido" });
    }

    if (!authenticatedUserId || authenticatedUserId !== userId) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    if (!email || !name) {
      return reply.status(400).send({
        error: "Email e name são obrigatórios",
      });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!existingUser) {
      return reply.status(404).send({ error: "Usuário não encontrado" });
    }

    const duplicatedEmailUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (duplicatedEmailUser && duplicatedEmailUser.id !== userId) {
      return reply.status(409).send({ error: "Email já cadastrado" });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        email,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return reply.send(updatedUser);
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const changePassword = async (request, reply) => {
  try {
    const { id } = request.params;
    const { currentPassword, newPassword } = request.body;

    const userId = parseInt(id, 10);
    const authenticatedUserId = Number(request.user?.id);

    if (Number.isNaN(userId)) {
      return reply.status(400).send({ error: "ID de usuário inválido" });
    }

    if (!authenticatedUserId || authenticatedUserId !== userId) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({
        error: "currentPassword e newPassword são obrigatórios",
      });
    }

    if (newPassword.length < 6) {
      return reply.status(400).send({
        error: "Nova senha deve ter pelo menos 6 caracteres",
      });
    }

    if (currentPassword === newPassword) {
      return reply.status(400).send({
        error: "A nova senha deve ser diferente da senha atual",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, password: true },
    });

    if (!user) {
      return reply.status(404).send({ error: "Usuário não encontrado" });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return reply.status(400).send({ error: "Senha atual incorreta" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
      },
    });

    return reply.send({ message: "Senha alterada com sucesso" });
  } catch (error) {
    console.error("Erro ao alterar senha:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const checkSubscriptionStatus = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = parseInt(id, 10);
    const authenticatedUserId = Number(request.user?.id);

    if (userId !== authenticatedUserId) {
      return reply.status(403).send({ error: "Acesso negado" });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return reply.status(404).send({ error: "Usuário não encontrado" });

    // Se ele já for vitalício ou ativo, apenas retorna o status
    if (user.isLifetime || user.subscriptionStatus === "active") {
      return reply.send(user);
    }

    if (user.stripeCustomerId) {
      // Busca assinaturas no Stripe
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: "all",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const sub = subscriptions.data[0];
        let newStatus = sub.status;
        
        if (newStatus === "trialing" || newStatus === "active") {
          newStatus = "active";
        } else if (newStatus === "past_due") {
          newStatus = "past_due";
        } else if (newStatus === "canceled") {
          newStatus = "canceled";
        }

        const updatedUser = await prisma.user.update({
          where: { id: userId },
          data: {
            subscriptionStatus: newStatus,
            stripeSubscriptionId: sub.id,
            ...(sub.current_period_end ? { subscriptionExpiresAt: new Date(sub.current_period_end * 1000) } : {})
          },
        });
        return reply.send(updatedUser);
      }
    }

    return reply.send(user);
  } catch (error) {
    console.error("Erro ao checar status:", error);
    return reply.status(500).send({ error: "Erro interno" });
  }
};
