import type { PassThrough } from "node:stream";
import { Injectable } from "../../kernel/decorators/Injectable";

@Injectable({ singleton: true })
export class EmailEventRepository {
  private readonly clients = new Set<PassThrough>();

  add(response: PassThrough) {
    this.clients.add(response);
  }

  remove(response: PassThrough) {
    this.clients.delete(response);
  }


  publish(messageId: string) {
    console.info("[SSE] Publicando evento", {
      clientesConectados: this.clients.size,
    });
    const event = `event: email.received\ndata: ${JSON.stringify({ messageId })}\n\n`;
    for (const client of this.clients) {
      try {
        if (client.destroyed || client.writableEnded) this.remove(client);
        else if (!client.write(event)) {
          this.remove(client);
          client.destroy();
        }
      } catch {
        this.remove(client);
        client.destroy();
      }
    }
  }
}
