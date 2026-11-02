import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { graphConfig } from "../../../config/microsoftGraph";
import { Registry } from "../../../kernel/di/Registry";
import { ConnectPersonalAccountUseCase } from "../../useCases/Microsoft/ConnectPersonalAccountUseCase";
import { matchesSecret } from "../../useCases/Microsoft/ReceiveGraphNotificationUseCase";

export class PersonalAccountController {
  static page(_request: Request, response: Response): void {
    if (process.env.MICROSOFT_CONNECT_UI !== "true") {
      response.sendStatus(404);
      return;
    }
    const nonce = randomBytes(16).toString("base64");
    response.set({
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    });
    response.type("html").send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Conectar conta Microsoft</title></head>
<body><main><h1>Conectar conta Microsoft</h1>
<p>Informe o GRAPH_CONNECT_SECRET configurado no servidor. Em seguida, você será direcionado à Microsoft para entrar e autorizar o acesso à caixa de entrada.</p>
<form id="connect-form"><label for="connect-secret">Segredo de conexão</label>
<input id="connect-secret" type="password" autocomplete="off" minlength="32" required>
<button type="submit">Conectar com Microsoft</button></form>
<p id="message" role="status" aria-live="polite"></p></main>
<script nonce="${nonce}">
  const form = document.getElementById('connect-form');
  const input = document.getElementById('connect-secret');
  const message = document.getElementById('message');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!window.isSecureContext) { message.textContent = 'Abra esta página por HTTPS para conectar.'; return; }
    const secret = input.value;
    input.value = '';
    message.textContent = 'Preparando login...';
    try {
      const response = await fetch('/microsoft/connect', { method: 'POST', headers: { Authorization: 'Bearer ' + secret }, cache: 'no-store' });
      if (response.status === 401) { message.textContent = 'Segredo de conexão inválido.'; return; }
      if (!response.ok) throw new Error('connect failed');
      const data = await response.json();
      const url = new URL(data.authorizationUrl);
      if (url.origin !== 'https://login.microsoftonline.com') throw new Error('invalid authorization URL');
      window.location.assign(url.href);
    } catch { message.textContent = 'Não foi possível iniciar o login. Confira a API e tente novamente.'; }
  });
</script></body></html>`);
  }

  static start(request: Request, response: Response): void {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const secret = request.get("authorization")?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!matchesSecret(secret, graphConfig().connectSecret)) { response.sendStatus(401); return; }
    const authorizationUrl = Registry.getInstance().resolve(ConnectPersonalAccountUseCase).start();
    response.json({ authorizationUrl });
  }

  static async callback(request: Request, response: Response): Promise<void> {
    response.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    const { state, code } = request.query;
    if (typeof state !== "string" || typeof code !== "string" || !code) {
      response.status(400).send("Autorização cancelada ou inválida. Inicie a conexão novamente."); return;
    }
    const useCase = Registry.getInstance().resolve(ConnectPersonalAccountUseCase);
    try { await useCase.finish(state, code); }
    catch (error) {
      console.error("Falha ao conectar conta Microsoft:", error instanceof Error ? error.message : "erro desconhecido");
      response.status(400).send("Não foi possível conectar a conta. Consulte os logs e inicie a conexão novamente."); return;
    }
    response.cookie("graph_personal_session", useCase.createSession(), { httpOnly: true, secure: true, sameSite: "lax", path: "/microsoft/events", maxAge: 12 * 60 * 60 * 1000 });
    try {
      await useCase.reconcile();
      response.status(200).send("Conta conectada e subscription ativa. A conexão SSE pode ser aberta neste navegador.");
    } catch (error) {
      console.error("Conta conectada, mas falhou a subscription:", error instanceof Error ? error.message : "erro desconhecido");
      response.status(503).send("Conta conectada, mas a subscription falhou. Consulte os logs; a API tentará novamente.");
    }
  }
}
