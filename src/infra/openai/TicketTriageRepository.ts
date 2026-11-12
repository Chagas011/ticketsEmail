import axios from "axios";
import { z } from "zod";
import {
  AVALIAR_CHAMADO_INSTRUCTIONS,
  montarEntradaAvaliacaoChamado,
} from "../../application/prompts/AvaliarChamadoPrompt";
import { openaiConfig } from "../../config/openai";
import { Injectable } from "../../kernel/decorators/Injectable";

const triageResultSchema = z.object({
  isTicket: z.boolean(),
});

type OpenAIResponse = {
  status?: string;
  output?: {
    type?: string;
    content?: { type?: string; text?: string }[];
  }[];
};

@Injectable()
export class TicketTriageRepository {
  async evaluate(
    subject: string,
    body: string,
  ): Promise<z.infer<typeof triageResultSchema>> {
    const { apiKey, model } = openaiConfig();
    let response: OpenAIResponse;

    try {
      const result = await axios.post<OpenAIResponse>(
        "https://api.openai.com/v1/responses",
        {
          model,
          instructions: AVALIAR_CHAMADO_INSTRUCTIONS,
          input: montarEntradaAvaliacaoChamado(subject, body),
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "avaliacao_chamado",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  isTicket: { type: "boolean" },
                },
                required: ["isTicket"],
                additionalProperties: false,
              },
            },
          },
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        },
      );
      response = result.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Falha na avaliação pela OpenAI: HTTP ${error.response?.status ?? "indisponível"}`,
        );
      }
      throw error;
    }

    const text = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (response.status !== "completed" || !text) {
      throw new Error("A OpenAI não concluiu a avaliação do e-mail");
    }

    try {
      return triageResultSchema.parse(JSON.parse(text));
    } catch {
      throw new Error("A OpenAI retornou uma avaliação inválida");
    }
  }
}
