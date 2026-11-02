import type { NextFunction, Request, Response } from "express";
import { Registry } from "../kernel/di/Registry";
import { PersonalGraphAuthRepository } from "../infra/microsoft/PersonalGraphAuthRepository";
import { authMiddleware } from "./authMiddleware";

export function personalOrJwtAuthMiddleware(request: Request, response: Response, next: NextFunction): void {
  const cookies = request.get("cookie")?.split(";") ?? [];
  const cookie = cookies.map((item) => item.trim()).find((item) => item.startsWith("graph_personal_session="));
  const session = cookie?.slice("graph_personal_session=".length);
  const auth = Registry.getInstance().resolve(PersonalGraphAuthRepository);
  if (auth.matchesSession(session)) {
    request.userId = "personal";
    request.authExpiresAt = auth.sessionExpiresAt();
    next();
    return;
  }
  void authMiddleware(request, response, next);
}
