import { Controller } from "../../contracts/Controller";
import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { ReplyGraphMessageUseCase } from "../../useCases/Microsoft/ReplyGraphMessageUseCase";

@Injectable()
export class GraphReplyController extends Controller<"public", unknown> {
  constructor(private readonly replies: ReplyGraphMessageUseCase) { super(); }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    const headers = { "Cache-Control": "no-store" };
    const messageId = request.params.messageId;
    const comment = request.body?.comment;

    if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 4096) {
      return { statusCode: 400, headers, body: { message: "ID da mensagem inválido." } };
    }
    if (typeof comment !== "string" || !comment.trim() || comment.length > 10000) {
      return { statusCode: 400, headers, body: { message: "A resposta deve ter entre 1 e 10.000 caracteres." } };
    }

    try {
      await this.replies.execute(messageId, comment.trim());
      return { statusCode: 202, headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" }, format: "text", body: "Accepted" };
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        return { statusCode: 404, headers, body: { message: "Mensagem não encontrada ou não está mais disponível." } };
      }
      if (error instanceof GraphMessageError && error.statusCode === 403) {
        return { statusCode: 403, headers, body: { message: "O aplicativo não tem permissão para responder pela caixa configurada. Verifique Mail.Send no Exchange ou no Microsoft Graph." } };
      }
      console.error("[Graph] Falha ao responder mensagem:", error instanceof Error ? error.message : "erro desconhecido");
      return { statusCode: 502, headers, body: { message: "Não foi possível enviar a resposta pelo Microsoft Graph." } };
    }
  }
}
