import "dotenv/config";

export function totvsConfig() {
  const rawUrl = process.env.TOTVS_ATENDIMENTO_BASE_URL?.trim();
  const token = process.env.TOTVS_API_TOKEN?.trim();

  if (!rawUrl) throw new Error("TOTVS_ATENDIMENTO_BASE_URL não configurada");
  const baseUrl = new URL(rawUrl);
  if (baseUrl.protocol !== "http:" && baseUrl.protocol !== "https:") {
    throw new Error("TOTVS_ATENDIMENTO_BASE_URL deve usar HTTP(S)");
  }
  if (baseUrl.search || baseUrl.hash || baseUrl.username || baseUrl.password) {
    throw new Error("TOTVS_ATENDIMENTO_BASE_URL não deve conter credenciais, query ou fragmento");
  }
  if (!token) throw new Error("TOTVS_API_TOKEN não configurado");

  return {
    endpoint: new URL(
      "api/v1/atendimentos",
      `${baseUrl.toString().replace(/\/$/, "")}/`,
    ).toString(),
    token,
  };
}
