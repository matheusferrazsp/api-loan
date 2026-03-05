import { prisma } from "../lib/prisma.js";

export const createClient = async (request, reply) => {
  try {
    const data = request.body;
    const userId = request.user.id;

    // Função interna para limpar máscara (ex: "1.250,50" -> 1250.50)
    const parseMoney = (val) => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      // Remove todos os pontos e troca a vírgula por ponto
      const clean = val.toString().replace(/\./g, "").replace(",", ".");
      return parseFloat(clean) || 0;
    };

    const baseDate = data.loanDate ? new Date(data.loanDate) : new Date();

    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        address: data.address,
        // Limpando os valores financeiros
        value: parseMoney(data.value),
        valuePaid: parseMoney(data.valuePaid),
        monthlyPaid: parseMoney(data.monthlyPaid),
        loanInterest: parseFloat(data.loanInterest) || 0, // Juros costuma ser número simples
        installments: parseInt(data.installments) || 0,
        installmentsPaid: parseInt(data.installmentsPaid) || 0,
        lateInstallments: parseInt(data.lateInstallments) || 0,
        lastPaymentAmount: parseMoney(data.lastPaymentAmount),

        // Tratamento de Datas
        loanDate: baseDate,
        lastPaymentDate: data.lastPaymentDate
          ? new Date(data.lastPaymentDate)
          : null,
        nextPaymentDate: data.nextPaymentDate
          ? new Date(data.nextPaymentDate)
          : null,

        observations: data.observations,
        userId,

        // Convertendo status de string para boolean (caso venha como string do form)
        monthlyFeePaid: String(data.monthlyFeePaid) === "true",
        totalDebtPaid: String(data.totalDebtPaid) === "true",
      },
    });

    return reply.status(201).send(client);
  } catch (error) {
    console.error("Erro ao cadastrar cliente:", error);
    return reply
      .status(500)
      .send({ error: "Erro interno do servidor", details: error.message });
  }
};

