import { Controller } from "../../contracts/Controller";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { ManageGraphSubscriptionUseCase } from "../../useCases/Microsoft/ManageGraphSubscriptionUseCase";
import { ReceiveGraphNotificationUseCase } from "../../useCases/Microsoft/ReceiveGraphNotificationUseCase";

export abstract class BaseGraphWebhookController extends Controller<"public", unknown> {
  constructor(
    private readonly notifications: ReceiveGraphNotificationUseCase,
    private readonly subscriptions: ManageGraphSubscriptionUseCase,
  ) { super(); }

  protected async process(request: Controller.Request<"public">, lifecycle: boolean): Promise<Controller.Response<unknown>> {
    if (typeof request.queryParams.validationToken === "string") {
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        format: "text",
        body: request.queryParams.validationToken,
      };
    }
    if (request.contentType !== "application/json" || !Array.isArray(request.body?.value)) {
      return { statusCode: 400, headers: { "Content-Type": "text/plain; charset=utf-8" }, format: "text", body: "Bad Request" };
    }
    console.info("[Graph] Notificação recebida", {
      tipo: lifecycle ? "lifecycle" : "mensagem",
      quantidade: request.body.value.length,
    });
    if (!lifecycle) {
      try {
        await this.notifications.execute(request.body, false);
      } catch (error) {
        console.error("[Graph] Falha ao enfileirar notificação:", error);
        return { statusCode: 503, headers: { "Content-Type": "text/plain; charset=utf-8" }, format: "text", body: "Service Unavailable" };
      }
    }
    return {
      statusCode: 202,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      format: "text",
      body: "Accepted",
      afterSend: lifecycle ? async () => {
        try {
          const reconcile = await this.notifications.execute(request.body, true);
          if (reconcile) await this.subscriptions.execute(true);
        } catch (error) {
          console.error("Erro ao processar notificação Graph:", error instanceof Error ? error.message : "erro desconhecido");
        }
      } : undefined,
    };
  }
}

@Injectable()
export class GraphWebhookController extends BaseGraphWebhookController {
  constructor(notifications: ReceiveGraphNotificationUseCase, subscriptions: ManageGraphSubscriptionUseCase) {
    super(notifications, subscriptions);
  }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    return await this.process(request, false);
  }
}

@Injectable()
export class GraphLifecycleController extends BaseGraphWebhookController {
  constructor(notifications: ReceiveGraphNotificationUseCase, subscriptions: ManageGraphSubscriptionUseCase) {
    super(notifications, subscriptions);
  }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    return await this.process(request, true);
  }
}
