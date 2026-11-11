import { Controller } from "../../contracts/Controller";
import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { GetGraphConversationUseCase } from "../../useCases/Microsoft/GetGraphConversationUseCase";

@Injectable()
export class GraphConversationController extends Controller<"public", unknown> {
  constructor(private readonly conversations: GetGraphConversationUseCase) { super(); }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    const headers = { "Cache-Control": "no-store" };
    const conversationId = request.params.conversationId;
    if (typeof conversationId !== "string" || !conversationId.trim() || conversationId.length > 4096) {
      return { statusCode: 400, headers, body: { message: "ID da conversa inválido." } };
    }

    try {
      const conversation = await this.conversations.execute(conversationId);
      return { statusCode: 200, headers, body: conversation };
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        return { statusCode: 404, headers, body: { message: "Conversa não encontrada ou indisponível." } };
      }
      console.error("[Graph] Falha ao consultar conversa:", error instanceof Error ? error.message : "erro desconhecido");
      return { statusCode: 502, headers, body: { message: "Não foi possível buscar a conversa no Microsoft Graph." } };
    }
  }
}
