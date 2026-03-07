import { prisma } from "../lib/prisma.js";

// Helper para padronizar a limpeza de dinheiro em todo o backend
const parseMoney = (val) => {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const clean = val.toString().replace(/\./g, "").replace(",", ".");
  return parseFloat(clean) || 0;
};

// HELPER DE DATAS: O Escudo do Fuso Horário
const parseDateSafe = (val) => {
  if (!val || val === "") return null;
  // Se a data chegar no formato padrão "YYYY-MM-DD" do input date,
  // forçamos para meio-dia UTC. Isso impede a alteração de dia no Brasil (-3h).
  if (typeof val === "string" && val.length === 10) {
    return new Date(`${val}T12:00:00Z`);
  }
  return new Date(val);
};

export const createClient = async (request, reply) => {
  try {
    const data = request.body;
    const userId = request.user.id;

    // Usando o novo parseDateSafe
    const baseDate = data.loanDate ? parseDateSafe(data.loanDate) : new Date();

    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        cpf: data.cpf,
        phone: data.phone,
        address: data.address,
        value: parseMoney(data.value),
        valuePaid: parseMoney(data.valuePaid),
        monthlyPaid: parseMoney(data.monthlyPaid),
        loanInterest: parseFloat(data.loanInterest) || 0,
        installments: parseInt(data.installments) || 0,
        installmentsPaid: parseInt(data.installmentsPaid) || 0,
        lateInstallments: parseInt(data.lateInstallments) || 0,
        lastPaymentAmount: parseMoney(data.lastPaymentAmount),

        // Datas blindadas no Create
        loanDate: baseDate,
        lastPaymentDate: parseDateSafe(data.lastPaymentDate),
        nextPaymentDate: parseDateSafe(data.nextPaymentDate),

        observations: data.observations,
        userId,
        monthlyFeePaid: String(data.monthlyFeePaid) === "true",
        totalDebtPaid: String(data.totalDebtPaid) === "true",
      },
    });

    request.server.io.emit("clientesAtualizados");
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
    today.setHours(0, 0, 0, 0);

    const clients = await prisma.client.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });

    const clientsWithAutoStatus = await Promise.all(
      clients.map(async (client) => {
        if (!client.nextPaymentDate) return client;

        const dueDate = new Date(client.nextPaymentDate);
        dueDate.setHours(0, 0, 0, 0);

        // Só considera atrasado se HOJE for MAIOR que o VENCIMENTO
        const isOverdue = today.getTime() > dueDate.getTime();

        let updatedLateInstallments = client.lateInstallments;
        let updatedMonthlyFeePaid = client.monthlyFeePaid;

        if (isOverdue) {
          updatedMonthlyFeePaid = false;

          const yearDiff = today.getFullYear() - dueDate.getFullYear();
          const monthDiff = today.getMonth() - dueDate.getMonth();
          const totalMonthsOverdue = yearDiff * 12 + monthDiff;

          const actualLateCount =
            totalMonthsOverdue <= 0 ? 1 : totalMonthsOverdue;
          updatedLateInstallments = Math.max(
            client.lateInstallments,
            actualLateCount,
          );

          if (
            client.monthlyFeePaid !== updatedMonthlyFeePaid ||
            client.lateInstallments !== updatedLateInstallments
          ) {
            await prisma.client.update({
              where: { id: client.id },
              data: {
                monthlyFeePaid: updatedMonthlyFeePaid,
                lateInstallments: updatedLateInstallments,
              },
            });
          }
        }

        return {
          ...client,
          monthlyFeePaid: updatedMonthlyFeePaid,
          lateInstallments: updatedLateInstallments,
          isDueToday: today.getTime() === dueDate.getTime(), // Flag útil para o filtro
        };
      }),
    );

    return reply.send(clientsWithAutoStatus);
  } catch (error) {
    console.error("Erro ao listar e sincronizar:", error);
    return reply.status(500).send({ error: "Erro interno" });
  }
};

