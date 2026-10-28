import "reflect-metadata";
import { app } from "./app";
import { graphConfig } from "./config/microsoftGraph";
import { Registry } from "./kernel/di/Registry";
import { ManageGraphSubscriptionUseCase } from "./application/useCases/Microsoft/ManageGraphSubscriptionUseCase";

const PORT = 3001;

graphConfig();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const reconcile = () => {
    void Registry.getInstance().resolve(ManageGraphSubscriptionUseCase).execute().catch((error: unknown) => console.error("Erro ao gerenciar subscription Graph:", error));
  };
  reconcile();
  setInterval(reconcile, 15 * 60 * 1000);
});
