import { prisma } from "../lib/prisma.js";

export const createClient = async (request, reply) => {
  try {
    const {
      name,
      email,
      cpf,
      phone,
      address,
      value,
      loanInterest,
      installments,
      observations,
    } = request.body;

    const userId = request.user.id;

    const client = await prisma.client.create({
      data: {
        name,
        email,
        cpf,
        phone,
        address,
        value: parseFloat(value),
        loanInterest: parseFloat(loanInterest),
        installments: parseInt(installments),
        observations,
        userId,
      },
    });

    return reply.status(201).send(client);
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getClients = async (request, reply) => {
  try {
    const userId = request.user.id;

    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return reply.send(clients);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};
