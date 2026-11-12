import "reflect-metadata";
import { app } from "./app";
import { ManageGraphSubscriptionUseCase } from "./application/useCases/Microsoft/ManageGraphSubscriptionUseCase";
import { graphConfig } from "./config/microsoftGraph";
import { initializeOracle } from "./infra/database/oracle/oracle";
import { AppDataSource } from "./infra/database/typeorm/data-source";
import { GraphMessageCompletionSubscriber } from "./infra/queue/GraphMessageCompletionSubscriber";
import { Registry } from "./kernel/di/Registry";

const PORT = 3001;

graphConfig();

async function start() {
  initializeOracle();

  console.log("✅ Oracle Client (Thick Mode) inicializado.");

  // 2. Conexão com o Banco de Dados
  await AppDataSource.initialize();
  console.log(
    "✅ Conexão com o banco de dados Oracle estabelecida com sucesso!",
  );

  await Registry.getInstance()
    .resolve(GraphMessageCompletionSubscriber)
    .start();
  app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    const reconcile = async () => {
      try {
        await Registry.getInstance()
          .resolve(ManageGraphSubscriptionUseCase)
          .execute();
      } catch (error) {
        console.error("Erro ao gerenciar subscription Graph:", error);
      }
    };
    setInterval(reconcile, 15 * 60 * 1000);
    await reconcile();
  });
}

start().catch((error) => {
  console.error("Erro ao iniciar a API:", error);
  process.exitCode = 1;
});
