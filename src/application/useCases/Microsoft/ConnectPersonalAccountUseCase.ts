import { Injectable } from "../../../kernel/decorators/Injectable";
import { PersonalGraphAuthRepository } from "../../../infra/microsoft/PersonalGraphAuthRepository";
import { ManageGraphSubscriptionUseCase } from "./ManageGraphSubscriptionUseCase";

@Injectable()
export class ConnectPersonalAccountUseCase {
  constructor(private readonly auth: PersonalGraphAuthRepository, private readonly subscription: ManageGraphSubscriptionUseCase) {}

  start(): string { return this.auth.getAuthorizationUrl(); }
  async finish(state: string, code: string): Promise<void> { await this.auth.completeAuthorization(state, code); }
  reconcile(): Promise<void> { return this.subscription.execute(true); }
  createSession(): string { return this.auth.createSession(); }
}
