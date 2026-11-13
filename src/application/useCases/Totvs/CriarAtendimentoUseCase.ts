import { Ticket } from "../../entites/Ticket";
import { graphConfig } from "../../../config/microsoftGraph";
import { TicketRepository } from "../../../infra/database/repositories/TicketRepository";
import { TotvsAtendimentoRepository } from "../../../infra/totvs/TotvsAtendimentoRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

export type NovoAtendimento = {
  conversationId: string;
  assunto: string;
  solicitacao: string;
  coligada: number;
  grupo: number;
  tipo: number;
  parametro?: number;
  usuarioAutenticado: {
    codigoUsuario: string;
    codPessoa?: number | null;
  };
};

export class AtendimentoCriadoSemVinculoError extends Error {
  constructor(readonly ticket: Ticket) {
    super(`Atendimento ${ticket.protocolo} criado no TOTVS, mas não vinculado à conversa ${ticket.conversationId}`);
  }
}

@Injectable()
export class CriarAtendimentoUseCase {
  constructor(
    private readonly atendimentos: TotvsAtendimentoRepository,
    private readonly tickets: TicketRepository,
  ) {}

  async execute(input: NovoAtendimento): Promise<Ticket> {
    const existing = await this.tickets.getByConversationID(input.conversationId);
    if (existing) return existing;

    const criado = await this.atendimentos.create({
      coligada: input.coligada,
      assunto: input.assunto,
      solicitacao: input.solicitacao,
      grupo: input.grupo,
      tipo: input.tipo,
      parametro: input.parametro,
      usuarioAutenticado: input.usuarioAutenticado,
    });

    const ticket = new Ticket({
      mailboxId: graphConfig().mailboxUserId,
      conversationId: input.conversationId,
      codColigada: criado.codColigada,
      codLocal: criado.codLocal,
      codAtendimento: criado.codAtendimento,
      protocolo: criado.protocolo,
      criadoEm: new Date(),
    });

    try {
      return await this.tickets.create(ticket);
    } catch {
      throw new AtendimentoCriadoSemVinculoError(ticket);
    }
  }
}
