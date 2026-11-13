import { Column, Entity, PrimaryColumn } from "typeorm";

@Entity({ name: "CONVERSA_ATENDIMENTO" })
export class TicketEntity {
  @PrimaryColumn({ name: "MAILBOX_ID", type: "varchar2", length: 36 })
  MAILBOX_ID!: string;

  @PrimaryColumn({ name: "CONVERSATION_ID", type: "varchar2", length: 512 })
  CONVERSATION_ID!: string;

  @Column({ name: "CODCOLIGADA", type: "number" })
  CODCOLIGADA!: number;

  @Column({ name: "CODLOCAL", type: "number" })
  CODLOCAL!: number;

  @Column({ name: "CODATENDIMENTO", type: "number" })
  CODATENDIMENTO!: number;

  @Column({ name: "PROTOCOLO", type: "varchar2", length: 255, nullable: true })
  PROTOCOLO!: string | null;

  @Column({ name: "CRIADO_EM", type: "timestamp" })
  CRIADO_EM!: Date;
}
