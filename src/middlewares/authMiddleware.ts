import type { NextFunction, Request, Response } from "express";
import type { JWTVerifyGetKey } from "jose" with { "resolution-mode": "import" };

type AuthConfig = { tenantId: string; audience: string; requiredScope: string };

function readConfig(): AuthConfig {
  const tenantId = process.env.GRAPH_TENANT_ID?.trim();
  const audience = process.env.AUTH_JWT_AUDIENCE?.trim();
  const requiredScope = process.env.AUTH_JWT_REQUIRED_SCOPE?.trim();
  const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!tenantId || !guid.test(tenantId) || !audience || !guid.test(audience) || audience.toLowerCase() === "00000003-0000-0000-c000-000000000000" || !requiredScope || /\s/.test(requiredScope)) {
    throw new Error("Configure GRAPH_TENANT_ID, AUTH_JWT_AUDIENCE e AUTH_JWT_REQUIRED_SCOPE");
  }
  return { tenantId, audience, requiredScope };
}


let cachedResolver: { tenantId: string; key: JWTVerifyGetKey } | undefined;
async function getKey(config: AuthConfig): Promise<JWTVerifyGetKey> {
  if (!cachedResolver || cachedResolver.tenantId !== config.tenantId) {
    const { createRemoteJWKSet } = await import("jose");
    cachedResolver = {
      tenantId: config.tenantId,
      key: createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${config.tenantId}/discovery/v2.0/keys`)),
    };
  }
  return cachedResolver.key;
}

export function createAuthMiddleware(config: AuthConfig, key: JWTVerifyGetKey) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const token = request.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) {
      response.status(401).json({ message: "Bearer token is required" });
      return;
    }

    try {
      const { jwtVerify } = await import("jose");
      const { payload } = await jwtVerify(token, key, {
        algorithms: ["RS256"],
        issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
        audience: config.audience,
        requiredClaims: ["exp", "iss", "aud", "sub", "tid", "ver", "scp"],
      });
      if (payload.tid !== config.tenantId || payload.ver !== "2.0" || typeof payload.sub !== "string" || !payload.sub.trim()) {
        response.status(401).json({ message: "Invalid access token" });
        return;
      }
      if (typeof payload.scp !== "string" || !payload.scp.split(" ").includes(config.requiredScope)) {
        response.status(403).json({ message: "Insufficient permissions" });
        return;
      }
      request.userId = payload.sub;
      next();
    } catch (error) {
      const { errors } = await import("jose");
      if (error instanceof errors.JWTInvalid || error instanceof errors.JWTExpired || error instanceof errors.JWTClaimValidationFailed || error instanceof errors.JWSInvalid || error instanceof errors.JWSSignatureVerificationFailed || error instanceof errors.JWKSNoMatchingKey || error instanceof errors.JOSEAlgNotAllowed || error instanceof errors.JOSENotSupported) {
        response.status(401).json({ message: "Invalid or expired access token" });
        return;
      }
      console.error("Falha ao validar token do Microsoft Entra:", error);
      response.status(503).json({ message: "Authentication service unavailable" });
    }
  };
}

export async function authMiddleware(request: Request, response: Response, next: NextFunction): Promise<void> {
  try {
    const config = readConfig();
    await createAuthMiddleware(config, await getKey(config))(request, response, next);
  } catch (error) {
    console.error("Configuração de autenticação inválida:", error);
    response.status(503).json({ message: "Authentication service unavailable" });
  }
}
