import axios, { AxiosRequestConfig } from "axios";
import { GraphSubscription } from "../../application/entites/GraphSubscription";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";
import { CorporateGraphAuthRepository } from "./CorporateGraphAuthRepository";

type SubscriptionData = {
  id: string;
  resource: string;
  notificationUrl: string;
  lifecycleNotificationUrl?: string;
  expirationDateTime: string;
  changeType: string;
};

@Injectable()
export class GraphSubscriptionRepository {
  constructor(private readonly auth: CorporateGraphAuthRepository) {}

  private async request<T>(path: string, options: AxiosRequestConfig = {}): Promise<T> {
    const token = await this.auth.getAccessToken();
    try {
      const response = await axios.request<T>({
        ...options,
        url: `https://graph.microsoft.com/v1.0${path}`,
        timeout: 15000,
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError<{ error?: { code?: string } }>(error)) {
        const code = error.response?.data?.error?.code;
        throw new Error(`Microsoft Graph: HTTP ${error.response?.status ?? "indisponível"}${code ? ` (${code})` : ""}`);
      }
      throw error;
    }
  }

  private toEntity(data: SubscriptionData): GraphSubscription {
    return new GraphSubscription(
      data.id,
      data.resource,
      data.notificationUrl,
      data.lifecycleNotificationUrl,
      data.expirationDateTime,
      data.changeType,
    );
  }

  async list(): Promise<GraphSubscription[]> {
    const results: GraphSubscription[] = [];
    let path: string | undefined = "/subscriptions";
    while (path) {
      const data: { value: SubscriptionData[]; "@odata.nextLink"?: string } = await this.request(path);
      results.push(...data.value.map((item) => this.toEntity(item)));
      const next: string | undefined = data["@odata.nextLink"];
      if (!next) break;
      const url: URL = new URL(next);
      if (
        url.origin !== "https://graph.microsoft.com" ||
        !url.pathname.startsWith("/v1.0/")
      )
        throw new Error("Link de paginação inválido");
      path = url.pathname.slice("/v1.0".length) + url.search;
    }
    return results;
  }

  async create(resource: string): Promise<GraphSubscription> {
    const config = graphConfig();
    const data = await this.request<SubscriptionData>("/subscriptions", {
      method: "POST",
      data: {
        changeType: "created",
        resource,
        notificationUrl: config.notificationUrl,
        lifecycleNotificationUrl: config.lifecycleUrl,
        expirationDateTime: this.expiration(),
        clientState: config.clientState,
      },
    });
    return this.toEntity(data);
  }

  async renew(id: string): Promise<GraphSubscription> {
    const data = await this.request<SubscriptionData>(
      `/subscriptions/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        data: { expirationDateTime: this.expiration() },
      },
    );
    return this.toEntity(data);
  }

  private expiration(): string {
    return new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString();
  }
}
