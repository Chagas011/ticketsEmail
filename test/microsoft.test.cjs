require("reflect-metadata");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

Object.assign(process.env, {
  GRAPH_CLIENT_ID: "client", GRAPH_TENANT_ID: "tenant", GRAPH_CLIENT_SECRET: "secret",
  GRAPH_MAILBOX_USER_ID: "mailbox", GRAPH_PUBLIC_URL: "https://example.test",
  GRAPH_CLIENT_STATE: "a".repeat(40), SSE_ACCESS_TOKEN: "b".repeat(40),
});
const { app } = require("../src/app.ts");
const { GraphSubscriptionRepository } = require("../src/infra/microsoft/GraphSubscriptionRepository.ts");
const { ManageGraphSubscriptionUseCase } = require("../src/application/useCases/Microsoft/ManageGraphSubscriptionUseCase.ts");

test("webhook valida URL, rejeita SSE sem segredo e envia apenas IDs válidos", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let stream;
  try {
    const validation = await fetch(`${base}/microsoft/webhook?validationToken=a%2Bb%20c`, { method: "POST" });
    assert.equal(validation.status, 200);
    assert.match(validation.headers.get("content-type"), /^text\/plain/);
    assert.equal(await validation.text(), "a+b c");
    assert.equal((await fetch(`${base}/microsoft/events`)).status, 401);

    let receive;
    const event = new Promise((resolve) => { receive = resolve; });
    stream = http.get(`${base}/microsoft/events`, { headers: { Authorization: `Bearer ${process.env.SSE_ACCESS_TOKEN}` } });
    await new Promise((resolve, reject) => {
      stream.on("error", reject);
      stream.on("response", (response) => {
        assert.equal(response.statusCode, 200);
        response.setEncoding("utf8");
        let data = "";
        response.on("data", (chunk) => { data += chunk; if (data.includes("event: email.received")) receive(data); });
        response.once("data", resolve);
      });
    });
    const notification = await fetch(`${base}/microsoft/webhook`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: [
        { clientState: "invalid", tenantId: "tenant", changeType: "created", resourceData: { id: "invalid" } },
        { clientState: process.env.GRAPH_CLIENT_STATE, tenantId: "tenant", changeType: "created", resourceData: { id: "message+id/1" } },
      ] }),
    });
    assert.equal(notification.status, 202);
    const data = await Promise.race([event, new Promise((_, reject) => setTimeout(() => reject(new Error("SSE timeout")), 2000))]);
    assert.match(data, /event: email\.received/);
    assert.match(data, /"messageId":"message\+id\/1"/);
    assert.doesNotMatch(data, /invalid/);
  } finally {
    stream?.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("cria subscription e a reaproveita após reinício", async () => {
  const originalFetch = global.fetch;
  let saved;
  let creations = 0;
  let renewals = 0;
  global.fetch = async (url, options = {}) => {
    if (String(url).startsWith("https://login.microsoftonline.com/")) return Response.json({ access_token: "access" });
    assert.equal(options.headers.Authorization, "Bearer access");
    if (options.method === "POST") {
      creations++;
      const body = JSON.parse(options.body);
      assert.equal(body.resource, "users/mailbox/mailFolders('inbox')/messages");
      assert.equal(body.clientState, process.env.GRAPH_CLIENT_STATE);
      saved = { ...body, id: "subscription-1" };
      return Response.json(saved, { status: 201 });
    }
    if (options.method === "PATCH") { renewals++; return Response.json(saved); }
    return Response.json({ value: saved ? [saved] : [] });
  };
  try {
    const useCase = new ManageGraphSubscriptionUseCase(new GraphSubscriptionRepository());
    await useCase.execute();
    await useCase.execute();
    assert.equal(creations, 1);
    assert.equal(renewals, 0);
    await useCase.execute(true);
    assert.equal(renewals, 1);
    assert.equal(saved.notificationUrl, "https://example.test/microsoft/webhook");
    assert.equal(saved.lifecycleNotificationUrl, "https://example.test/microsoft/lifecycle");
  } finally { global.fetch = originalFetch; }
});
