import "reflect-metadata";
import { app } from "./app";
import { graphConfig } from "./config/microsoftGraph";
import { Registry } from "./kernel/di/Registry";
import { ManageGraphSubscriptionUseCase } from "./application/useCases/Microsoft/ManageGraphSubscriptionUseCase";
import { PersonalGraphAuthRepository } from "./infra/microsoft/PersonalGraphAuthRepository";

const PORT = 3001;

const config = graphConfig();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  const reconcile = () => {
    if (!Registry.getInstance().resolve(PersonalGraphAuthRepository).isConnected()) return;
    void Registry.getInstance().resolve(ManageGraphSubscriptionUseCase).execute().catch((error: unknown) => console.error("Erro ao gerenciar subscription Graph:", error));
  };
  console.log("Aguardando conexão da conta Microsoft pessoal.");
  if (process.env.MICROSOFT_CONNECT_UI === "true") {
    Registry.getInstance().resolve(PersonalGraphAuthRepository).getAuthorizationUrl();
    console.log(`Conecte a conta em: ${config.redirectUrl.replace(/\/oauth\/callback$/, "/connect")}`);
  }
  setInterval(reconcile, 15 * 60 * 1000);
});
