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

  async getConversation(conversationId: string): Promise<{ mailboxAddress: string; messages: unknown[] }> {
    const token = await this.auth.getAccessToken();
    const [accountResponse, firstPageResponse] = await Promise.all([
      fetch("https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName", {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        signal: AbortSignal.timeout(15000),
      }),
      this.fetchConversationPage(token, conversationId),
    ]);

    if (!accountResponse.ok) throw new GraphMessageError(accountResponse.status);
    if (!firstPageResponse.ok) throw new GraphMessageError(firstPageResponse.status);

    const account = await accountResponse.json() as { mail?: string; userPrincipalName?: string };
    const messages: unknown[] = [];
    let page = await firstPageResponse.json() as { value?: unknown[]; "@odata.nextLink"?: string };
    messages.push(...(page.value ?? []));

    while (page["@odata.nextLink"] && messages.length < 500) {
      const nextUrl = new URL(page["@odata.nextLink"]!);
      if (nextUrl.origin !== "https://graph.microsoft.com") throw new Error("Microsoft Graph retornou um endereço de paginação inválido.");
      const nextResponse = await fetch(nextUrl, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Prefer: 'outlook.body-content-type="text"' },
        signal: AbortSignal.timeout(15000),
      });
      if (!nextResponse.ok) throw new GraphMessageError(nextResponse.status);
      page = await nextResponse.json() as { value?: unknown[]; "@odata.nextLink"?: string };
      messages.push(...(page.value ?? []));
    }

    return {
      mailboxAddress: account.mail || account.userPrincipalName || "",
      messages: messages.sort((left, right) => {
        const leftDate = left && typeof left === "object"
          ? Date.parse(String(("receivedDateTime" in left && left.receivedDateTime) || ("sentDateTime" in left && left.sentDateTime) || 0))
          : 0;
        const rightDate = right && typeof right === "object"
          ? Date.parse(String(("receivedDateTime" in right && right.receivedDateTime) || ("sentDateTime" in right && right.sentDateTime) || 0))
          : 0;
        return leftDate - rightDate;
      }),
    };
  }

  private fetchConversationPage(token: string, conversationId: string): Promise<Response> {
    const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
    const escapedConversationId = conversationId.replace(/'/g, "''");
    url.searchParams.set("$filter", `conversationId eq '${escapedConversationId}'`);
    url.searchParams.set("$select", "id,conversationId,subject,receivedDateTime,sentDateTime,from,body,bodyPreview,hasAttachments");
    url.searchParams.set("$top", "100");
    return fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", Prefer: 'outlook.body-content-type="text"' },
      signal: AbortSignal.timeout(15000),
    });
  }

  async reply(messageId: string, comment: string): Promise<void> {
    const token = await this.auth.getAccessToken();
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/messages/${encodeURIComponent(messageId)}/reply`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment }),
        signal: AbortSignal.timeout(15000),
      },
    );

    if (!response.ok) throw new GraphMessageError(response.status);
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
