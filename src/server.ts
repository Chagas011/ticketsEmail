import "reflect-metadata";
import { app } from "./app";
import { graphConfig } from "./config/microsoftGraph";
import { Registry } from "./kernel/di/Registry";
import { ManageGraphSubscriptionUseCase } from "./application/useCases/Microsoft/ManageGraphSubscriptionUseCase";

const PORT = 3001;

graphConfig();

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  const reconcile = async () => {
    try {
      await Registry.getInstance().resolve(ManageGraphSubscriptionUseCase).execute();
    } catch (error) {
      console.error("Erro ao gerenciar subscription Graph:", error);
    }
  };
  setInterval(reconcile, 15 * 60 * 1000);
  await reconcile();
});
