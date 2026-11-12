import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "PFUNC", schema: "U_CTG812_RM" })
export class UsuarioEntity {
  @PrimaryColumn({ name: "CODCOLIGADA", type: "number" })
  CODCOLIGADA!: number;

  @PrimaryColumn({ name: "CHAPA", type: "varchar2" })
  CHAPA!: string;

  @Column({ name: "NOME", type: "varchar2" })
  NOME!: string;

  @Column({ name: "CODSITUACAO", type: "varchar2" })
  CODSITUACAO!: string;

  @Column({ name: "CODSECAO", type: "varchar2" })
  CODSECAO!: string;
}
