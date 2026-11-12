import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class LogGraphMessageUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  async execute(messageId: string) {
    const message = await this.messages.getById(messageId);
    console.info("[Graph] Mensagem recebida", messageId);
    return message;
  }
}
