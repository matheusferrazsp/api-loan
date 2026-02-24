import { PrismaClient } from "@prisma/client";

// Instancia o Prisma diretamente.
// Ele vai ler a DATABASE_URL do seu .env automaticamente.
export const prisma = new PrismaClient({
  log: ["error", "warn"],
});

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
