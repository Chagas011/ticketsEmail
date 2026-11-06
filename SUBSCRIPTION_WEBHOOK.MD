# Subscription e webhook para Microsoft Graph

Guia para receber notificações de alterações em uma mailbox corporativa do Microsoft Graph. Pressupõe que um novo backend single tenant já consegue obter um token app-only conforme [AUTHORIZATION.MD](./AUTHORIZATION.MD). Para acompanhar mensagens, o app precisa de permissão de aplicação `Mail.Read` com consentimento administrativo.

## 1. Defina e publique a rota da API

Crie no backend uma rota HTTP `POST`, por exemplo:

```text
POST /graph/notifications
```

Publique a API em um host acessível pela internet com HTTPS. Por exemplo:

```text
https://api.exemplo.com/graph/notifications
```

**Não existe um campo de webhook na tela App registrations do Azure.** A URL pública é informada ao Microsoft Graph na criação da subscription, no campo `notificationUrl` do corpo de `POST https://graph.microsoft.com/v1.0/subscriptions`.

## 2. Configure as variáveis

```dotenv
GRAPH_MAILBOX=<UPN-ou-ID-da-mailbox>
GRAPH_WEBHOOK_URL=https://api.exemplo.com/graph/notifications
GRAPH_CLIENT_STATE=<valor-aleatorio-de-32-a-128-caracteres>
GRAPH_SUBSCRIPTION_ID=<id-retornado-ao-criar-a-subscription>
```

Gere `GRAPH_CLIENT_STATE` com um valor criptograficamente aleatório. Um exemplo de comando é `openssl rand -hex 32`. Não reutilize senha, client secret ou token como `clientState`.

## 3. Responda ao desafio de validação

Quando o Graph cria uma subscription, primeiro faz uma requisição de validação para `notificationUrl` com o query parameter `validationToken`. A rota deve responder em até 10 segundos com HTTP 200, tipo `text/plain` e o valor decodificado do token no corpo. Essa chamada inicial não contém o payload normal de notificações. [Validação de webhook do Microsoft Graph](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)

Exemplo mínimo em Express:

```ts
app.post("/graph/notifications", express.json(), (req, res) => {
  const validationToken = req.query.validationToken;
  if (typeof validationToken === "string") {
    res.status(200).type("text/plain").send(validationToken);
    return;
  }

  const notifications = req.body?.value;
  if (!Array.isArray(notifications)) {
    res.sendStatus(400);
    return;
  }

  for (const item of notifications) {
    if (item.clientState !== process.env.GRAPH_CLIENT_STATE) continue;
    if (item.subscriptionId !== process.env.GRAPH_SUBSCRIPTION_ID) continue;
    if (item.changeType !== "created") continue;

    const messageId = item.resourceData?.id;
    if (typeof messageId === "string") {
      // Enfileire o ID para buscar a mensagem no Graph depois de responder.
      console.log("Nova mensagem", messageId);
    }
  }

  res.sendStatus(202);
});
```

### Quando e por quem essa função é chamada?

`app.post(...)` registra a rota no servidor Express quando sua API inicia. Ela não executa a subscription nem é chamada pelo frontend. O Microsoft Graph chama a URL pública configurada em `notificationUrl` usando requisições HTTP `POST`:

1. **Na criação da subscription**, o Graph envia um `POST` com `?validationToken=...`. O primeiro `if` devolve esse desafio em texto puro; assim o Graph confirma que sua API controla aquela URL.
2. **Quando chega um email novo**, o Graph envia outro `POST`, agora com um JSON cujo `value` contém uma ou mais notificações. O código percorre cada item, confere se veio da subscription esperada (`subscriptionId`), compara o segredo (`clientState`) e filtra o tipo de alteração (`created`).
3. Para cada item válido, `resourceData.id` contém o ID da mensagem. O exemplo apenas imprime esse ID no log. Para o sistema realmente processar o email, substitua o `console.log` por uma fila ou por uma chamada ao serviço que busca a mensagem no Graph.
4. `res.sendStatus(202)` confirma ao Graph que a notificação foi recebida. O processamento demorado deve continuar fora da requisição, por exemplo em uma fila.

