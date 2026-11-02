import type { NextFunction, Request, Response } from "express";
import { Registry } from "../kernel/di/Registry";
import { PersonalGraphAuthRepository } from "../infra/microsoft/PersonalGraphAuthRepository";
import { authMiddleware } from "./authMiddleware";

function usePersonalSession(request: Request): boolean {
  const cookies = request.get("cookie")?.split(";") ?? [];
  const auth = Registry.getInstance().resolve(PersonalGraphAuthRepository);
  const hasSession = cookies.map((item) => item.trim())
    .filter((item) => item.startsWith("graph_personal_session="))
    .some((item) => auth.matchesSession(item.slice("graph_personal_session=".length)));
  if (hasSession) {
    request.userId = "personal";
    request.authExpiresAt = auth.sessionExpiresAt();
    return true;
  }
  return false;
}

export function personalSessionMiddleware(request: Request, response: Response, next: NextFunction): void {
  if (usePersonalSession(request)) { next(); return; }
  response.status(401).json({ message: "Conecte sua conta Microsoft para visualizar a mensagem." });
}

export function personalOrJwtAuthMiddleware(request: Request, response: Response, next: NextFunction): void {
  if (usePersonalSession(request)) { next(); return; }
  void authMiddleware(request, response, next);
}
