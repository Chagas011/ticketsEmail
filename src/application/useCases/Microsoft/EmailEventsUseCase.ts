import type { Response } from "express";
import { EmailEventRepository } from "../../../infra/memory/EmailEventRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class EmailEventsUseCase {
  constructor(private readonly events: EmailEventRepository) {}

  connect(response: Response): void {
    this.events.add(response);
  }

  disconnect(response: Response): void {
    this.events.remove(response);
  }
}
