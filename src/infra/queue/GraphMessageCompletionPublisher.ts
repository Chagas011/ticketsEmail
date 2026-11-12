import Redis from "ioredis";
import { Injectable } from "../../kernel/decorators/Injectable";
import { redisConnection } from "./GraphMessageQueue";

export const GRAPH_MESSAGE_COMPLETED_CHANNEL = "graph-message-completed";

@Injectable({ singleton: true })
export class GraphMessageCompletionPublisher {
  private readonly redis = new Redis(redisConnection(true));

  constructor() {
    this.redis.on("error", (error) =>
      console.error("[SSE] Erro ao publicar conclusão", error),
    );
  }

  async publish(messageId: string, conversationId: string) {
    await this.redis.publish(
      GRAPH_MESSAGE_COMPLETED_CHANNEL,
      JSON.stringify({ messageId, conversationId }),
    );
  }

  async close() {
    await this.redis.quit();
  }
}
