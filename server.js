import dotenv from "dotenv";
dotenv.config();

import { fastify } from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors"; // 1. Importe o plugin de CORS
import { userRoutes } from "./src/routes/users.js";
import { clientRoutes } from "./src/routes/clients.js";

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

const server = fastify({
  logger: true,
});

await server.register(fastifyJwt, {
  secret: process.env.JWT_SECRET,
});

await server.register(cors, {
  origin: [
    "http://localhost:5173",
    "https://frontend-loan-production.up.railway.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// Registrar rotas
server.register(userRoutes);
server.register(clientRoutes);

// Health check
server.get("/health", async () => {
  return { status: "ok" };
});

// Iniciar servidor
const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    // Removi o log estático para não confundir o HOST 0.0.0.0 com o link clicável
    server.log.info(`Servidor rodando na porta ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
