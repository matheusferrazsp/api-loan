import {
  createClient,
  getClients,
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
} from "../controllers/clientController.js";
import {
  createPayment,
  getPayments,
  deletePayment,
} from "../controllers/paymentController.js";
import { authenticate } from "../middlewares/auth.js";

export async function clientRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/clients", createClient);
  fastify.get("/clients", getClients);
  fastify.delete("/clients/:id", deleteClient);
  fastify.put("/clients/:id", updateClient);
  fastify.get("/dashboard/annual-stats", getAnnualStats);
  fastify.get("/stats/status", getClientsStatusStats);
  fastify.get("/dashboard/monthly-summary", getMonthlySummary);
  fastify.get("/dashboard/total-loan-interest", getTotalLoanInterest);
  fastify.get("/dashboard/total-outflow", getTotalOutflow);
  fastify.get("/dashboard/total-returned", getTotalReturned);
  fastify.get("/dashboard/total-circulating", getTotalCirculating);
  fastify.get("/dashboard/paid-off", getTotalLoanValuePaidOff);

  // Rotas de Pagamentos
  fastify.post("/clients/:id/payments", createPayment);
  fastify.get("/clients/:id/payments", getPayments);
  fastify.delete("/clients/:id/payments/:paymentId", deletePayment);
}
