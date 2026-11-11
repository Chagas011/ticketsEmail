import type { PassThrough } from "node:stream";
import { EmailEventRepository } from "../../../infra/memory/EmailEventRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class EmailEventsUseCase {
  constructor(private readonly events: EmailEventRepository) {}

  connect(response: PassThrough) {
    this.events.add(response);
  }

  disconnect(response: PassThrough) {
    this.events.remove(response);
  }
}
