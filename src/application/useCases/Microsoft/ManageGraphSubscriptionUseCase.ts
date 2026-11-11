import { graphConfig } from "../../../config/microsoftGraph";
import { GraphSubscriptionRepository } from "../../../infra/microsoft/GraphSubscriptionRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { GraphSubscriptionStateRepository } from "../../../infra/memory/GraphSubscriptionStateRepository";

@Injectable({ singleton: true })
export class ManageGraphSubscriptionUseCase {
  private pending: Promise<undefined> | undefined;
  private renewalRequested = false;
  constructor(private readonly repository: GraphSubscriptionRepository, private readonly state: GraphSubscriptionStateRepository) {}

  async execute(forceRenew = false): Promise<undefined> {
    if (forceRenew) this.renewalRequested = true;
    if (this.pending && forceRenew) {
      await this.pending;
      return await this.execute();
    }
    if (!this.pending) {
      this.pending = this.reconcile();
      try {
        return await this.pending;
      } finally {
        this.pending = undefined;
      }
    }
    return await this.pending;
  }

  private async reconcile(): Promise<undefined> {
    const config = graphConfig();
    const resource = `users/${config.mailboxUserId}/mailFolders('inbox')/messages`;
    const existing = (await this.repository.list()).find(
      (item) =>
        resource.toLowerCase() === item.resource.replace(/^\//, "").toLowerCase() &&
          item.changeType.toLowerCase() === "created",
    );
    if (!existing) {
      this.renewalRequested = false;
      let created;
      try {
        created = await this.repository.create(resource);
      } catch (error) {
        this.renewalRequested = true;
        throw error;
      }
      this.state.setSubscriptionId(created.id);
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
    this.state.setSubscriptionId(existing.id);
    const expiration = Date.parse(existing.expirationDateTime);
    if (!Number.isFinite(expiration))
      throw new Error("Graph retornou data de expiração inválida");
    if (
      this.renewalRequested ||
      expiration - Date.now() < 24 * 60 * 60 * 1000
    ) {
      this.renewalRequested = false;
      let renewed;
      try {
        renewed = await this.repository.renew(existing.id);
      } catch (error) {
        this.renewalRequested = true;
        throw error;
      }
      this.state.setSubscriptionId(renewed.id);
      console.log(
        `Subscription Graph renovada: ${renewed.id}, expira em ${renewed.expirationDateTime}`,
      );
    }
  }
}
