import axios, { AxiosRequestConfig } from "axios";
import { Readable } from "node:stream";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";
import { CorporateGraphAuthRepository } from "./CorporateGraphAuthRepository";

export class GraphMessageError extends Error {
  constructor(readonly statusCode: number) {
    super(`Falha ao consultar o Microsoft Graph: HTTP ${statusCode}`);
  }
}

type ConversationPage = { value?: unknown[]; "@odata.nextLink"?: string };

@Injectable()
export class GraphMessageRepository {
  constructor(private readonly auth: CorporateGraphAuthRepository) {}

  private async request<T>(
    url: string,
    options: AxiosRequestConfig = {},
  ): Promise<T> {
    const token = await this.auth.getAccessToken();
    try {
      const response = await axios.request<T>({
        ...options,
        url,
        timeout: options.timeout ?? 15000,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...options.headers,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response)
        throw new GraphMessageError(error.response.status);
      throw error;
    }
  }

  async getById(messageId: string, textBody = true): Promise<unknown> {
    return await this.request(
      `https://graph.microsoft.com/v1.0/users/${graphConfig().mailboxUserId}/messages/${encodeURIComponent(messageId)}`,
      {
        headers: textBody ? { Prefer: 'outlook.body-content-type="text"' } : {},
      },
    );
  }

  async getConversation(
    conversationId: string,
  ): Promise<{ mailboxAddress: string; messages: unknown[] }> {
    const url = new URL(
      `https://graph.microsoft.com/v1.0/users/${graphConfig().mailboxUserId}/messages`,
    );
    url.searchParams.set(
      "$filter",
      `conversationId eq '${conversationId.replace(/'/g, "''")}'`,
    );
    url.searchParams.set(
      "$select",
      "id,conversationId,subject,receivedDateTime,sentDateTime,from,body,bodyPreview,hasAttachments",
    );
    url.searchParams.set("$top", "100");
    const options = { headers: { Prefer: 'outlook.body-content-type="text"' } };
    const firstPage = await this.request<ConversationPage>(
      url.toString(),
      options,
    );
    const messages = [...(firstPage.value ?? [])];
    let page = firstPage;
    while (page["@odata.nextLink"] && messages.length < 500) {
      const nextUrl = new URL(page["@odata.nextLink"]!);
      if (
        nextUrl.origin !== "https://graph.microsoft.com" ||
        !nextUrl.pathname.startsWith("/v1.0/")
      ) {
        throw new Error(
          "Microsoft Graph retornou um endereço de paginação inválido.",
        );
      }
      page = await this.request<ConversationPage>(nextUrl.toString(), options);
      messages.push(...(page.value ?? []));
    }
    return {
      mailboxAddress: graphConfig().mailboxAddress,
      messages: messages.sort((left, right) => {
        const date = (item: unknown) =>
          item && typeof item === "object"
            ? Date.parse(
                String(
                  ("receivedDateTime" in item && item.receivedDateTime) ||
                    ("sentDateTime" in item && item.sentDateTime) ||
                    0,
                ),
              )
            : 0;
        return date(left) - date(right);
      }),
    };
  }

  async reply(messageId: string, comment: string) {
    await this.request(
      `https://graph.microsoft.com/v1.0/users/${graphConfig().mailboxUserId}/messages/${encodeURIComponent(messageId)}/reply`,
      {
        method: "POST",
        data: { comment },
      },
    );
  }

  async listAttachments(messageId: string): Promise<unknown> {
    const url = new URL(
      `https://graph.microsoft.com/v1.0/users/${graphConfig().mailboxUserId}/messages/${encodeURIComponent(messageId)}/attachments`,
    );
    url.searchParams.set("$select", "id,name,contentType,size,isInline");
    return await this.request(url.toString());
  }

  async getAttachmentContent(
    messageId: string,
    attachmentId: string,
  ): Promise<Readable> {
    return await this.request<Readable>(
      `https://graph.microsoft.com/v1.0/users/${graphConfig().mailboxUserId}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/$value`,
      { responseType: "stream", timeout: 30000 },
    );
  }
}
