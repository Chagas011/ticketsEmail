import { createHash } from "node:crypto";
import { Queue } from "bullmq";
import { graphConfig } from "../../config/microsoftGraph";
import { Injectable } from "../../kernel/decorators/Injectable";

export const GRAPH_MESSAGE_QUEUE = "graph-messages";

export function redisConnection(worker = false) {
  const rawUrl = process.env.REDIS_URL?.trim();
  if (!rawUrl) throw new Error("REDIS_URL não configurada");
  const url = new URL(rawUrl);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:") {
    throw new Error("REDIS_URL deve usar redis:// ou rediss://");
  }
  const db = url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : 0;
  if (!Number.isInteger(db) || db < 0) throw new Error("Banco inválido em REDIS_URL");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    username: decodeURIComponent(url.username) || undefined,
    password: decodeURIComponent(url.password) || undefined,
    db,
    tls: url.protocol === "rediss:" ? {} : undefined,
    connectTimeout: worker ? 10000 : 2000,
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
  };
}

@Injectable({ singleton: true })
export class GraphMessageQueue {
  private queue?: Queue<{ messageId: string }>;

  private getQueue() {
    if (!this.queue) {
      this.queue = new Queue<{ messageId: string }>(GRAPH_MESSAGE_QUEUE, {
        connection: redisConnection(),
      });
      this.queue.on("error", (error) =>
        console.error("[Graph] Erro na conexão com a fila", error),
      );
    }
    return this.queue;
  }

  async enqueue(messageId: string) {
    const mailboxId = graphConfig().mailboxUserId;
    const jobId = createHash("sha256")
      .update(`${mailboxId}\0${messageId}`)
      .digest("hex");
    await this.getQueue().add(
      "log-message",
      { messageId },
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 60 * 60, count: 10000 },
      },
    );
  }
}
