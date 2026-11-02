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
}
