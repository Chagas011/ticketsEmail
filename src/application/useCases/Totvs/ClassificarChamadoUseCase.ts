import { TicketRepository } from "../../../infra/database/repositories/TicketRepository";
import { TicketClassificationRepository } from "../../../infra/openai/TicketClassificationRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

export type ClassificacaoAtendimento = {
  grupo: number;
  tipo: number;
  parametro?: number;
};

@Injectable()
export class ClassificarChamadoUseCase {
  constructor(
    private readonly tickets: TicketRepository,
    private readonly classifier: TicketClassificationRepository,
  ) {}

  async execute(input: {
    coligada: number;
    assunto: string;
    solicitacao: string;
  }): Promise<ClassificacaoAtendimento | null> {
    const options = (await this.tickets.getClassificationOptions()).filter(
      (option) =>
        option.codColigada === input.coligada &&
        option.codTipoAtendimento !== null,
    );
    if (!options.length) return null;

    const result = await this.classifier.classify(
      input.assunto,
      input.solicitacao,
      options,
    );
    if (result.classificationStatus === "unresolved") return null;
    const valid = options.some(
      (option) =>
        option.codGrupoAtendimento === result.groupId &&
        option.codTipoAtendimento === result.typeId,
    );
    if (
      !valid ||
      result.groupId === null ||
      result.typeId === null ||
      result.parameterId !== null
    ) {
      return null;
    }

    return {
      grupo: result.groupId,
      tipo: result.typeId,
    };
  }
}
