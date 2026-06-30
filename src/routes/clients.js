import {
  createClient,
  getClients,
  getDelinquentClients,
  deleteClient,
  updateClient,
  getAnnualStats,
  getClientsStatusStats,
  getMonthlySummary,
  getTotalLoanInterest,
  getTotalOutflow,
  getTotalReturned,
  getTotalCirculating,
  getTotalLoanValuePaidOff,
  getPendingReceipts,
} from "../controllers/clientController.js";
import {
  createPayment,
  getPayments,
  deletePayment,
} from "../controllers/paymentController.js";
import { authenticate, requireActiveSubscription } from "../middlewares/auth.js";

export async function clientRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);
  // O hook global de requireActiveSubscription foi removido para permitir leitura

  // Rotas GET (Leitura) - Liberadas
  fastify.get("/clients", getClients);
  fastify.get("/clients/delinquent", getDelinquentClients);
  fastify.get("/dashboard/annual-stats", getAnnualStats);
  fastify.get("/stats/status", getClientsStatusStats);
  fastify.get("/dashboard/monthly-summary", getMonthlySummary);
  fastify.get("/dashboard/total-loan-interest", getTotalLoanInterest);
  fastify.get("/dashboard/total-outflow", getTotalOutflow);
  fastify.get("/dashboard/total-returned", getTotalReturned);
  fastify.get("/dashboard/total-circulating", getTotalCirculating);
  fastify.get("/dashboard/paid-off", getTotalLoanValuePaidOff);
  fastify.get("/dashboard/pending-receipts", getPendingReceipts);
  fastify.get("/clients/:id/payments", getPayments);

  // Rotas de Mutação (POST, PUT, DELETE) - Bloqueadas para inadimplentes/pendentes
  fastify.post("/clients", { preHandler: [requireActiveSubscription] }, createClient);
  fastify.delete("/clients/:id", { preHandler: [requireActiveSubscription] }, deleteClient);
  fastify.put("/clients/:id", { preHandler: [requireActiveSubscription] }, updateClient);
  
  fastify.post("/clients/:id/payments", { preHandler: [requireActiveSubscription] }, createPayment);
  fastify.delete("/clients/:id/payments/:paymentId", { preHandler: [requireActiveSubscription] }, deletePayment);
}
