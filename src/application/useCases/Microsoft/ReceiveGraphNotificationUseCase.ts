import { timingSafeEqual } from "node:crypto";
import { graphConfig } from "../../../config/microsoftGraph";
import { EmailEventRepository } from "../../../infra/memory/EmailEventRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

export function matchesSecret(actual: unknown, expected: string): boolean {
  if (typeof actual !== "string") return false;
  const a = Buffer.from(actual);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

@Injectable()
export class ReceiveGraphNotificationUseCase {
  constructor(private readonly events: EmailEventRepository) {}

  execute(body: unknown, lifecycle: boolean): boolean {
    if (!body || typeof body !== "object" || !("value" in body) || !Array.isArray(body.value)) return false;
    const config = graphConfig();
    let reconcile = false;
    for (const item of body.value as unknown[]) {
      if (!item || typeof item !== "object") continue;
      const n = item as { clientState?: unknown; tenantId?: unknown; changeType?: unknown; lifecycleEvent?: unknown; resourceData?: { id?: unknown } };
      if (!matchesSecret(n.clientState, config.clientState) || n.tenantId !== config.tenantId) continue;
      if (lifecycle) {
        if (n.lifecycleEvent === "reauthorizationRequired" || n.lifecycleEvent === "subscriptionRemoved") reconcile = true;
        if (n.lifecycleEvent === "missed") console.warn("Graph informou notificações perdidas; sincronize a Inbox manualmente");
      } else if (n.changeType === "created" && typeof n.resourceData?.id === "string" && n.resourceData.id) {
        this.events.publish(n.resourceData.id);
      }
    }
    return reconcile;
  }
}
