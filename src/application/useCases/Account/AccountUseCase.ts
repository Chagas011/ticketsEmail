import { Account } from "@/application/entites/Account";
import { AccountRepository } from "@/infra/database/repositories/AccountRepository";
import { Injectable } from "@/kernel/decorators/Injectable";

@Injectable()
export class AccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute(): Promise<AccountUseCase.Output> {
    //const list = await this.accountRepository.getAll();

    const account = new Account({
      email: "EMAIL@EMAIL.COM",
    });

    return {
      account,
    };
  }
}

export namespace AccountUseCase {
  export type Input = void;

  export type Output = {
    account: Account;
  };
}
