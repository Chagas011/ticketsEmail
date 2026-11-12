import "reflect-metadata";
import "dotenv/config";
import { GraphMessageWorker } from "./application/workers/GraphMessageWorker";
import { graphConfig } from "./config/microsoftGraph";
import { initializeOracle } from "./infra/database/oracle/oracle";
import { AppDataSource } from "./infra/database/typeorm/data-source";
import { Registry } from "./kernel/di/Registry";

async function start() {
  graphConfig();
  initializeOracle();
  await AppDataSource.initialize();
  await Registry.getInstance().resolve(GraphMessageWorker).start();
}

start().catch((error) => {
  console.error("[Graph] Falha ao iniciar worker", error);
  process.exitCode = 1;
});
