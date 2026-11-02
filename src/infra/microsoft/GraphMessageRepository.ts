import { Injectable } from "../../kernel/decorators/Injectable";
import { PersonalGraphAuthRepository } from "./PersonalGraphAuthRepository";

@Injectable()
export class GraphMessageRepository {
  constructor(private readonly auth: PersonalGraphAuthRepository) {}

  async getById(messageId: string): Promise<unknown> {
    const token = await this.auth.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}`,
      {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) {
      throw new Error(`Falha ao buscar mensagem no Microsoft Graph: HTTP ${response.status}`);
    }

    return response.json();
  }
}
