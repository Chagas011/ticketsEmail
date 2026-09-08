import type { NextFunction, Request, Response } from "express";
import { jwtDecode } from "jwt-decode";

type JwtPayload = {
  sub?: string;
};

export function authMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return response.status(401).json({
      message: "Access token is required",
    });
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return response.status(401).json({
      message: "Invalid authorization header",
    });
  }
  const payload = jwtDecode<JwtPayload>(token);
  if (!payload.sub) {
    return response.status(401).json({
      message: "User ID not found in token",
    });
  }

  request.userId = payload.sub;

  return next();
}
