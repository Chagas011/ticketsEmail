import { env } from "@/shared/config/env";
import "reflect-metadata";
import { DataSource } from "typeorm";
import { UsuarioEntity } from "./entities/UsuarioEntity";
import { TicketEntity } from "./entities/TicketEntity";
import { GrupoAtendimentoEntity } from "./entities/GrupoAtendimentoEntity";

export const AppDataSource = new DataSource({
  type: "oracle",

  host: env.DB_HOST,
  port: Number(env.DB_PORT ?? 1521),

  username: env.DB_USER,
  password: env.DB_PASSWORD,

  serviceName: env.DB_SERVICE_NAME,

  entities: [UsuarioEntity, TicketEntity, GrupoAtendimentoEntity],

  synchronize: false,
  logging: false,
});
