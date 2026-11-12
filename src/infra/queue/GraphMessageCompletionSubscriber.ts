import Redis from "ioredis";
import { Injectable } from "../../kernel/decorators/Injectable";
import { EmailEventRepository } from "../memory/EmailEventRepository";
import { GRAPH_MESSAGE_COMPLETED_CHANNEL } from "./GraphMessageCompletionPublisher";
import { redisConnection } from "./GraphMessageQueue";

@Injectable({ singleton: true })
export class GraphMessageCompletionSubscriber {
  private readonly redis = new Redis(redisConnection(true));

  constructor(private readonly events: EmailEventRepository) {
    this.redis.on("message", (channel, payload) => {
      if (channel !== GRAPH_MESSAGE_COMPLETED_CHANNEL) return;
      try {
        const event: unknown = JSON.parse(payload);
        if (
          !event ||
          typeof event !== "object" ||
          !("messageId" in event) ||
          typeof event.messageId !== "string" ||
          !("conversationId" in event) ||
          typeof event.conversationId !== "string"
        ) return;
        this.events.publish(event.messageId, event.conversationId);
      } catch (error) {
        console.error("[SSE] Evento de conclusão inválido", error);
      }
    });
    this.redis.on("error", (error) =>
      console.error("[SSE] Erro na inscrição Redis", error),
    );
  }

  async start() {
    await this.redis.subscribe(GRAPH_MESSAGE_COMPLETED_CHANNEL);
  }
}
