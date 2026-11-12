import { Usuario } from "../../../application/entites/Usuario";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { AppDataSource } from "../typeorm/data-source";
import {
  UsuarioConsulta,
  UsuarioMapper,
} from "../typeorm/mappers/UsuarioMapper";

@Injectable()
export class UsuarioRepository {
  async getUserByEmail(email: string): Promise<Usuario | null> {
    const usuarios = (await AppDataSource.query(
      `SELECT
         F.CODCOLIGADA,
         F.CHAPA,
         F.NOME,
         F.CODSITUACAO,
         F.CODSECAO,
         S.DESCRICAO AS DEPARTAMENTO,
         P.EMAIL
       FROM U_CTG812_RM.PFUNC F
       INNER JOIN U_CTG812_RM.PPESSOA P
         ON P.CODIGO = F.CODPESSOA
       LEFT JOIN U_CTG812_RM.PSECAO S
         ON S.CODCOLIGADA = F.CODCOLIGADA
         AND S.CODIGO = F.CODSECAO
       WHERE LOWER(TRIM(P.EMAIL)) = LOWER(TRIM(:1))`,
      [email],
    )) as UsuarioConsulta[];

    return usuarios[0] ? UsuarioMapper.toDomain(usuarios[0]) : null;
  }
}
