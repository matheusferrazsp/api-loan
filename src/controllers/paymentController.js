import { prisma } from "../lib/prisma.js";

const parseMoney = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const clean = val.toString().replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

const parseDateSafe = (val) => {
  if (!val || val === "") return null;
  if (typeof val === "string" && val.length === 10) {
    return new Date(`${val}T12:00:00Z`);
  }
  return new Date(val);
};

// POST /clients/:id/payments
export const createPayment = async (request, reply) => {
  try {
    const { id: clientId } = request.params;
    const userId = request.user.id;
    const { amount, date, note } = request.body;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Cliente não encontrado" });
    }

    const parsedAmount = parseMoney(amount);
    const parsedDate = parseDateSafe(date);

    if (!parsedAmount || parsedAmount <= 0) {
      return reply.status(400).send({ error: "Valor do pagamento inválido" });
    }

    if (!parsedDate) {
      return reply.status(400).send({ error: "Data do pagamento inválida" });
    }

    // Cria o registro de pagamento e atualiza o cliente em uma transação atômica
    const [payment] = await prisma.$transaction([
      prisma.payment.create({
        data: {
          amount: parsedAmount,
          date: parsedDate,
          note: note || null,
          clientId,
        },
      }),
      prisma.client.update({
        where: { id: clientId },
        data: {
          valuePaid: { increment: parsedAmount },
          lastPaymentAmount: parsedAmount,
          lastPaymentDate: parsedDate,
          installmentsPaid: { increment: 1 },
          monthlyFeePaid: true,
        },
      }),
    ]);

    request.server.io.emit("clientesAtualizados");
    return reply.status(201).send(payment);
  } catch (error) {
    console.error("Erro ao registrar pagamento:", error);
    return reply
      .status(500)
      .send({ error: "Erro interno do servidor", details: error.message });
  }
};

// GET /clients/:id/payments
export const getPayments = async (request, reply) => {
  try {
    const { id: clientId } = request.params;
    const userId = request.user.id;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Cliente não encontrado" });
    }

    const payments = await prisma.payment.findMany({
      where: { clientId },
      orderBy: { date: "desc" },
    });

    return reply.send(payments);
  } catch (error) {
    console.error("Erro ao listar pagamentos:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

// DELETE /clients/:id/payments/:paymentId
export const deletePayment = async (request, reply) => {
  try {
    const { id: clientId, paymentId } = request.params;
    const userId = request.user.id;

    const client = await prisma.client.findFirst({
      where: { id: clientId, userId },
    });

    if (!client) {
      return reply.status(404).send({ error: "Cliente não encontrado" });
    }

    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, clientId },
    });

    if (!payment) {
      return reply.status(404).send({ error: "Pagamento não encontrado" });
    }

    // Busca o pagamento mais recente que restará após a deleção para restaurar os dados no cliente
    const previousPayment = await prisma.payment.findFirst({
      where: {
        clientId,
        id: { not: paymentId },
      },
      orderBy: { date: "desc" },
    });

    await prisma.$transaction([
      prisma.payment.delete({ where: { id: paymentId } }),
      prisma.client.update({
        where: { id: clientId },
        data: {
          valuePaid: { decrement: Number(payment.amount) },
          installmentsPaid: { decrement: 1 },
          lastPaymentAmount: previousPayment
            ? Number(previousPayment.amount)
            : 0,
          lastPaymentDate: previousPayment ? previousPayment.date : null,
        },
      }),
    ]);

    request.server.io.emit("clientesAtualizados");
    return reply.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar pagamento:", error);
    return reply
      .status(500)
      .send({ error: "Erro interno do servidor", details: error.message });
  }
};
