import { Usuario } from "../../../../application/entites/Usuario";
import { UsuarioEntity } from "../entities/UsuarioEntity";

export type UsuarioConsulta = Pick<
  UsuarioEntity,
  "CODCOLIGADA" | "CHAPA" | "NOME" | "CODSITUACAO" | "CODSECAO"
> & {
  DEPARTAMENTO: string | null;
  EMAIL: string;
  CODPESSOA: number | null;
  CODUSUARIO: string | null;
};

export class UsuarioMapper {
  static toEntity(domain: Usuario): UsuarioEntity {
    const entity = new UsuarioEntity();

    entity.CODCOLIGADA = domain.codColigada;
    entity.CHAPA = domain.chapa;
    entity.NOME = domain.nome;
    entity.CODSITUACAO = domain.codSituacao;
    entity.CODSECAO = domain.codSecao;

    return entity;
  }

  static toDomain(row: UsuarioConsulta): Usuario {
    return new Usuario({
      codColigada: row.CODCOLIGADA,
      chapa: row.CHAPA,
      nome: row.NOME,
      codSituacao: row.CODSITUACAO,
      codSecao: row.CODSECAO,
      departamento: row.DEPARTAMENTO,
      email: row.EMAIL,
      codigoUsuario: row.CODUSUARIO,
      codPessoa: row.CODPESSOA,
    });
  }
}
