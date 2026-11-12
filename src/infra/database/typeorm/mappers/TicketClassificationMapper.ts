import { TicketClassificationOption } from "../../../../application/entites/TicketClassificationOption";
import { GrupoAtendimentoEntity } from "../entities/GrupoAtendimentoEntity";

export type TicketClassificationRow = Pick<
  GrupoAtendimentoEntity,
  "CODCOLIGADA" | "CODGRUPOATENDIMENTO"
> & {
  GRUPO_ATENDIMENTO: string;
  CODTIPOATENDIMENTO: number | null;
  TIPO_ATENDIMENTO: string | null;
  CODPRODUTO: number | null;
  PRODUTO: string | null;
};

export class TicketClassificationMapper {
  toDomain(row: TicketClassificationRow): TicketClassificationOption {
    return new TicketClassificationOption({
      codColigada: row.CODCOLIGADA,
      codGrupoAtendimento: row.CODGRUPOATENDIMENTO,
      grupoAtendimento: row.GRUPO_ATENDIMENTO,
      codTipoAtendimento: row.CODTIPOATENDIMENTO,
      tipoAtendimento: row.TIPO_ATENDIMENTO,
      codProduto: row.CODPRODUTO,
      produto: row.PRODUTO,
    });
  }
}
