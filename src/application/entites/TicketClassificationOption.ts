export class TicketClassificationOption {
  readonly codColigada: number;
  readonly codGrupoAtendimento: number;
  readonly grupoAtendimento: string;
  readonly codTipoAtendimento: number | null;
  readonly tipoAtendimento: string | null;
  readonly codProduto: number | null;
  readonly produto: string | null;

  constructor(attr: TicketClassificationOption.Attributes) {
    this.codColigada = attr.codColigada;
    this.codGrupoAtendimento = attr.codGrupoAtendimento;
    this.grupoAtendimento = attr.grupoAtendimento;
    this.codTipoAtendimento = attr.codTipoAtendimento;
    this.tipoAtendimento = attr.tipoAtendimento;
    this.codProduto = attr.codProduto;
    this.produto = attr.produto;
  }
}

export namespace TicketClassificationOption {
  export type Attributes = {
    codColigada: number;
    codGrupoAtendimento: number;
    grupoAtendimento: string;
    codTipoAtendimento: number | null;
    tipoAtendimento: string | null;
    codProduto: number | null;
    produto: string | null;
  };
}
