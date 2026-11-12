import { Ticket } from "../../../../application/entites/Ticket";
import { TicketEntity } from "../entities/TicketEntity";

export class TicketMapper {
  static toEntity(domain: Ticket): TicketEntity {
    const entity = new TicketEntity();

    entity.MAILBOX_ID = domain.mailboxId;
    entity.CONVERSATION_ID = domain.conversationId;
    entity.CODCOLIGADA = domain.codColigada;
    entity.CODLOCAL = domain.codLocal;
    entity.CODATENDIMENTO = domain.codAtendimento;
    entity.CRIADO_EM = domain.criadoEm;

    return entity;
  }

  static toDomain(entity: TicketEntity): Ticket {
    return new Ticket({
      mailboxId: entity.MAILBOX_ID,
      conversationId: entity.CONVERSATION_ID,
      codColigada: entity.CODCOLIGADA,
      codLocal: entity.CODLOCAL,
      codAtendimento: entity.CODATENDIMENTO,
      criadoEm: entity.CRIADO_EM,
    });
  }
}
