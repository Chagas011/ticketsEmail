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
  const connectSecret = required("GRAPH_CONNECT_SECRET");
  if (connectSecret.length < 32) {
    throw new Error("GRAPH_CONNECT_SECRET deve ter pelo menos 32 caracteres");
  }
  const baseUrl = publicUrl.toString().replace(/\/$/, "");
  return {
    clientId: required("GRAPH_CLIENT_ID"),
    clientSecret: required("GRAPH_CLIENT_SECRET"),
    clientState,
    connectSecret,
    redirectUrl: `${baseUrl}/microsoft/oauth/callback`,
    notificationUrl: `${baseUrl}/microsoft/webhook`,
    lifecycleUrl: `${baseUrl}/microsoft/lifecycle`,
  };
}
