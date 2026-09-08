import { Controller } from "@/application/contracts/Controller";
import { Account } from "@/application/entites/Account";
import { AccountUseCase } from "@/application/useCases/Account/AccountUseCase";
import { Injectable } from "@/kernel/decorators/Injectable";

@Injectable()
export class AccountController extends Controller<
  "public",
  AccountController.Response
> {
  constructor(private readonly accountUseCase: AccountUseCase) {
    super();
  }

  protected override async handle(): Promise<
    Controller.Response<AccountController.Response>
  > {
    const { account } = await this.accountUseCase.execute();
    return {
      statusCode: 200,
      body: {
        account,
      },
    };
  }
}

export namespace AccountController {
  export type Response = {
    account: Account;
  };
}
