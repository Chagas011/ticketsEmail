import type { Request, Response } from "express";
import { pipeline } from "node:stream/promises";

import { Controller } from "@/application/contracts/Controller";
import { Registry } from "@/kernel/di/Registry";
import type { Constructor } from "@/shared/types/Constructor";

export function expressRouteAdapter(
  controllerClass: Constructor<Controller<"public" | "private", unknown>>,
) {
  return async (request: Request, response: Response) => {
    const controller = Registry.getInstance().resolve(controllerClass);
    const result = await controller.execute({
      body: request.body,
      params: request.params,
      queryParams: request.query,
      accountId: request.userId ?? null,
      contentType: request.is("application/json") || undefined,
    });

    response.status(result.statusCode);
    if (result.headers) response.set(result.headers);

    if (result.format === "stream") {
      if (!result.stream) throw new Error("Controller não retornou o stream");
      if (result.onClose) response.once("close", result.onClose);
      response.flushHeaders();
      try {
        await pipeline(result.stream, response);
      } catch (error) {
        if (!response.destroyed) throw error;
      }
      return;
    }
    if (result.format === "text") response.send(result.body);
    else if (result.body === undefined) response.end();
    else response.json(result.body);
    if (result.afterSend) await result.afterSend();
  };
}
