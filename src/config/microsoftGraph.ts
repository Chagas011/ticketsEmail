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
  if (clientState.length < 32 || clientState.length > 128) {
    throw new Error("GRAPH_CLIENT_STATE deve ter entre 32 e 128 caracteres");
  }
  const baseUrl = publicUrl.toString().replace(/\/$/, "");
  return {
    tenantId: required("GRAPH_TENANT_ID"),
    clientId: required("GRAPH_CLIENT_ID"),
    clientSecret: required("GRAPH_CLIENT_SECRET"),
    mailboxId: required("GRAPH_MAILBOX_USER_ID"),
    clientState,
    notificationUrl: `${baseUrl}/microsoft/webhook`,
    lifecycleUrl: `${baseUrl}/microsoft/lifecycle`,
  };
}
