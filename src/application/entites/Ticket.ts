export class Ticket {
  readonly mailboxId: string;
  readonly conversationId: string;
  readonly codColigada: number;
  readonly codLocal: number;
  readonly codAtendimento: number;
  readonly protocolo: string | null;
  readonly criadoEm: Date;

  constructor(attr: Ticket.Attributes) {
    this.mailboxId = attr.mailboxId;
    this.conversationId = attr.conversationId;
    this.codColigada = attr.codColigada;
    this.codLocal = attr.codLocal;
    this.codAtendimento = attr.codAtendimento;
    this.protocolo = attr.protocolo;
    this.criadoEm = attr.criadoEm;
  }
}

export namespace Ticket {
  export type Attributes = {
    mailboxId: string;
    conversationId: string;
    codColigada: number;
    codLocal: number;
    codAtendimento: number;
    protocolo: string | null;
    criadoEm: Date;
  };
}
