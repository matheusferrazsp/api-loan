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

    console.log("Clientes no banco:", clients);

    return reply.send(clients);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export async function updateClient(request, reply) {
  const { id } = request.params;
  const data = request.body;

  try {
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        userId: request.user.id,
      },
    });

    return reply.send(updatedClient);
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Erro ao atualizar cliente" });
  }
}

export const deleteClient = async (request, reply) => {
  try {
    const { id } = request.params;
    const userId = request.user.id;

    const client = await prisma.client.findFirst({
      where: { id, userId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Cliente não encontrado" });
    }

    await prisma.client.delete({
      where: { id },
    });

    return reply.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};
