import type { Request, Response } from "express";

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
    });

    return response.status(result.statusCode).json(result.body);
  };
}
