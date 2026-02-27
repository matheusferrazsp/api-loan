import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import crypto from "node:crypto";
import { resend } from "../lib/mail.js";

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
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
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

    const user = await prisma.user.findUnique({
      where: { id: parseInt(id) },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
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

    // Lógica do token que já fizemos...
    const token = crypto.randomBytes(20).toString("hex");

    // Chamada do Resend (é muito mais simples que o Nodemailer)
    await resend.emails.send({
      from: "sistema@matheusferrazdev.com.br",
      to: email,
      subject: "Redefinição de Senha - LoanX",
      html: `<h1>Olá ${user.name}!</h1> <br>
      <p>Clique no link abaixo para redefinir a sua senha, caso não tenha solicitado ignore este email: <br><br>
      <a href="https://frontend-loan-production.up.railway.app/reset-password?token=${token}">Resetar</a></p>`,
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
          gt: new Date(), // "gt" significa maior que (data atual)
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
        passwordResetToken: null, // Limpa para não usar de novo
        passwordResetExpires: null,
      },
    });

    return reply.send({ message: "Senha atualizada com sucesso!" });
  } catch (error) {
    return reply.status(500).send({ error: "Erro ao atualizar senha." });
  }
};
