import { ErrorCode } from "../ErrorCode";
import { ApplicationError } from "./ApplicationError";

export class ResouceNotFound extends ApplicationError {
  public override code: ErrorCode;
  public override statusCode = 404;
  constructor() {
    super();

    this.name = "ResouceNotFound";
    this.code = ErrorCode.RESOUCE_NOT_FOUND;
    this.message = "Resource not found";
  }
}
