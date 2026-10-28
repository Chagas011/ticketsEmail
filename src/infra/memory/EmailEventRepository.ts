import type { Response } from "express";
import { Injectable } from "../../kernel/decorators/Injectable";

@Injectable()
export class EmailEventRepository {
  private static readonly clients = new Set<Response>();

  add(response: Response): void {
    EmailEventRepository.clients.add(response);
  }

  remove(response: Response): void {
    EmailEventRepository.clients.delete(response);
  }

  publish(messageId: string): void {
    const event = `event: email.received\ndata: ${JSON.stringify({ messageId })}\n\n`;
    for (const client of EmailEventRepository.clients) {
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
