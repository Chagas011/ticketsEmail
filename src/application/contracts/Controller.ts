import { getSchema } from "@/kernel/decorators/Schema";
import type { Readable } from "node:stream";

type TRouteType = "public" | "private";

export abstract class Controller<TType extends TRouteType, TBody = undefined> {
  protected abstract handle(
    params: Controller.Request<TType>,
  ): Promise<Controller.Response<TBody>>;

  execute(
    request: Controller.Request<TType>,
  ): Promise<Controller.Response<TBody>> {
    const body = this.validateBody(request.body);
    return this.handle({
      ...request,
      body,
    });
  }

  private validateBody<T>(body: Controller.Request<TType>["body"]) {
    const schema = getSchema(this);
    if (!schema) {
      return body;
    }

    return schema.parse(body) as T;
  }
}

export namespace Controller {
  type BaseRequest<
    TBody = Record<string, unknown>,
    TParams = Record<string, unknown>,
    TQueryParams = Record<string, unknown>,
  > = {
    body: TBody;
    params: TParams;
    queryParams: TQueryParams;
    contentType?: string;
  };

  type PublicRequest<
    TBody = Record<string, unknown>,
    TParams = Record<string, unknown>,
    TQueryParams = Record<string, unknown>,
  > = BaseRequest<TBody, TParams, TQueryParams> & {
    accountId: null;
  };

  type PrivateRequest<
    TBody = Record<string, unknown>,
    TParams = Record<string, unknown>,
    TQueryParams = Record<string, unknown>,
  > = BaseRequest<TBody, TParams, TQueryParams> & {
    accountId: string;
  };

  export type Request<
    TType extends TRouteType,
    TBody = Record<string, unknown>,
    TParams = Record<string, unknown>,
    TQueryParams = Record<string, unknown>,
  > = TType extends "public"
    ? PublicRequest<TBody, TParams, TQueryParams>
    : PrivateRequest<TBody, TParams, TQueryParams>;

  export type Response<TBody = undefined> = {
    statusCode: number;
    body?: TBody;
    headers?: Record<string, string>;
    format?: "json" | "text" | "stream";
    stream?: Readable;
    onClose?: () => unknown;
    afterSend?: () => Promise<unknown>;
  };
}
