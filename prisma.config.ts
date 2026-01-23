import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasource: {
    provider: "postgresql",
  },

  migrations: {
    path: "prisma/migrations",
    url: env("DATABASE_URL"),
  },
});
