import { Injectable } from "@/kernel/decorators/Injectable";

@Injectable()
export class AccountRepository {
  constructor() {}

  async getAll(): Promise<string> {
    return "LISTALL";
  }
}
