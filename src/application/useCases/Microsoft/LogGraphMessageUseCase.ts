import { GraphMessageRepository } from "../../../infra/microsoft/GraphMessageRepository";
import { Injectable } from "../../../kernel/decorators/Injectable";

@Injectable()
export class LogGraphMessageUseCase {
  constructor(private readonly messages: GraphMessageRepository) {}

  async execute(messageId: string): Promise<void> {
    const message = await this.messages.getById(messageId);
    console.log("[Graph] Mensagem recebida:\n%s", JSON.stringify(message, null, 2));
  }
}
