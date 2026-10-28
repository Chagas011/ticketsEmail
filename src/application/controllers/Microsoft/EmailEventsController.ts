import type { Request, Response } from "express";
import { graphConfig } from "../../../config/microsoftGraph";
import { Registry } from "../../../kernel/di/Registry";
import { matchesSecret } from "../../useCases/Microsoft/ReceiveGraphNotificationUseCase";
import { EmailEventsUseCase } from "../../useCases/Microsoft/EmailEventsUseCase";

export class EmailEventsController {
  static handle(request: Request, response: Response): void {
    const token = request.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (!matchesSecret(token, graphConfig().sseToken)) {
      response.sendStatus(401);
      return;
    }
    response.status(200).set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" });
    response.flushHeaders();
    response.write(": connected\n\n");
    const events = Registry.getInstance().resolve(EmailEventsUseCase);
    events.connect(response);
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 25000);
    request.on("close", () => { clearInterval(heartbeat); events.disconnect(response); });
  }
}
