import type { Request, Response } from "express";
import { GraphMessageError } from "../../../infra/microsoft/GraphMessageRepository";
import { Registry } from "../../../kernel/di/Registry";
import { GetGraphConversationUseCase } from "../../useCases/Microsoft/GetGraphConversationUseCase";

export class GraphConversationController {
  static async handle(request: Request, response: Response): Promise<void> {
    response.set("Cache-Control", "no-store");
    const conversationId = request.params.conversationId;
    if (typeof conversationId !== "string" || !conversationId.trim() || conversationId.length > 4096) {
      response.status(400).json({ message: "ID da conversa inválido." });
      return;
    }

    try {
      const conversation = await Registry.getInstance().resolve(GetGraphConversationUseCase).execute(conversationId);
      response.json(conversation);
    } catch (error) {
      if (error instanceof GraphMessageError && error.statusCode === 404) {
        response.status(404).json({ message: "Conversa não encontrada ou indisponível." });
        return;
      }
      console.error("[Graph] Falha ao consultar conversa:", error instanceof Error ? error.message : "erro desconhecido");
      response.status(502).json({ message: "Não foi possível buscar a conversa no Microsoft Graph." });
    }
  }
}
