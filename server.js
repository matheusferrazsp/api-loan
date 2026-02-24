import dotenv from "dotenv";
dotenv.config();

import { fastify } from "fastify";
import cors from "@fastify/cors"; // 1. Importe o plugin de CORS
import { userRoutes } from "./src/routes/users.js";

const PORT = process.env.PORT || 3333;
const HOST = process.env.HOST || "0.0.0.0";

const server = fastify({
  logger: true,
});

// 2. Registre o CORS antes de qualquer rota
// "origin: true" permite que seu front-end local acesse a API sem restrições
await server.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// Registrar rotas
server.register(userRoutes, { prefix: "/api" });

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
