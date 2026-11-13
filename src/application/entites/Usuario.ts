export class Usuario {
  readonly codColigada: number;
  readonly chapa: string;
  readonly nome: string;
  readonly codSituacao: string;
  readonly codSecao: string;
  readonly departamento: string | null;
  readonly email: string;
  readonly codigoUsuario: string | null;
  readonly codPessoa: number | null;

  constructor(attr: Usuario.Attributes) {
    this.codColigada = attr.codColigada;
    this.chapa = attr.chapa;
    this.nome = attr.nome;
    this.codSituacao = attr.codSituacao;
    this.codSecao = attr.codSecao;
    this.departamento = attr.departamento;
    this.email = attr.email;
    this.codigoUsuario = attr.codigoUsuario;
    this.codPessoa = attr.codPessoa;
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
    codigoUsuario: string | null;
    codPessoa: number | null;
  };
}
