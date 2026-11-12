import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "HGRUPOATENDIMENTO", schema: "U_CTG812_RM" })
export class GrupoAtendimentoEntity {
  @PrimaryColumn({ name: "CODCOLIGADA", type: "number" })
  CODCOLIGADA!: number;

  @PrimaryColumn({ name: "CODGRUPOATENDIMENTO", type: "number" })
  CODGRUPOATENDIMENTO!: number;

  @Column({ name: "NOME", type: "varchar2" })
  NOME!: string;
}
