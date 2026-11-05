import type { Request, Response } from "express";
import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Registry } from "../../../kernel/di/Registry";
import { ReplyGraphMessageUseCase } from "../../useCases/Microsoft/ReplyGraphMessageUseCase";

export class GraphReplyController {
  static async handle(request: Request, response: Response): Promise<void> {
    response.set("Cache-Control", "no-store");
    const messageId = request.params.messageId;
    const comment = request.body?.comment;

    if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 4096) {
      response.status(400).json({ message: "ID da mensagem inválido." });
      return;
    }
    if (typeof comment !== "string" || !comment.trim() || comment.length > 10000) {
      response.status(400).json({ message: "A resposta deve ter entre 1 e 10.000 caracteres." });
      return;
    }

    try {
      await Registry.getInstance().resolve(ReplyGraphMessageUseCase).execute(messageId, comment.trim());
      response.sendStatus(202);
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        response.status(404).json({ message: "Mensagem não encontrada ou não está mais disponível." });
        return;
      }
      if (error instanceof GraphMessageError && error.statusCode === 403) {
        response.status(403).json({ message: "A conta conectada não tem permissão para responder. Reconecte após conceder Mail.Send." });
        return;
      }
      console.error("[Graph] Falha ao responder mensagem:", error instanceof Error ? error.message : "erro desconhecido");
      response.status(502).json({ message: "Não foi possível enviar a resposta pelo Microsoft Graph." });
    }
  }
}
