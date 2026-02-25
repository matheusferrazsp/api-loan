import {
  createUser,
  getUsers,
  getUserById,
  login,
  forgotPassword,
  resetPassword,
} from "../controllers/userController.js";

import { authenticate } from "../middlewares/auth.js";

export async function userRoutes(fastify) {
  fastify.post("/users", createUser);
  fastify.post("/login", login);
  fastify.post("/forgot-password", forgotPassword);
  fastify.post("/reset-password", resetPassword);

  fastify.get("/users", { preHandler: [authenticate] }, getUsers);
  fastify.get("/users/:id", { preHandler: [authenticate] }, getUserById);
}
