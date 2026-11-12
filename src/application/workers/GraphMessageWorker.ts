import { Queue, Worker } from "bullmq";
import { TicketRepository } from "../../infra/database/repositories/TicketRepository";
import { UsuarioRepository } from "../../infra/database/repositories/UsuarioRepository";
import { TicketTriageRepository } from "../../infra/openai/TicketTriageRepository";
import { GraphMessageCompletionPublisher } from "../../infra/queue/GraphMessageCompletionPublisher";
import {
  GRAPH_MESSAGE_QUEUE,
  redisConnection,
} from "../../infra/queue/GraphMessageQueue";
import { Injectable } from "../../kernel/decorators/Injectable";
import { LogGraphMessageUseCase } from "../useCases/Microsoft/LogGraphMessageUseCase";

@Injectable()
export class GraphMessageWorker {
  constructor(
    private readonly logMessage: LogGraphMessageUseCase,
    private readonly tickets: TicketRepository,
    private readonly usuarios: UsuarioRepository,
    private readonly triage: TicketTriageRepository,
    private readonly completed: GraphMessageCompletionPublisher,
  ) {}

  async process(messageId: string) {
    const message = await this.logMessage.execute(messageId);
    if (
      !message ||
      typeof message !== "object" ||
      !("conversationId" in message) ||
      typeof message.conversationId !== "string" ||
      !message.conversationId.trim()
    ) {
      throw new Error("Mensagem do Graph sem conversationId válido");
    }
    const conversationId = message.conversationId;
    const ticket = await this.tickets.getByConversationID(conversationId);
    if (ticket) {
      await this.completed.publish(messageId, conversationId);
      return;
    }

    const from = "from" in message ? message.from : undefined;
    const emailAddress =
      from && typeof from === "object" && "emailAddress" in from
        ? from.emailAddress
        : undefined;
    const email =
      emailAddress && typeof emailAddress === "object" && "address" in emailAddress
        ? emailAddress.address
        : undefined;
    if (typeof email !== "string" || !email.trim()) return;

    const usuario = await this.usuarios.getUserByEmail(email.trim());
    if (!usuario) return;

    console.log("funcionario existente");

    const subject =
      "subject" in message && typeof message.subject === "string"
        ? message.subject
        : "";
    const body = "body" in message ? message.body : undefined;
    const content =
      body && typeof body === "object" && "content" in body
        ? body.content
        : undefined;
    const preview = "bodyPreview" in message ? message.bodyPreview : undefined;
    const text =
      typeof content === "string"
        ? content
        : typeof preview === "string"
          ? preview
          : "";
    if (!subject.trim() && !text.trim()) return;

    const result = await this.triage.evaluate(subject, text);
    if (!result.isTicket) return;

    console.info("[Graph] E-mail identificado como chamado", { conversationId });
  }

  async start() {
    const queue = new Queue(GRAPH_MESSAGE_QUEUE, {
      connection: redisConnection(),
    });
    try {
      await queue.setGlobalConcurrency(1);
    } finally {
      await queue.close();
    }

    const worker = new Worker<{ messageId: string }>(
      GRAPH_MESSAGE_QUEUE,
      async (job) => {
        await this.process(job.data.messageId);
      },
      { connection: redisConnection(true), concurrency: 1 },
    );

    worker.on("completed", (job) =>
      console.info("[Graph] Mensagem processada", job.id),
    );
    worker.on("failed", (job, error) =>
      console.error("[Graph] Falha ao processar mensagem", job?.id, error),
    );
    worker.on("error", (error) =>
      console.error("[Graph] Erro no worker", error),
    );

    const shutdown = async () => {
      await worker.close();
      await this.completed.close();
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
    console.info("[Graph] Worker de mensagens iniciado");
  }
}
