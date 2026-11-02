import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";

const authority = "https://login.microsoftonline.com/consumers/oauth2/v2.0";
const scope = "offline_access https://graph.microsoft.com/User.Read https://graph.microsoft.com/Mail.Read";
const pendingLifetime = 10 * 60 * 1000;
const sessionLifetime = 12 * 60 * 60 * 1000;

type Tokens = { accessToken: string; refreshToken: string; expiresAt: number; userId: string };
type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

@Injectable()
export class PersonalGraphAuthRepository {
  private static pending: { state: string; verifier: string; expiresAt: number; authorizationUrl: string } | undefined;
  private static tokens: Tokens | undefined;
  private static refresh: Promise<string> | undefined;
  private static session: { value: string; expiresAt: number } | undefined;
  private static subscriptionId: string | undefined;

  createAuthorizationUrl(): string {
    const config = graphConfig();
    const state = randomBytes(32).toString("base64url");
    const verifier = randomBytes(32).toString("base64url");
    const url = new URL(`${authority}/authorize`);
    url.search = new URLSearchParams({ client_id: config.clientId, response_type: "code", redirect_uri: config.redirectUrl,
      response_mode: "query", scope, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"),
      code_challenge_method: "S256", prompt: "select_account" }).toString();
    const authorizationUrl = url.toString();
    PersonalGraphAuthRepository.pending = { state, verifier, expiresAt: Date.now() + pendingLifetime, authorizationUrl };
    return authorizationUrl;
  }

  getAuthorizationUrl(): string {
    const pending = PersonalGraphAuthRepository.pending;
    return pending && pending.expiresAt > Date.now() ? pending.authorizationUrl : this.createAuthorizationUrl();
  }

  async completeAuthorization(state: string, code: string): Promise<void> {
    const pending = PersonalGraphAuthRepository.pending;
    if (!pending || pending.expiresAt <= Date.now() || !this.same(state, pending.state)) {
      throw new Error("Solicitação de autorização inválida ou expirada");
    }
    PersonalGraphAuthRepository.pending = undefined;
    const config = graphConfig();
    const data = await this.requestToken({ client_id: config.clientId, client_secret: config.clientSecret,
      grant_type: "authorization_code", code, redirect_uri: config.redirectUrl, code_verifier: pending.verifier, scope });
    if (!data.access_token || !data.refresh_token || !data.expires_in) throw new Error("Microsoft não retornou os tokens necessários");
    const profile = await fetch("https://graph.microsoft.com/v1.0/me?$select=id", {
      headers: { Authorization: `Bearer ${data.access_token}` }, signal: AbortSignal.timeout(15000),
    });
    if (!profile.ok) throw new Error(`Microsoft Graph: falha ao identificar a conta (HTTP ${profile.status})`);
    const account = await profile.json() as { id?: unknown };
    if (typeof account.id !== "string" || !account.id) throw new Error("Microsoft Graph não retornou o identificador da conta");
    if (PersonalGraphAuthRepository.tokens && PersonalGraphAuthRepository.tokens.userId !== account.id) {
      throw new Error("Outra mailbox já está conectada; reinicie a API antes de trocar de conta");
    }
    PersonalGraphAuthRepository.tokens = { accessToken: data.access_token, refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000, userId: account.id };
  }

  async getAccessToken(): Promise<string> {
    const tokens = PersonalGraphAuthRepository.tokens;
    if (!tokens) throw new Error("Conecte a conta Microsoft pessoal antes de criar a subscription");
    if (tokens.expiresAt > Date.now() + 60_000) return tokens.accessToken;
    if (!PersonalGraphAuthRepository.refresh) {
      PersonalGraphAuthRepository.refresh = this.refreshToken(tokens).finally(() => { PersonalGraphAuthRepository.refresh = undefined; });
    }
    return PersonalGraphAuthRepository.refresh;
  }

  private async refreshToken(tokens: Tokens): Promise<string> {
    const config = graphConfig();
    const data = await this.requestToken({ client_id: config.clientId, client_secret: config.clientSecret,
      grant_type: "refresh_token", refresh_token: tokens.refreshToken, scope });
    if (!data.access_token || !data.expires_in) throw new Error("Microsoft não retornou um access token válido");
    if (PersonalGraphAuthRepository.tokens !== tokens) throw new Error("A conta foi alterada durante a renovação");
    PersonalGraphAuthRepository.tokens = { ...tokens, accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken, expiresAt: Date.now() + data.expires_in * 1000 };
    return data.access_token;
  }

  private async requestToken(params: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(`${authority}/token`, { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(params), signal: AbortSignal.timeout(15000) });
    const data = await response.json().catch(() => ({})) as TokenResponse;
    if (!response.ok) throw new Error(`Falha na autenticação Microsoft: HTTP ${response.status}${data.error ? ` (${data.error})` : ""}`);
    return data;
  }

  isConnected(): boolean { return Boolean(PersonalGraphAuthRepository.tokens); }
  getUserId(): string | undefined { return PersonalGraphAuthRepository.tokens?.userId; }
  setSubscriptionId(id: string): void { PersonalGraphAuthRepository.subscriptionId = id; }
  matchesSubscription(id: unknown): boolean { return typeof id === "string" && id === PersonalGraphAuthRepository.subscriptionId; }

  createSession(): string {
    const value = randomBytes(32).toString("base64url");
    PersonalGraphAuthRepository.session = { value, expiresAt: Date.now() + sessionLifetime };
    return value;
  }
  matchesSession(value: unknown): boolean {
    const session = PersonalGraphAuthRepository.session;
    return this.isConnected() && Boolean(session && session.expiresAt > Date.now() && typeof value === "string" && this.same(value, session.value));
  }
  sessionExpiresAt(): number | undefined { return PersonalGraphAuthRepository.session?.expiresAt; }
  private same(a: string, b: string): boolean {
    const first = Buffer.from(a); const second = Buffer.from(b);
    return first.length === second.length && timingSafeEqual(first, second);
  }
}
