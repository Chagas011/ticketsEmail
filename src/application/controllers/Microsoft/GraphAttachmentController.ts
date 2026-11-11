import { Controller } from "../../contracts/Controller";
import { GraphMessageError, GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

export function validAttachmentId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= 4096;
}

export function attachmentError(error: unknown): Controller.Response<unknown> {
  const headers = { "Cache-Control": "no-store" };
  if (error instanceof GraphMessageError && error.statusCode === 404) {
    return { statusCode: 404, headers, body: { message: "Mensagem ou anexo não encontrado." } };
  }
  console.error("[Graph] Falha ao consultar anexo:", error instanceof Error ? error.message : "erro desconhecido");
  return { statusCode: 502, headers, body: { message: "Não foi possível buscar o anexo no Microsoft Graph." } };
}

@Injectable()
export class GraphAttachmentController extends Controller<"public", unknown> {
  constructor(private readonly messages: GraphMessageRepository) { super(); }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    const headers = { "Cache-Control": "no-store" };
    const { messageId } = request.params;
    if (!validAttachmentId(messageId)) {
      return { statusCode: 400, headers, body: { message: "ID da mensagem inválido." } };
    }
    try {
      const attachments = await this.messages.listAttachments(messageId);
      return { statusCode: 200, headers, body: attachments };
    } catch (error) {
      return attachmentError(error);
    }
  }
}
