import dotenv from "dotenv";
dotenv.config();

import { fastify } from "fastify";
import fastifySocketIO from "fastify-socket.io";
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

// 1. CORS do Fastify (Para as rotas HTTP normais GET, POST, PUT, DELETE)
await server.register(cors, {
  origin: [
    "http://localhost:5173",
    "https://frontend-loan-production.up.railway.app",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

// 2. Registrando o Socket.io e configurando o CORS dele (Exclusivo para o túnel WebSocket)
await server.register(fastifySocketIO, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://frontend-loan-production.up.railway.app",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

// Registrar rotas
await server.register(userRoutes);
await server.register(clientRoutes);

// Health check
server.get("/health", async () => {
  return { status: "ok" };
});

// 3. Ouvinte de conexões do Socket.io (Roda depois que o servidor carrega os plugins)
server.ready().then(() => {
  server.io.on("connection", (socket) => {
    server.log.info(`🟢 Cliente conectado no WebSocket: ${socket.id}`);

    socket.on("disconnect", () => {
      server.log.info(`🔴 Cliente desconectado: ${socket.id}`);
    });
  });
});

// Iniciar servidor
const start = async () => {
  try {
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Servidor rodando na porta ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
