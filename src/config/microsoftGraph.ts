import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável ${name} não configurada`);
  return value;
}

export function graphConfig() {
  const publicUrl = new URL(required("GRAPH_PUBLIC_URL"));
  if (publicUrl.protocol !== "https:" || publicUrl.search || publicUrl.hash) {
    throw new Error("GRAPH_PUBLIC_URL deve ser uma URL HTTPS sem query ou fragmento");
  }
  const clientState = required("GRAPH_CLIENT_STATE");
  const tenantId = required("GRAPH_TENANT_ID");
  const mailboxUserId = required("GRAPH_MAILBOX_USER_ID");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
    throw new Error("GRAPH_TENANT_ID deve ser o ID do tenant corporativo");
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mailboxUserId)) {
    throw new Error("GRAPH_MAILBOX_USER_ID deve ser o ID de objeto da mailbox corporativa");
  }
  if (clientState.length < 32 || clientState.length > 128) {
    throw new Error("GRAPH_CLIENT_STATE deve ter entre 32 e 128 caracteres");
  }
  const baseUrl = publicUrl.toString().replace(/\/$/, "");
  return {
    clientId: required("GRAPH_CLIENT_ID"),
    tenantId,
    mailboxUserId,
    mailboxAddress: process.env.GRAPH_MAILBOX_ADDRESS?.trim() ?? "",
    clientSecret: required("GRAPH_CLIENT_SECRET"),
    clientState,
    notificationUrl: `${baseUrl}/microsoft/webhook`,
    lifecycleUrl: `${baseUrl}/microsoft/lifecycle`,
  };
}
