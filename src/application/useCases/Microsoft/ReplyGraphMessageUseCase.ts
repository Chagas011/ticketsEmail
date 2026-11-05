import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class ReplyGraphMessageUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  execute(messageId: string, comment: string): Promise<void> {
    return this.messages.reply(messageId, comment);
  }
}
