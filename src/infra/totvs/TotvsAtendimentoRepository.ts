import axios from "axios";
import { z } from "zod";
import {
  CriarAtendimentoInput,
  CriarAtendimentoOutput,
} from "../../application/contracts/TotvsAtendimento";
import { totvsConfig } from "../../config/totvs";
import { Injectable } from "../../kernel/decorators/Injectable";
import { atendimentoOutputSchema } from "./schema";

export class TotvsAtendimentoIndeterminadoError extends Error {
  constructor() {
    super("Não foi possível confirmar se o atendimento foi criado no TOTVS");
  }
}

@Injectable()
export class TotvsAtendimentoRepository {
  async create(input: CriarAtendimentoInput): Promise<CriarAtendimentoOutput> {
    const { endpoint, token } = totvsConfig();
    try {
      const response = await axios.post<unknown>(endpoint, input, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000,
      });
      return atendimentoOutputSchema.parse(response.data);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (!error.response || error.response.status >= 500) {
          throw new TotvsAtendimentoIndeterminadoError();
        }
        throw new Error(
          `Falha ao criar atendimento no TOTVS: HTTP ${error.response.status}`,
        );
      }
      if (error instanceof z.ZodError) {
        throw new TotvsAtendimentoIndeterminadoError();
      }
      throw error;
    }
  }
}
