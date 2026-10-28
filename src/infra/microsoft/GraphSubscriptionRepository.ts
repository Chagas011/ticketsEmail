import { GraphSubscription } from "../../application/entites/GraphSubscription";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";

type SubscriptionData = {
  id: string; resource: string; notificationUrl: string;
  lifecycleNotificationUrl?: string; expirationDateTime: string; changeType: string;
};

@Injectable()
export class GraphSubscriptionRepository {
  private async token(): Promise<string> {
    const config = graphConfig();
    const response = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, scope: "https://graph.microsoft.com/.default", grant_type: "client_credentials" }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error(`Falha ao obter token Microsoft: HTTP ${response.status}`);
    const data = await response.json() as { access_token?: string };
    if (!data.access_token) throw new Error("Resposta de autenticação sem access_token");
    return data.access_token;
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.token();
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: { code?: string } };
      throw new Error(`Microsoft Graph: HTTP ${response.status}${data.error?.code ? ` (${data.error.code})` : ""}`);
    }
    return response;
  }

  private toEntity(data: SubscriptionData): GraphSubscription {
    return new GraphSubscription(data.id, data.resource, data.notificationUrl, data.lifecycleNotificationUrl, data.expirationDateTime, data.changeType);
  }

  async list(): Promise<GraphSubscription[]> {
    const results: GraphSubscription[] = [];
    let path: string | undefined = "/subscriptions";
    while (path) {
      const response = await this.request(path);
      const data = await response.json() as { value: SubscriptionData[]; "@odata.nextLink"?: string };
      results.push(...data.value.map((item) => this.toEntity(item)));
      const next: string | undefined = data["@odata.nextLink"];
      if (!next) break;
      const url = new URL(next);
      if (url.origin !== "https://graph.microsoft.com" || !url.pathname.startsWith("/v1.0/")) throw new Error("Link de paginação inválido");
      path = url.pathname.slice("/v1.0".length) + url.search;
    }
    return results;
  }

  async create(resource: string): Promise<GraphSubscription> {
    const config = graphConfig();
    const response = await this.request("/subscriptions", {
      method: "POST",
      body: JSON.stringify({ changeType: "created", resource, notificationUrl: config.notificationUrl, lifecycleNotificationUrl: config.lifecycleUrl, expirationDateTime: this.expiration(), clientState: config.clientState }),
    });
    return this.toEntity(await response.json() as SubscriptionData);
  }

  async renew(id: string): Promise<GraphSubscription> {
    const response = await this.request(`/subscriptions/${encodeURIComponent(id)}`, {
      method: "PATCH", body: JSON.stringify({ expirationDateTime: this.expiration() }),
    });
    return this.toEntity(await response.json() as SubscriptionData);
  }

  private expiration(): string {
    return new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  }
}
