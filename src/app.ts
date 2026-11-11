import "dotenv/config";
import express from "express";
import { routes } from "./routes";

const app = express();

const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim();
if (frontendOrigin) {
  const parsed = new URL(frontendOrigin);
  if ((parsed.protocol !== "http:" && parsed.protocol !== "https:") || parsed.origin !== frontendOrigin || parsed.username || parsed.password) {
    throw new Error("FRONTEND_ORIGIN deve conter somente uma origem HTTP(S), sem barra final");
  }
}

app.use((request, response, next) => {
  const origin = request.get("origin");
  response.vary("Origin");
  if (origin && origin === frontendOrigin) {
    response.set({
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
    });
  }
  if (request.method === "OPTIONS" && origin) {
    response.sendStatus(origin === frontendOrigin ? 204 : 403);
    return;
  }
  next();
});

app.use(express.json());

app.use(routes);

export { app };
