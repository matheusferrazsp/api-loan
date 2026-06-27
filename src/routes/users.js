import {
  createUser,
  getUsers,
  getUserById,
  updateUserProfile,
  changePassword,
  login,
  forgotPassword,
  resetPassword,
  checkSubscriptionStatus,
} from "../controllers/userController.js";

import { authenticate } from "../middlewares/auth.js";

export async function userRoutes(fastify) {
  fastify.post("/users", createUser);
  fastify.post("/login", login);
  fastify.post("/forgot-password", forgotPassword);
  fastify.post("/reset-password", resetPassword);

  fastify.get("/users", { preHandler: [authenticate] }, getUsers);
  fastify.get("/users/:id", { preHandler: [authenticate] }, getUserById);
  
  fastify.get(
    "/users/:id/status-check",
    { preHandler: [authenticate] },
    checkSubscriptionStatus
  );

  fastify.put("/users/:id", { preHandler: [authenticate] }, updateUserProfile);
  fastify.put(
    "/users/:id/change-password",
    { preHandler: [authenticate] },
    changePassword,
  );
}
