import dotenv from "dotenv";
dotenv.config();

import { fastify } from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { Server } from "socket.io"; // 1. Importa o Socket.io puro
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

// CORS do Fastify
await server.register(cors, {
  origin: [
    "http://localhost:5173",
    "https://frontend-loan-production.up.railway.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// Registrar rotas
await server.register(userRoutes);
await server.register(clientRoutes);

// Health check
server.get("/health", async () => {
  return { status: "ok" };
});

const start = async () => {
  try {
    // 2. Primeiro inicializamos as portas e o servidor HTTP interno
    await server.listen({ port: PORT, host: HOST });

    // 3. Plugamos o Socket.io diretamente no servidor HTTP raiz do Fastify
    const io = new Server(server.server, {
      cors: {
        origin: [
          "http://localhost:5173",
          "https://frontend-loan-production.up.railway.app",
        ],
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        credentials: true,
      },
    });

    // 4. Injetamos o "io" no Fastify para que os seus Controllers continuem usando request.server.io.emit
    server.decorate("io", io);

    // 5. O ouvinte de conexões
    io.on("connection", (socket) => {
      server.log.info(`🟢 Cliente conectado no WebSocket: ${socket.id}`);

      socket.on("disconnect", () => {
        server.log.info(`🔴 Cliente desconectado: ${socket.id}`);
      });
    });

    server.log.info(`Servidor rodando na porta ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
