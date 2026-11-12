import "dotenv/config";

export function openaiConfig() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  return {
    apiKey,
    model: process.env.OPENAI_MODEL?.trim() || "gpt-6-luna",
  };
}
