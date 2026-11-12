import { timingSafeEqual } from "node:crypto";
import { graphConfig } from "../../../config/microsoftGraph";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { GraphSubscriptionStateRepository } from "../../../infra/memory/GraphSubscriptionStateRepository";
import { GraphMessageQueue } from "../../../infra/queue/GraphMessageQueue";

export function matchesSecret(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class ReceiveGraphNotificationUseCase {
  constructor(
    private readonly state: GraphSubscriptionStateRepository,
    private readonly queue: GraphMessageQueue,
  ) {}

  async execute(body: unknown, lifecycle: boolean): Promise<boolean> {
    if (
      !body ||
      typeof body !== "object" ||
      !("value" in body) ||
      !Array.isArray(body.value)
    )
      return false;
    const config = graphConfig();
    let reconcile = false;
    for (const item of body.value as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const n = item as {
        clientState?: unknown;
        tenantId?: unknown;
        subscriptionId?: unknown;
        changeType?: unknown;
        lifecycleEvent?: unknown;
        resourceData?: { id?: unknown };
      };
      const clientStateValido = matchesSecret(n.clientState, config.clientState);
      const subscriptionValida = this.state.matchesSubscription(n.subscriptionId);
      const possuiMessageId =
        typeof n.resourceData?.id === "string" && Boolean(n.resourceData.id);
      console.info("[Graph] Validação", {
        clientStateValido,
        subscriptionValida,
        tipoAlteracao:
          n.changeType === "created" || n.changeType === "updated" || n.changeType === "deleted"
            ? n.changeType
            : null,
        possuiMessageId,
      });
      if (!clientStateValido || !subscriptionValida) continue;
      if (lifecycle) {
        if (
          n.lifecycleEvent === "reauthorizationRequired" ||
          n.lifecycleEvent === "subscriptionRemoved"
        )
          reconcile = true;
        if (n.lifecycleEvent === "missed")
          console.warn(
            "Graph informou notificações perdidas; sincronize a Inbox manualmente",
          );
      } else if (
        n.changeType === "created" &&
        typeof n.resourceData?.id === "string" &&
        n.resourceData.id
      ) {
        await this.queue.enqueue(n.resourceData.id);
      }
    }
    return reconcile;
  }
}
