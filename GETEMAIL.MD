# Listar e buscar emails com Microsoft Graph

Este guia mostra como consultar a caixa de entrada de uma mailbox corporativa com token **app-only**. Pressupõe que o app já autentica conforme [AUTHORIZATION.MD](./AUTHORIZATION.MD), que `GRAPH_MAILBOX` está configurado e que a autorização escolhida (permissão ampla do Entra ou Exchange Application RBAC restrito) permite leitura.

Para receber avisos em tempo real e então buscar a mensagem pelo ID, configure também [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD). A notificação do Graph é um aviso de alteração; este GET busca os dados da mensagem.

## 1. Listar mensagens da caixa de entrada

O endpoint de pasta usa `/users/{mailbox}/mailFolders/inbox/messages`. App-only não representa um usuário conectado, portanto use `/users/{mailbox}`, e não `/me`.

```ts
type GraphMessage = {
  id: string;
  subject?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  bodyPreview?: string;
};

async function listInbox(): Promise<GraphMessage[]> {
  const token = await getGraphToken(); // implementação de AUTHORIZATION.MD
  const mailbox = encodeURIComponent(process.env.GRAPH_MAILBOX!);
  const url = new URL(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/inbox/messages`,
  );
  url.searchParams.set("$top", "25");
  url.searchParams.set(
    "$select",
    "id,subject,from,receivedDateTime,bodyPreview",
  );
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error(
      `Graph list error: ${response.status} ${await response.text()}`,
    );
  }

  const data = (await response.json()) as {
    value: GraphMessage[];
    "@odata.nextLink"?: string;
  };

  // A resposta é uma página. Se existir @odata.nextLink, use aquela URL
  // completa para buscar a próxima página.
  return data.value;
}
```

`$top` limita o tamanho da página e `$select` solicita somente os campos necessários. Para percorrer mais mensagens, siga `@odata.nextLink` exatamente como retornado pelo Graph; não monte manualmente o próximo `$skip`. O corpo da resposta fica disponível como HTML ou texto ao buscar a mensagem individual. [Listar mensagens](https://learn.microsoft.com/en-us/graph/api/mailfolder-list-messages?view=graph-rest-1.0)

## 2. Buscar o conteúdo completo de uma mensagem

Guarde o `id` retornado na listagem. Quando o usuário abrir uma conversa, ou quando o webhook avisar sobre uma nova mensagem, use esse ID para buscar o corpo e os campos completos:

```ts
type GraphMessageDetails = GraphMessage & {
  body?: { contentType?: "text" | "html"; content?: string };
  toRecipients?: Array<{ emailAddress?: { name?: string; address?: string } }>;
  conversationId?: string;
  isRead?: boolean;
};

async function getMessage(messageId: string): Promise<GraphMessageDetails> {
  const token = await getGraphToken();
  const mailbox = encodeURIComponent(process.env.GRAPH_MAILBOX!);
  const id = encodeURIComponent(messageId);
  const url = new URL(
    `https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${id}`,
  );
  url.searchParams.set(
    "$select",
    "id,subject,from,toRecipients,receivedDateTime,body,conversationId,isRead",
  );

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Prefer: 'outlook.body-content-type="text"',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Graph get message error: ${response.status} ${await response.text()}`,
    );
  }

  return (await response.json()) as GraphMessageDetails;
}
```

O cabeçalho `Prefer` pede o corpo em texto. Se a interface precisar preservar formatação, solicite `html` e renderize o resultado de forma segura, sanitizando HTML antes de exibi-lo. A propriedade `bodyPreview` da listagem é apenas uma prévia, não substitui `body.content`.

## 3. Usar o ID recebido pelo webhook

O fluxo em conjunto fica assim:

1. A subscription observa a pasta Inbox da mailbox.
2. O Graph envia uma notificação para a rota pública do webhook contendo o ID do recurso.
3. O backend valida `clientState` e `subscriptionId`, extrai o ID e agenda o processamento.
4. Um worker chama `getMessage(messageId)` e obtém os detalhes atuais da mensagem.
5. O sistema atualiza a mensagem existente pela chave apropriada no armazenamento; não cria um novo registro a cada notificação repetida.

O webhook deve responder rapidamente; faça a leitura Graph fora da requisição de callback, por exemplo em uma fila. Para o tratamento da notificação, validação e renovação da subscription, consulte [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD).

## 4. Permissões e observações

- A leitura de mensagens com corpo requer `Mail.Read` no modelo de permissão escolhido. `Mail.ReadBasic` não inclui o corpo completo.
- Com Exchange Application RBAC, a função `Application Mail.Read` precisa incluir a mailbox no escopo. Não deixe a mesma permissão concedida sem escopo no Entra se o objetivo for restringir a mailbox.
- O ID pode mudar quando a mensagem é movida entre pastas. Se a aplicação precisa de um identificador estável durante movimentos, use o formato Immutable ID conforme a documentação do Graph e aplique o cabeçalho correspondente consistentemente nas operações que usam esse ID.
- Trate `429` respeitando `Retry-After`; trate `401` renovando o token e `403` verificando as permissões e o escopo da mailbox.
- Não exponha access tokens ao frontend nem grave tokens ou conteúdo sensível dos emails nos logs.

## Referências oficiais

- [Listar mensagens de uma pasta](https://learn.microsoft.com/en-us/graph/api/mailfolder-list-messages?view=graph-rest-1.0)
- [Obter uma mensagem](https://learn.microsoft.com/en-us/graph/api/message-get?view=graph-rest-1.0)
- [Paginação no Microsoft Graph](https://learn.microsoft.com/en-us/graph/paging)
- [Exchange Online Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
