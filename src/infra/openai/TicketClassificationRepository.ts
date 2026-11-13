import axios from "axios";
import { z } from "zod";
import { TicketClassificationOption } from "../../application/entites/TicketClassificationOption";
import { CLASSIFICAR_CHAMADO_INSTRUCOES } from "../../application/prompts/ClassificarChamadoPrompt";
import { openaiConfig } from "../../config/openai";
import { Injectable } from "../../kernel/decorators/Injectable";

const classificationSchema = z.object({
  classificationStatus: z.enum(["classified", "unresolved"]),
  groupId: z.number().int().nullable(),
  typeId: z.number().int().nullable(),
  parameterId: z.number().int().nullable(),
});

type OpenAIResponse = {
  status?: string;
  output?: { content?: { type?: string; text?: string }[] }[];
};

@Injectable()
export class TicketClassificationRepository {
  async classify(
    subject: string,
    body: string,
    options: TicketClassificationOption[],
  ): Promise<z.infer<typeof classificationSchema>> {
    const { apiKey, model } = openaiConfig();
    const catalog = Array.from(
      new Map(
        options.map((option) => [
          `${option.codGrupoAtendimento}:${option.codTipoAtendimento}`,
          {
            groupId: option.codGrupoAtendimento,
            groupName: option.grupoAtendimento,
            typeId: option.codTipoAtendimento,
            typeName: option.tipoAtendimento,
            parameterId: null,
            parameterName: null,
          },
        ]),
      ).values(),
    );
    const input = JSON.stringify({
      catalog,
      subject: subject.slice(0, 500),
      body: body.slice(0, 20000),
    });

    let response: OpenAIResponse;
    try {
      const result = await axios.post<OpenAIResponse>(
        "https://api.openai.com/v1/responses",
        {
          model,
          instructions: CLASSIFICAR_CHAMADO_INSTRUCOES,
          input,
          store: false,
          text: {
            format: {
              type: "json_schema",
              name: "classificacao_chamado",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  classificationStatus: {
                    type: "string",
                    enum: ["classified", "unresolved"],
                  },
                  groupId: { type: ["integer", "null"] },
                  typeId: { type: ["integer", "null"] },
                  parameterId: { type: ["integer", "null"] },
                },
                required: [
                  "classificationStatus",
                  "groupId",
                  "typeId",
                  "parameterId",
                ],
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
          `Falha na classificação pela OpenAI: HTTP ${error.response?.status ?? "indisponível"}`,
        );
      }
      throw error;
    }

    const text = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((item) => item.type === "output_text")?.text;
    if (response.status !== "completed" || !text) {
      throw new Error("A OpenAI não concluiu a classificação do chamado");
    }
    try {
      return classificationSchema.parse(JSON.parse(text));
    } catch {
      throw new Error("A OpenAI retornou uma classificação inválida");
    }
  }
}
