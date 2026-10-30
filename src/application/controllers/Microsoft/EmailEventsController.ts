import type { Request, Response } from "express";
import { Registry } from "../../../kernel/di/Registry";
import { EmailEventsUseCase } from "../../useCases/Microsoft/EmailEventsUseCase";

export class EmailEventsController {
  static handle(request: Request, response: Response): void {
    response
      .status(200)
      .set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
    response.flushHeaders();
    response.write(": connected\n\n");
    const events = Registry.getInstance().resolve(EmailEventsUseCase);
    events.connect(response);
    const heartbeat = setInterval(
      () => response.write(": heartbeat\n\n"),
      25000,
    );
    request.on("close", () => {
      clearInterval(heartbeat);
      events.disconnect(response);
    });
  }
}
