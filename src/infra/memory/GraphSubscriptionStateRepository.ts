import { Injectable } from "../../kernel/decorators/Injectable";

@Injectable({ singleton: true })
export class GraphSubscriptionStateRepository {
  private subscriptionId: string | undefined;

  setSubscriptionId(id: string) {
    this.subscriptionId = id;
  }

  matchesSubscription(id: unknown): boolean {
    return typeof id === "string" && id === this.subscriptionId;
  }
}
