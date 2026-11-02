import type { Request, Response } from "express";
import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Registry } from "../../../kernel/di/Registry";
import { GetGraphMessageUseCase } from "../../useCases/Microsoft/GetGraphMessageUseCase";

export class GraphMessageController {
  static async handle(request: Request, response: Response): Promise<void> {
    response.set("Cache-Control", "no-store");
    const messageId = request.params.messageId;
    if (typeof messageId !== "string" || !messageId.trim() || messageId.length > 4096) {
      response.status(400).json({ message: "ID da mensagem inválido." });
      return;
    }

    try {
      const message = await Registry.getInstance().resolve(GetGraphMessageUseCase).execute(messageId);
      response.json(message);
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        response.status(404).json({ message: "Mensagem não encontrada ou não está mais disponível." });
        return;
      }
      console.error("[Graph] Falha ao consultar mensagem:", error instanceof Error ? error.message : "erro desconhecido");
      response.status(502).json({ message: "Não foi possível buscar a mensagem no Microsoft Graph." });
    }
  }
}
