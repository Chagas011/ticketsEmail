import { PassThrough } from "node:stream";
import { Controller } from "../../contracts/Controller";
import { Injectable } from "../../../kernel/decorators/Injectable";
import { EmailEventsUseCase } from "../../useCases/Microsoft/EmailEventsUseCase";

@Injectable()
export class EmailEventsController extends Controller<"public", unknown> {
  constructor(private readonly events: EmailEventsUseCase) { super(); }

  protected async handle(_request: Controller.Request<"public">): Promise<Controller.Response<unknown>> {
    const stream = new PassThrough();
    stream.write(": connected\n\n");
    this.events.connect(stream);
    const heartbeat = setInterval(() => stream.write(": heartbeat\n\n"), 25000);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
      format: "stream",
      stream,
      onClose: () => {
        clearInterval(heartbeat);
        this.events.disconnect(stream);
        stream.destroy();
      },
    };
  }
}
