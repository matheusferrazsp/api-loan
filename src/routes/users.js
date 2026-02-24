import {
  createUser,
  getUsers,
  getUserById,
  login,
  forgotPassword,
  resetPassword,
} from "../controllers/userController.js";

export async function userRoutes(fastify) {
  fastify.post("/users", createUser);
  fastify.get("/users", getUsers);
  fastify.get("/users/:id", getUserById);
  fastify.post("/login", login);
  fastify.post("/forgot-password", forgotPassword);
  fastify.post("/reset-password", resetPassword);
}
