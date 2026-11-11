import axios from "axios";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };

@Injectable({ singleton: true })
export class CorporateGraphAuthRepository {
  private token: { value: string; expiresAt: number } | undefined;
  private pending: Promise<string> | undefined;

  async getAccessToken(): Promise<string> {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    if (this.pending) return await this.pending;

    this.pending = this.requestToken();
    try {
      return await this.pending;
    } finally {
      this.pending = undefined;
    }
  }

  private async requestToken(): Promise<string> {
    const config = graphConfig();
    try {
      const response = await axios.post<TokenResponse>(
        `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
        new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
        { headers: { "Content-Type": "application/x-www-form-urlencoded" }, timeout: 15000 },
      );
      const { access_token, expires_in } = response.data;
      if (!access_token || typeof expires_in !== "number" || expires_in <= 0) {
        throw new Error("Microsoft não retornou um token de aplicativo válido");
      }
      this.token = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
      return access_token;
    } catch (error) {
      if (axios.isAxiosError<TokenResponse>(error)) {
        const code = error.response?.data?.error;
        throw new Error(`Falha na autenticação do aplicativo: HTTP ${error.response?.status ?? "indisponível"}${code ? ` (${code})` : ""}`);
      }
      throw error;
    }
  }
}
