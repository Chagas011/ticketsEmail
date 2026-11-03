import type { Request, Response } from "express";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { GraphMessageError, GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Registry } from "../../../kernel/di/Registry";

function validId(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim()) && value.length <= 4096;
}

function handleError(error: unknown, response: Response): void {
  if (response.headersSent) { response.destroy(); return; }
  if (error instanceof GraphMessageError && error.statusCode === 404) {
    response.status(404).json({ message: "Mensagem ou anexo não encontrado." });
    return;
  }
  console.error("[Graph] Falha ao consultar anexo:", error instanceof Error ? error.message : "erro desconhecido");
  response.status(502).json({ message: "Não foi possível buscar o anexo no Microsoft Graph." });
}

export class GraphAttachmentController {
  static async list(request: Request, response: Response): Promise<void> {
    response.set("Cache-Control", "no-store");
    const { messageId } = request.params;
    if (!validId(messageId)) { response.status(400).json({ message: "ID da mensagem inválido." }); return; }
    try {
      const attachments = await Registry.getInstance().resolve(GraphMessageRepository).listAttachments(messageId);
      response.json(attachments);
    } catch (error) { handleError(error, response); }
  }

  static async content(request: Request, response: Response): Promise<void> {
    response.set("Cache-Control", "no-store");
    const { messageId, attachmentId } = request.params;
    if (!validId(messageId) || !validId(attachmentId)) {
      response.status(400).json({ message: "ID da mensagem ou do anexo inválido." }); return;
    }
    try {
      const result = await Registry.getInstance().resolve(GraphMessageRepository).getAttachmentContent(messageId, attachmentId);
      response.set({ "Content-Type": "application/octet-stream", "Content-Disposition": "attachment", "X-Content-Type-Options": "nosniff" });
      if (!result.body) { response.end(); return; }
      await pipeline(Readable.fromWeb(result.body as import("node:stream/web").ReadableStream), response);
    } catch (error) { handleError(error, response); }
  }
}
