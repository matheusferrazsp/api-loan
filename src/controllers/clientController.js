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
      monthlyPaid,
      valuePaid,
      loanInterest,
      installments,
      observations,
    } = request.body;

    const userId = request.user.id;

    const nextPaymentDate = new Date();
    nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);

    const client = await prisma.client.create({
      data: {
        name,
        email,
        cpf,
        phone,
        address,
        value: parseFloat(value),
        valuePaid: parseFloat(valuePaid) || 0,
        monthlyPaid: parseFloat(monthlyPaid),
        loanInterest: parseFloat(loanInterest),
        installments: parseInt(installments),
        nextPaymentDate,
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
      orderBy: { name: "asc" },
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

export const getAnnualStats = async (request, reply) => {
  const userId = request.user.id;
  const currentYear = new Date().getFullYear();

  const clients = await prisma.client.findMany({
    where: {
      userId,
      // Filtramos clientes criados no ano atual para o gráfico anual
      createdAt: {
        gte: new Date(`${currentYear}-01-01`),
        lte: new Date(`${currentYear}-12-31`),
      },
    },
    select: {
      value: true, // Saída (O quanto você tirou do bolso)
      valuePaid: true, // Entrada (O quanto já voltou para você)
      createdAt: true,
    },
  });

  const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  const stats = months.map((month, index) => {
    // Agrupamos pelo mês de criação do registro/empréstimo
    const monthData = clients.filter(
      (c) => new Date(c.createdAt).getMonth() === index,
    );

    // Soma convertendo Decimal para Number para o Recharts não bugar
    const exit = monthData.reduce((acc, c) => acc + Number(c.value), 0);
    const entry = monthData.reduce((acc, c) => acc + Number(c.valuePaid), 0);

    return { month, entry, exit };
  });

  return stats;
};

export const getClientsStatusStats = async (request, reply) => {
  try {
    const userId = request.user.id;

    const lateCount = await prisma.client.count({
      where: {
        userId,
        lateInstallments: { gt: 0 },
      },
    });

    const onTimeCount = await prisma.client.count({
      where: {
        userId,
        lateInstallments: 0,
      },
    });

    return reply.send([
      { status: "pendente", value: lateCount, fill: "var(--color-chart-5)" },
      { status: "em-dia", value: onTimeCount, fill: "var(--color-chart-2)" },
    ]);
  } catch (error) {
    console.error("Erro ao obter estatísticas de status dos clientes:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getMonthlySummary = async (request, reply) => {
  try {
    const userId = request.user.id;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    return await prisma.client.aggregate({
      where: {
        userId,
        createdAt: {
          gte: new Date(currentYear, currentMonth, 1),
          lt: new Date(currentYear, currentMonth + 1, 1),
        },
      },
      _sum: {
        value: true,
        valuePaid: true,
      },
    });
  } catch (error) {
    console.error("Erro ao obter resumo mensal:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getTotalLoanInterest = async (request, reply) => {
  try {
    const userId = request.user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Datas do Mês Atual
    const startCurrent = new Date(currentYear, currentMonth, 1);
    const endCurrent = new Date(currentYear, currentMonth + 1, 1);

    // 2. Datas do Mês Passado
    const startLast = new Date(currentYear, currentMonth - 1, 1);
    const endLast = new Date(currentYear, currentMonth, 1);

    // Busca Somas do Mês Atual
    const currentStats = await prisma.client.aggregate({
      where: { userId, createdAt: { gte: startCurrent, lt: endCurrent } },
      _sum: { monthlyPaid: true },
    });

    // Busca Somas do Mês Passado
    const lastStats = await prisma.client.aggregate({
      where: { userId, createdAt: { gte: startLast, lt: endLast } },
      _sum: { monthlyPaid: true },
    });

    const currentTotal = Number(currentStats._sum.monthlyPaid) || 0;
    const lastTotal = Number(lastStats._sum.monthlyPaid) || 0;

    // 3. Cálculo da Diferença Percentual
    let diffPercentage = 0;
    if (lastTotal > 0) {
      diffPercentage = ((currentTotal - lastTotal) / lastTotal) * 100;
    } else if (currentTotal > 0) {
      diffPercentage = 100; // Se não teve nada mês passado, o lucro é 100%
    }

    return reply.send({
      totalInterest: currentTotal,
      diffPercentage: parseFloat(diffPercentage.toFixed(2)),
    });
  } catch (error) {
    console.error(error);
    return reply.status(500).send({ error: "Erro interno" });
  }
};
