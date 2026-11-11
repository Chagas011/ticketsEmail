import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { GetGraphMessageUseCase } from "../../useCases/Microsoft/GetGraphMessageUseCase";
import { Controller } from "@/application/contracts/Controller";

@Injectable()
export class GraphMessageController extends Controller<"public", GraphMessageController.Response> {
  constructor(private readonly messages: GetGraphMessageUseCase) {
    super();
  }

  protected async handle(
    request: Controller.Request<"public">,
  ): Promise<Controller.Response<GraphMessageController.Response>> {
    const headers = { "Cache-Control": "no-store" };
    const messageId = request.params.messageId;
    if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 4096) {
      return { statusCode: 400, headers, body: { message: "ID da mensagem inválido." } };
    }

    try {
      const message = await this.messages.execute(messageId);
      return { statusCode: 200, headers, body: message };
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        return { statusCode: 404, headers, body: { message: "Mensagem não encontrada ou não está mais disponível." } };
      }
      console.error("[Graph] Falha ao consultar mensagem:", error instanceof Error ? error.message : "erro desconhecido");
      return { statusCode: 502, headers, body: { message: "Não foi possível buscar a mensagem no Microsoft Graph." } };
    }
  }
}

export namespace GraphMessageController {
  export type Response = Awaited<ReturnType<GetGraphMessageUseCase["execute"]>>;
}
