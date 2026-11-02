import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class GetGraphMessageUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  execute(messageId: string): Promise<unknown> {
    return this.messages.getById(messageId, true);
  }
}