Em resumo: sua API registra a rota; o Graph a chama automaticamente durante a validação e depois a cada mudança coberta pela subscription. A URL deve chegar exatamente à aplicação que contém esse `app.post`. Um teste manual da resposta de validação pode ser feito com:

```bash
curl -i -X POST 'https://api.exemplo.com/graph/notifications?validationToken=teste123'
```

O esperado é HTTP `200`, `Content-Type: text/plain` e o corpo `teste123`. Esse teste verifica somente a rota e a resposta; não cria uma subscription nem simula uma notificação real.

Configure `GRAPH_SUBSCRIPTION_ID` com o `id` devolvido na criação e salve também esse ID em armazenamento durável. Em produção, valide `subscriptionId` e `clientState` contra a subscription salva; não confie apenas no conteúdo da notificação. Faça o trabalho pesado numa fila e responda ao Graph rapidamente. A notificação é um aviso de mudança: use o ID recebido para buscar o conteúdo da mensagem no Graph.

## 4. Registre a URL com `POST /subscriptions`

Obtenha o token app-only descrito em [AUTHORIZATION.MD](./AUTHORIZATION.MD) e crie a subscription:

```ts
const token = await getGraphToken(); // função de autenticação app-only
const mailbox = process.env.GRAPH_MAILBOX!;

const response = await fetch("https://graph.microsoft.com/v1.0/subscriptions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    changeType: "created",
    notificationUrl: process.env.GRAPH_WEBHOOK_URL,
    resource: `/users/${encodeURIComponent(mailbox)}/mailFolders('Inbox')/messages`,
    expirationDateTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    clientState: process.env.GRAPH_CLIENT_STATE,
  }),
});

if (!response.ok) {
  throw new Error(
    `Subscription error: ${response.status} ${await response.text()}`,
  );
}

const subscription = await response.json();
// Persista subscription.id e subscription.expirationDateTime.
console.log(subscription.id, subscription.expirationDateTime);
```

O valor enviado em `notificationUrl` é a rota pública completa. O Graph chama esse endereço para validar o endpoint e, depois, para entregar as notificações. Assim, a URL é registrada na chamada ao Graph, não manualmente no registro do aplicativo Azure. A operação requer permissão de leitura para o recurso; para mensagens, `Mail.Read` é suportada. [Criar subscription](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0) · [Change notifications para Outlook](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview)

## 5. Renovação e operação

Subscriptions expiram. Armazene o `id` e `expirationDateTime` retornados e execute uma rotina de renovação antes do vencimento:

```http
PATCH https://graph.microsoft.com/v1.0/subscriptions/<SUBSCRIPTION_ID>
Authorization: Bearer <GRAPH_ACCESS_TOKEN>
Content-Type: application/json

{
  "expirationDateTime": "<nova-data-em-ISO-8601>"
}
```

Não assuma uma duração máxima fixa: ela depende do recurso e do tipo de notificação. Calcule a nova expiração dentro dos limites atuais do Graph, monitore falhas de renovação e recrie a subscription se ela tiver expirado ou sido removida. [Renovar subscription](https://learn.microsoft.com/en-us/graph/api/subscription-update?view=graph-rest-1.0)

## 6. Checklist

- A rota responde externamente por HTTPS e não exige login de usuário durante o desafio de validação.
- `notificationUrl` corresponde ao endereço público completo, incluindo caminho.
- O desafio `validationToken` retorna como texto puro e HTTP 200.
- A chamada `POST /subscriptions` usa token app-only e a mailbox da subscription está correta.
- O backend confere `clientState` e `subscriptionId`, enfileira o trabalho e responde rapidamente.
- O ID e a expiração da subscription estão armazenados para renovação automática.
- Tokens, segredos e conteúdo de emails não são gravados nos logs.

## Referências oficiais

- [Receber change notifications via webhooks](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Criar uma subscription](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0)
- [Atualizar uma subscription](https://learn.microsoft.com/en-us/graph/api/subscription-update?view=graph-rest-1.0)
- [Change notifications para recursos Outlook](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview)
