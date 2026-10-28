import type { Request, Response } from "express";
import { Registry } from "../../../kernel/di/Registry";
import { ReceiveGraphNotificationUseCase } from "../../useCases/Microsoft/ReceiveGraphNotificationUseCase";
import { ManageGraphSubscriptionUseCase } from "../../useCases/Microsoft/ManageGraphSubscriptionUseCase";

export class GraphWebhookController {
  static handle(lifecycle: boolean) {
    return (request: Request, response: Response): void => {
      if (typeof request.query.validationToken === "string") {
        response.status(200).type("text/plain").send(request.query.validationToken);
        return;
      }
      if (!request.is("application/json") || !Array.isArray(request.body?.value)) {
        response.sendStatus(400);
        return;
      }
      const reconcile = Registry.getInstance().resolve(ReceiveGraphNotificationUseCase).execute(request.body, lifecycle);
      response.sendStatus(202);
      if (reconcile) {
        void Registry.getInstance().resolve(ManageGraphSubscriptionUseCase).execute(true).catch((error: unknown) => console.error("Erro ao recuperar subscription Graph:", error));
      }
    };
  }
}
