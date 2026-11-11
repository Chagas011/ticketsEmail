import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class ReplyGraphMessageUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  async execute(messageId: string, comment: string) {
    await this.messages.reply(messageId, comment);
  }
}
