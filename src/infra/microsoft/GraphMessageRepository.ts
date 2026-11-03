import { Injectable } from "../../kernel/decorators/Injectable";
import { PersonalGraphAuthRepository } from "./PersonalGraphAuthRepository";

export class GraphMessageError extends Error {
  constructor(readonly statusCode: number) {
    super(`Falha ao buscar mensagem no Microsoft Graph: HTTP ${statusCode}`);
  }
}

@Injectable()
export class GraphMessageRepository {
  constructor(private readonly auth: PersonalGraphAuthRepository) {}

  async getById(messageId: string, textBody = false): Promise<unknown> {
    const token = await this.auth.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(textBody ? { Prefer: 'outlook.body-content-type="text"' } : {}),
        },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      throw new GraphMessageError(response.status);
    }

    return response.json();
  }

  async listAttachments(messageId: string): Promise<unknown> {
    const token = await this.auth.getAccessToken();
    const url = new URL(`https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments`);
    url.searchParams.set("$select", "id,name,contentType,size,isInline");
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new GraphMessageError(response.status);
    return response.json();
  }

  async getAttachmentContent(messageId: string, attachmentId: string): Promise<Response> {
    const token = await this.auth.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) },
    );
    if (!response.ok) throw new GraphMessageError(response.status);
    return response;
  }
}
