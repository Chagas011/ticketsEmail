import { graphConfig } from "../../../config/microsoftGraph";
import { GraphSubscriptionRepository } from "../../../infra/microsoft/GraphSubscriptionRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { PersonalGraphAuthRepository } from "../../../infra/microsoft/PersonalGraphAuthRepository";

@Injectable()
export class ManageGraphSubscriptionUseCase {
  private static pending: Promise<void> | undefined;
  private static renewalRequested = false;
  constructor(private readonly repository: GraphSubscriptionRepository, private readonly auth: PersonalGraphAuthRepository) {}

  execute(forceRenew = false): Promise<void> {
    if (forceRenew) ManageGraphSubscriptionUseCase.renewalRequested = true;
    if (ManageGraphSubscriptionUseCase.pending && forceRenew) {
      return ManageGraphSubscriptionUseCase.pending.then(() => this.execute());
    }
    if (!ManageGraphSubscriptionUseCase.pending) {
      ManageGraphSubscriptionUseCase.pending = this.reconcile().finally(() => {
        ManageGraphSubscriptionUseCase.pending = undefined;
      });
    }
    return ManageGraphSubscriptionUseCase.pending;
  }

  private async reconcile(): Promise<void> {
    const config = graphConfig();
    if (!this.auth.isConnected()) throw new Error("Conecte sua conta Microsoft pessoal primeiro");
    const resource = "me/mailFolders('inbox')/messages";
    const userResource = `users/${this.auth.getUserId()}/mailFolders('inbox')/messages`;
    const existing = (await this.repository.list()).find(
      (item) =>
        [resource.toLowerCase(), userResource.toLowerCase()].includes(item.resource.replace(/^\//, "").toLowerCase()) &&
          item.changeType.toLowerCase() === "created",
    );
    if (!existing) {
      ManageGraphSubscriptionUseCase.renewalRequested = false;
      let created;
      try {
        created = await this.repository.create(resource);
      } catch (error) {
        ManageGraphSubscriptionUseCase.renewalRequested = true;
        throw error;
      }
      this.auth.setSubscriptionId(created.id);
      console.log(
        `Subscription Graph criada: ${created.id}, expira em ${created.expirationDateTime}`,
      );
      return;
    }
    if (
      existing.notificationUrl !== config.notificationUrl ||
      existing.lifecycleNotificationUrl !== config.lifecycleUrl
    ) {
      throw new Error(
        "Subscription existente usa outras URLs; remova-a no Graph antes de alterar GRAPH_PUBLIC_URL",
      );
    }
    this.auth.setSubscriptionId(existing.id);
    const expiration = Date.parse(existing.expirationDateTime);
    if (!Number.isFinite(expiration))
      throw new Error("Graph retornou data de expiração inválida");
    if (
      ManageGraphSubscriptionUseCase.renewalRequested ||
      expiration - Date.now() < 24 * 60 * 60 * 1000
    ) {
      ManageGraphSubscriptionUseCase.renewalRequested = false;
      let renewed;
      try {
        renewed = await this.repository.renew(existing.id);
      } catch (error) {
        ManageGraphSubscriptionUseCase.renewalRequested = true;
        throw error;
      }
      this.auth.setSubscriptionId(renewed.id);
      console.log(
        `Subscription Graph renovada: ${renewed.id}, expira em ${renewed.expirationDateTime}`,
      );
    }
  }
}
