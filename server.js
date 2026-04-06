import dotenv from "dotenv";
dotenv.config();

import { fastify } from "fastify";
import fastifyJwt from "@fastify/jwt";
import cors from "@fastify/cors";
import { Server } from "socket.io";
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
    "https://veroflux.com.br",
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
});

await server.register(userRoutes);
await server.register(clientRoutes);

server.get("/health", async () => {
  return { status: "ok" };
});

// --- A MUDANÇA ESTÁ AQUI: SETUP DO SOCKET.IO ANTES DO LISTEN ---

// 1. Instanciamos o Socket.io no servidor HTTP raiz
const io = new Server(server.server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "https://frontend-loan-production.up.railway.app",
      "https://veroflux.com.br",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  },
});

// 2. Injetamos o "io" no Fastify ANTES do servidor ligar
server.decorate("io", io);

// 3. Ouvinte de conexões
io.on("connection", (socket) => {
  server.log.info(`🟢 Cliente conectado no WebSocket: ${socket.id}`);

  socket.on("disconnect", () => {
    server.log.info(`🔴 Cliente desconectado: ${socket.id}`);
  });
});

// --- FIM DO SETUP DO SOCKET.IO ---

const start = async () => {
  try {
    // 4. Agora sim, ligamos a porta!
    await server.listen({ port: PORT, host: HOST });
    server.log.info(`Servidor rodando na porta ${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
