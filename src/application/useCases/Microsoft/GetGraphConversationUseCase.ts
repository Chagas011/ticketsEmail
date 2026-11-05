import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class GetGraphConversationUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  execute(conversationId: string) {
    return this.messages.getConversation(conversationId);
  }
}
