import bcrypt from "bcrypt";
import { prisma } from "../lib/prisma.js";
import { transporter } from "../lib/mail.js";

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
      return reply
        .status(200)
        .send({ message: "Se o e-mail existir, um link foi enviado." });
    }

    // Configuração da mensagem
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Redefinição de Senha - LoanX",
      html: `
        <h1>Olá, ${user.name}!</h1>
        <p>Você solicitou a redefinição de senha para sua conta no sistema de empréstimos.</p>
        <p>Clique no link abaixo para criar uma nova senha:</p>
        <a href="http://localhost:5173/reset-password?email=${email}">Redefinir Senha</a>
        <br/><br/>
        <p>Se você não solicitou isso, ignore este e-mail.</p>
      `,
    };

    // Envia o e-mail de verdade
    await transporter.sendMail(mailOptions);

    return reply.status(200).send({ message: "E-mail enviado com sucesso!" });
  } catch (error) {
    console.error("Erro ao enviar e-mail:", error);
    return reply
      .status(500)
      .send({ error: "Erro ao processar envio de e-mail." });
  }
};

export const resetPassword = async (request, reply) => {
  try {
    const { token, password } = request.body;

    // 1. Em um sistema real, você buscaria o usuário pelo token salvo no banco
    // Por enquanto, vamos buscar pelo e-mail (que você pode passar no token/URL)
    const user = await prisma.user.findFirst({
      where: { email: token }, // Simulando que o token é o e-mail para teste rápido
    });

    if (!user) {
      return reply.status(400).send({ error: "Token inválido ou expirado." });
    }

    // 2. Hash da nova senha
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Atualizar no banco
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return reply.send({ message: "Senha atualizada com sucesso!" });
  } catch (error) {
    return reply.status(500).send({ error: "Erro ao atualizar senha." });
  }
};
