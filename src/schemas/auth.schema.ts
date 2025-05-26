import { z } from "zod";

export const registerSchema = z.object({
  nome: z.string().min(1),
  email: z.string().email(),
  senha: z.string().min(6),
});

export const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(6),
});
