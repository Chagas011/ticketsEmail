export class Usuario {
  readonly codColigada: number;
  readonly chapa: string;
  readonly nome: string;
  readonly codSituacao: string;
  readonly codSecao: string;
  readonly departamento: string | null;
  readonly email: string;

  constructor(attr: Usuario.Attributes) {
    this.codColigada = attr.codColigada;
    this.chapa = attr.chapa;
    this.nome = attr.nome;
    this.codSituacao = attr.codSituacao;
    this.codSecao = attr.codSecao;
    this.departamento = attr.departamento;
    this.email = attr.email;
  }
}

export namespace Usuario {
  export type Attributes = {
    codColigada: number;
    chapa: string;
    nome: string;
    codSituacao: string;
    codSecao: string;
    departamento: string | null;
    email: string;
  };
}