export async function updateClient(request, reply) {
  const { id } = request.params;
  const body = request.body;

  // Removemos campos intrusos que causam erro no Prisma
  const {
    userId,
    createdAt,
    updatedAt,
    isDueToday,
    confirmPayment,
    ...restOfData
  } = body;

  try {
    const safeLoanDate = parseDateSafe(restOfData.loanDate);
    const safeNextDate =
      restOfData.nextPaymentDate !== undefined
        ? parseDateSafe(restOfData.nextPaymentDate)
        : undefined;
    const safeLastDate =
      restOfData.lastPaymentDate !== undefined
        ? parseDateSafe(restOfData.lastPaymentDate)
        : undefined;

    const updatedClient = await prisma.client.update({
      where: { id },
      data: {
        ...restOfData,

        // --- A CORREÇÃO ESTÁ AQUI: CONVERSÃO DE STRINGS PARA NÚMEROS ---
        loanInterest:
          restOfData.loanInterest !== undefined
            ? parseFloat(restOfData.loanInterest) || 0
            : undefined,
        installments:
          restOfData.installments !== undefined
            ? parseInt(restOfData.installments) || 0
            : undefined,
        installmentsPaid:
          restOfData.installmentsPaid !== undefined
            ? parseInt(restOfData.installmentsPaid) || 0
            : undefined,
        lateInstallments:
          restOfData.lateInstallments !== undefined
            ? parseInt(restOfData.lateInstallments) || 0
            : undefined,

        // Datas
        loanDate: safeLoanDate !== null ? safeLoanDate : undefined,
        nextPaymentDate: safeNextDate,
        lastPaymentDate: safeLastDate,

        // Dinheiro (O parseMoney já converte para Number por baixo dos panos)
        value:
          restOfData.value !== undefined
            ? parseMoney(restOfData.value)
            : undefined,
        valuePaid:
          restOfData.valuePaid !== undefined
            ? parseMoney(restOfData.valuePaid)
            : undefined,
        monthlyPaid:
          restOfData.monthlyPaid !== undefined
            ? parseMoney(restOfData.monthlyPaid)
            : undefined,
        lastPaymentAmount:
          restOfData.lastPaymentAmount !== undefined
            ? parseMoney(restOfData.lastPaymentAmount)
            : undefined,

        // Booleans
        monthlyFeePaid:
          restOfData.monthlyFeePaid !== undefined
            ? String(restOfData.monthlyFeePaid) === "true"
            : undefined,
        totalDebtPaid:
          restOfData.totalDebtPaid !== undefined
            ? String(restOfData.totalDebtPaid) === "true"
            : undefined,
      },
    });
    console.log("🔊 Disparando evento WebSocket para os clientes...");

    request.server.io.emit("clientesAtualizados");

    return reply.send(updatedClient);
  } catch (error) {
    console.error("Erro ao atualizar dados no Prisma:", error);
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
    request.server.io.emit("clientesAtualizados");
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

    // Contamos quem tem pelo menos 1 parcela atrasada
    const lateCount = await prisma.client.count({
      where: { userId, lateInstallments: { gt: 0 } },
    });

    // Contamos quem está com 0 parcelas atrasadas
    const onTimeCount = await prisma.client.count({
      where: { userId, lateInstallments: 0 },
    });

    return reply.send([
      { status: "atrasado", value: lateCount, fill: "var(--color-chart-5)" },
      { status: "em-dia", value: onTimeCount, fill: "var(--color-chart-2)" },
    ]);
  } catch (error) {
    return reply.status(500).send({ error: "Erro nas estatísticas" });
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
    const today = new Date();

    // 1. Define o período do Mês Atual
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfThisMonth = new Date(
      today.getFullYear(),
      today.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    // 2. Define o período do Mês Passado (para calcular a porcentagem)
    const startOfLastMonth = new Date(
      today.getFullYear(),
      today.getMonth() - 1,
      1,
    );
    const endOfLastMonth = new Date(
      today.getFullYear(),
      today.getMonth(),
      0,
      23,
      59,
      59,
      999,
    );

    // 3. Busca a soma no banco: Apenas empréstimos com loanDate neste mês
    const currentMonthData = await prisma.client.aggregate({
      _sum: {
        value: true, // Soma o valor total emprestado
      },
      where: {
        loanDate: {
          gte: startOfThisMonth, // Maior ou igual ao 1º dia do mês
          lte: endOfThisMonth, // Menor ou igual ao último dia do mês
        },
      },
    });

    // 4. Busca a soma do mês passado usando a loanDate
    const lastMonthData = await prisma.client.aggregate({
      _sum: {
        value: true,
      },
      where: {
        loanDate: {
          gte: startOfLastMonth,
          lte: endOfLastMonth,
        },
      },
    });

    // Pega os resultados (se for null, vira 0)
    const totalThisMonth = currentMonthData._sum.value || 0;
    const totalLastMonth = lastMonthData._sum.value || 0;

    // 5. Calcula a porcentagem de diferença
    let diffPercentage = 0;
    if (totalLastMonth === 0) {
      // Se mês passado foi 0 e esse mês tem valor, o aumento é de 100%
      diffPercentage = totalThisMonth > 0 ? 100 : 0;
    } else {
      diffPercentage =
        ((totalThisMonth - totalLastMonth) / totalLastMonth) * 100;
    }

    // Retorna exatamente a estrutura que o seu Frontend (React) está esperando
    return reply.send({
      totalOutflow: totalThisMonth,
      diffPercentage: Number(diffPercentage.toFixed(2)),
    });
  } catch (error) {
    console.error("Erro ao calcular saídas totais:", error);
    return reply.status(500).send({ error: "Erro interno no servidor" });
  }
};

export const getTotalReturned = async (request, reply) => {
  try {
    const userId = request.user.id; // Se você usa autenticação por usuário, mantenha!
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Datas para os filtros
    const startCurrent = new Date(currentYear, currentMonth, 1);
    const endCurrent = new Date(currentYear, currentMonth + 1, 1);

    const startLast = new Date(currentYear, currentMonth - 1, 1);
    const endLast = new Date(currentYear, currentMonth, 1);

    // A MUDANÇA ESTÁ AQUI: Filtramos por lastPaymentDate e somamos lastPaymentAmount
    const [currentStats, lastStats] = await Promise.all([
      prisma.client.aggregate({
        where: {
          userId,
          lastPaymentDate: { gte: startCurrent, lt: endCurrent },
        },
        _sum: { lastPaymentAmount: true }, // Soma apenas o dinheiro que entrou no pagamento atual
      }),
      prisma.client.aggregate({
        where: {
          userId,
          lastPaymentDate: { gte: startLast, lt: endLast },
        },
        _sum: { lastPaymentAmount: true },
      }),
    ]);

    // Pegamos o valor da nova soma
    const currentTotal = Number(currentStats._sum.lastPaymentAmount) || 0;
    const lastTotal = Number(lastStats._sum.lastPaymentAmount) || 0;

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
