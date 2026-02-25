import {
  createClient,
  getClients,
  deleteClient,
  updateClient,
} from "../controllers/clientController.js";
import { authenticate } from "../middlewares/auth.js";

export async function clientRoutes(fastify) {
  fastify.addHook("preHandler", authenticate);

  fastify.post("/clients", createClient);
  fastify.get("/clients", getClients);
  fastify.delete("/clients/:id", deleteClient);
  fastify.put("/clients/:id", updateClient);
}
