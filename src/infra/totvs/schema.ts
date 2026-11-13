import z from "zod";

export const atendimentoOutputSchema = z.object({
  codAtendimento: z.number().int(),
  codColigada: z.number().int(),
  codLocal: z.number().int(),
  protocolo: z.string().min(1).max(255),
  statusRetorno: z.string().optional(),
  anexosProcessados: z.array(
    z.object({
      nomeArquivo: z.string(),
      codArquivo: z.number().int().optional(),
      sucesso: z.boolean(),
      erro: z.string().optional(),
    }),
  ),
});
