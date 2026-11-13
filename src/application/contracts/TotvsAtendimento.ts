// alterar para TYPES

export interface AnexoInput {
  nomeArquivo: string;
  buffer: Buffer;
  tamanhoBytes?: number;
  descricao?: string;
}

export interface CriarAtendimentoInput {
  coligada?: number;
  assunto: string;
  solicitacao: string;
  grupo: number;
  tipo: number;
  parametro?: number;
  abertura?: string | number;
  cliente?: { codigo?: string; tipo?: string } | string | number;
  tipoCliente?: string;
  usuarioAutenticado: {
    codigoUsuario: string;
    codPessoa?: number | null;
  };
  anexos?: AnexoInput[];
}

export interface AnexoProcessado {
  nomeArquivo: string;
  codArquivo?: number;
  sucesso: boolean;
  erro?: string;
}

export interface CriarAtendimentoOutput {
  codAtendimento: number;
  codColigada: number;
  codLocal: number;
  protocolo: string;
  statusRetorno?: string;
  anexosProcessados: AnexoProcessado[];
}