export const getClients = async (request, reply) => {
  try {
    const userId = request.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Zera as horas para comparação justa de datas

    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    // Mapeamos os clientes para injetar a lógica de atraso automática
    const clientsWithAutoStatus = clients.map((client) => {
      if (!client.nextPaymentDate) return client;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dueDate = new Date(client.nextPaymentDate);
      dueDate.setHours(0, 0, 0, 0);

      // Se a data de vencimento é menor que hoje
      const isOverdue = today.getTime() > dueDate.getTime();

      let updatedLateInstallments = client.lateInstallments;
      let updatedMonthlyFeePaid = client.monthlyFeePaid;

      if (isOverdue) {
        // 1. Forçamos o status visual para "Atrasado" (false)
        updatedMonthlyFeePaid = false;

        // 2. Calculamos a diferença de meses entre o vencimento e hoje

        const yearDiff = today.getFullYear() - dueDate.getFullYear();
        const monthDiff = today.getMonth() - dueDate.getMonth();
        const totalMonthsOverdue = yearDiff * 12 + monthDiff;

        // Se a diferença for 0 (venceu ontem, por exemplo), garantimos pelo menos 1 parcela
        const actualLateCount =
          totalMonthsOverdue <= 0 ? 1 : totalMonthsOverdue;

        // Atualizamos o contador apenas se o cálculo for maior que o registrado
        // Isso evita que o número diminua caso você tenha alterado manualmente
        updatedLateInstallments = Math.max(
          client.lateInstallments,
          actualLateCount,
        );
      } else {
        updatedMonthlyFeePaid = client.monthlyFeePaid;
      }

      return {
        ...client,
        monthlyFeePaid: updatedMonthlyFeePaid,
        lateInstallments: updatedLateInstallments,
      };
    });

    return reply.send(clientsWithAutoStatus);
  } catch (error) {
    console.error("Erro ao listar clientes:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export async function updateClient(request, reply) {
  const { id } = request.params;
  const data = request.body;

  const parseMoney = (val) => {
    if (!val) return 0;
    if (typeof val === "number") return val;
    const clean = val.toString().replace(/\./g, "").replace(",", ".");
    return parseFloat(clean) || 0;
  };

  try {
    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        ...data,
        // Garantindo que campos financeiros sejam processados corretamente
        value: data.value ? parseMoney(data.value) : undefined,
        valuePaid: data.valuePaid ? parseMoney(data.valuePaid) : undefined,
        monthlyPaid: data.monthlyPaid
          ? parseMoney(data.monthlyPaid)
          : undefined,
        lastPaymentAmount: data.lastPaymentAmount
          ? parseMoney(data.lastPaymentAmount)
          : undefined,

        // Conversão de booleans
        monthlyFeePaid:
          data.monthlyFeePaid !== undefined
            ? String(data.monthlyFeePaid) === "true"
            : undefined,
        totalDebtPaid:
          data.totalDebtPaid !== undefined
            ? String(data.totalDebtPaid) === "true"
            : undefined,

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
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
    );

    const entries = await prisma.client.aggregate({
      where: {
        userId,
        monthlyFeePaid: true,
        lastPaymentDate: {
          gte: firstDay,
          lte: lastDay,
        },
      },
      _sum: {
        lastPaymentAmount: true,
      },
    });

    const outflows = await prisma.client.aggregate({
      where: {
        userId,
        loanDate: {
          gte: firstDay,
          lte: lastDay,
        },
      },
      _sum: {
        value: true,
      },
    });

    return reply.send({
      totalIn: Number(entries._sum.lastPaymentAmount) || 0,
      totalOut: Number(outflows._sum.value) || 0,
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

export const getTotalOutflow = async (request, reply) => {
  try {
    const userId = request.user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Períodos de comparação
    const startCurrent = new Date(currentYear, currentMonth, 1);
    const endCurrent = new Date(currentYear, currentMonth + 1, 1);
    const startLast = new Date(currentYear, currentMonth - 1, 1);
    const endLast = new Date(currentYear, currentMonth, 1);

    // Soma das saídas (capital emprestado)
    const [currentStats, lastStats] = await Promise.all([
      prisma.client.aggregate({
        where: { userId, createdAt: { gte: startCurrent, lt: endCurrent } },
        _sum: { value: true },
      }),
      prisma.client.aggregate({
        where: { userId, createdAt: { gte: startLast, lt: endLast } },
        _sum: { value: true },
      }),
    ]);

    const currentTotal = Number(currentStats._sum.value) || 0;
    const lastTotal = Number(lastStats._sum.value) || 0;

    // Cálculo da porcentagem
    let diffPercentage = 0;
    if (lastTotal > 0) {
      diffPercentage = ((currentTotal - lastTotal) / lastTotal) * 100;
    } else if (currentTotal > 0) {
      diffPercentage = 100;
    }

    return reply.send({
      totalOutflow: currentTotal,
      diffPercentage: parseFloat(diffPercentage.toFixed(2)),
    });
  } catch (error) {
    console.error("Erro ao obter saídas:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getTotalReturned = async (request, reply) => {
  try {
    const userId = request.user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Datas para os filtros
    const startCurrent = new Date(currentYear, currentMonth, 1);
    const endCurrent = new Date(currentYear, currentMonth + 1, 1);
    const startLast = new Date(currentYear, currentMonth - 1, 1);
    const endLast = new Date(currentYear, currentMonth, 1);

    // Executa as somas do que foi pago (valuePaid)
    const [currentStats, lastStats] = await Promise.all([
      prisma.client.aggregate({
        where: { userId, createdAt: { gte: startCurrent, lt: endCurrent } },
        _sum: { valuePaid: true },
      }),
      prisma.client.aggregate({
        where: { userId, createdAt: { gte: startLast, lt: endLast } },
        _sum: { valuePaid: true },
      }),
    ]);

    const currentTotal = Number(currentStats._sum.valuePaid) || 0;
    const lastTotal = Number(lastStats._sum.valuePaid) || 0;

    // Cálculo da diferença percentual
    let diffPercentage = 0;
    if (lastTotal > 0) {
      diffPercentage = ((currentTotal - lastTotal) / lastTotal) * 100;
    } else if (currentTotal > 0) {
      diffPercentage = 100;
    }

    return reply.send({
      totalReturned: currentTotal,
      diffPercentage: parseFloat(diffPercentage.toFixed(2)),
    });
  } catch (error) {
    console.error("Erro ao obter total devolvido:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};

export const getTotalCirculating = async (request, reply) => {
  try {
    const userId = request.user.id;
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // 1. Soma apenas de clientes que AINDA NÃO QUITARAM (Circulando hoje)
    const totalStats = await prisma.client.aggregate({
      where: {
        userId,
        totalDebtPaid: false, // Filtro crucial: remove quem já quitou tudo
      },
      _sum: {
        value: true,
      },
    });

    // 2. Para a comparação, pegamos o que circulava até o mês passado
    const lastMonthLimit = new Date(currentYear, currentMonth, 1);
    const lastMonthStats = await prisma.client.aggregate({
      where: {
        userId,
        totalDebtPaid: false, // Mantemos o critério de dívida ativa
        createdAt: { lt: lastMonthLimit },
      },
      _sum: {
        value: true,
      },
    });

    // Cálculo: O que foi emprestado (-) o que já foi devolvido parcial/totalmente
    const currentCirculating = Number(totalStats._sum.value) || 0;

    const lastCirculating = Number(lastMonthStats._sum.value) || 0;

    let diffPercentage = 0;
    if (lastCirculating > 0) {
      diffPercentage =
        ((currentCirculating - lastCirculating) / lastCirculating) * 100;
    } else if (currentCirculating > 0) {
      diffPercentage = 100;
    }

    return reply.send({
      totalCirculating: currentCirculating,
      diffPercentage: parseFloat(diffPercentage.toFixed(2)),
    });
  } catch (error) {
    console.error("Erro ao obter total circulando:", error);
    return reply.status(500).send({ error: "Erro interno do servidor" });
  }
};
