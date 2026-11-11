import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class GetGraphConversationUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  async execute(conversationId: string) {
    return await this.messages.getConversation(conversationId);
  }
}
