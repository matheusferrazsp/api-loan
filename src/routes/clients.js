import {
  createClient,
  getClients,
  deleteClient,
  updateClient,
  getAnnualStats,
  getClientsStatusStats,
} from "../controllers/clientController.js";
import { authenticate } from "../middlewares/auth.js";

export async function clientRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/clients", createClient);
  fastify.get("/clients", getClients);
  fastify.delete("/clients/:id", deleteClient);
  fastify.put("/clients/:id", updateClient);
  fastify.get("/dashboard/annual-stats", getAnnualStats);
  fastify.get("/stats/status", getClientsStatusStats);
}
