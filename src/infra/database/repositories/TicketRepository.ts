import { Ticket } from "../../../application/entites/Ticket";
import { TicketClassificationOption } from "../../../application/entites/TicketClassificationOption";
import { graphConfig } from "../../../config/microsoftGraph";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { AppDataSource } from "../typeorm/data-source";
import { TicketEntity } from "../typeorm/entities/TicketEntity";
import {
  TicketClassificationMapper,
  TicketClassificationRow,
} from "../typeorm/mappers/TicketClassificationMapper";
import { TicketMapper } from "../typeorm/mappers/TicketMapper";

@Injectable()
export class TicketRepository {
  private readonly classificationMapper = new TicketClassificationMapper();

  async getByConversationID(conversationId: string): Promise<Ticket | null> {
    const tickets = (await AppDataSource.query(
      `SELECT
         C.MAILBOX_ID,
         C.CONVERSATION_ID,
         C.CODCOLIGADA,
         C.CODLOCAL,
         C.CODATENDIMENTO,
         C.CRIADO_EM
       FROM CONVERSA_ATENDIMENTO C
       WHERE C.MAILBOX_ID = :1
         AND C.CONVERSATION_ID = :2`,
      [graphConfig().mailboxUserId, conversationId],
    )) as TicketEntity[];

    return tickets[0] ? TicketMapper.toDomain(tickets[0]) : null;
  }

  async getClassificationOptions(): Promise<TicketClassificationOption[]> {
    const rows = (await AppDataSource.query(
      `SELECT DISTINCT
         G.CODCOLIGADA,
         G.CODGRUPOATENDIMENTO,
         G.NOME AS GRUPO_ATENDIMENTO,
         T.CODTIPOATENDIMENTO,
         T.NOME AS TIPO_ATENDIMENTO,
         P.CODPRODUTO,
         P.DESPRODUTO AS PRODUTO
       FROM U_CTG812_RM.HGRUPOATENDIMENTO G
       LEFT JOIN U_CTG812_RM.HTIPOSATENDDOGRUPOATEND GT
         ON GT.CODCOLIGADA = G.CODCOLIGADA
         AND GT.CODGRUPOATENDIMENTO = G.CODGRUPOATENDIMENTO
       LEFT JOIN U_CTG812_RM.HTIPOATENDIMENTO T
         ON T.CODCOLIGADA = GT.CODCOLIGADA
         AND T.CODTIPOATENDIMENTO = GT.CODTIPOATENDIMENTO
       LEFT JOIN U_CTG812_RM.HATENDIMENTOBASE A
         ON A.CODCOLIGADA = G.CODCOLIGADA
         AND A.CODGRUPOATENDIMENTO = G.CODGRUPOATENDIMENTO
         AND A.CODTIPOATENDIMENTO = T.CODTIPOATENDIMENTO
       LEFT JOIN U_CTG812_RM.HPRODUTO P
         ON P.CODCOLIGADA = A.CODCOLIGADA
         AND P.CODPRODUTO = A.CODPRODUTO
       WHERE G.CODGRUPOATENDIMENTO IN (7, 8)
       ORDER BY
         G.CODGRUPOATENDIMENTO,
         T.NOME,
         P.DESPRODUTO`,
    )) as TicketClassificationRow[];

    return rows.map((row) => this.classificationMapper.toDomain(row));
  }
}
