import "dotenv/config";
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["hmlg", "prod"]).default("hmlg"),

  PORT: z.coerce.number().default(3000),

  DB_HOST: z.string(),

  DB_PORT: z.coerce.number().default(1521),

  DB_USER: z.string(),

  DB_PASSWORD: z.string(),

  DB_SERVICE_NAME: z.string(),

  ORACLE_CLIENT_LIB_DIR: z.string().default("/opt/oracle/instantclient"),
});

export const env = envSchema.parse(process.env);
