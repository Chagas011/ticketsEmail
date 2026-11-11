import { Controller } from "../../contracts/Controller";
import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { attachmentError, validAttachmentId } from "./GraphAttachmentController";

@Injectable()
export class GraphAttachmentContentController extends Controller<"public", unknown> {
  constructor(private readonly messages: GraphMessageRepository) { super(); }

  protected async handle(request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    const { messageId, attachmentId } = request.params;
    if (!validAttachmentId(messageId) || !validAttachmentId(attachmentId)) {
      return {
        statusCode: 400,
        headers: { "Cache-Control": "no-store" },
        body: { message: "ID da mensagem ou do anexo inválido." },
      };
    }
    try {
      const stream = await this.messages.getAttachmentContent(messageId, attachmentId);
      return {
        statusCode: 200,
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/octet-stream",
          "Content-Disposition": "attachment",
          "X-Content-Type-Options": "nosniff",
        },
        format: "stream",
        stream,
      };
    } catch (error) {
      return attachmentError(error);
    }
  }
}
