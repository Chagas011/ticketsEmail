# Microsoft Graph: webhook e SSE

A API monitora a Inbox de uma mailbox fixa do Microsoft 365. O Graph avisa o backend e a API envia apenas o `messageId` aos clientes SSE conectados. Nenhuma mensagem é buscada ou armazenada.

## Configuração

1. No Microsoft Entra ID, configure a permissão de **aplicativo** Microsoft Graph `Mail.Read` e conceda o consentimento de administrador. Crie um client secret e copie o **valor**, não o ID do segredo.
2. Copie `.env.example` para `.env` dentro de `api`. Os IDs do aplicativo e do locatário já estão no exemplo.
3. Preencha `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX_USER_ID` (Object ID do usuário que possui a mailbox, não o Object ID do aplicativo) e `GRAPH_PUBLIC_URL` (base HTTPS pública que encaminhe para a porta 3001).
4. Gere `GRAPH_CLIENT_STATE` com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Mantenha esse valor estável enquanto a subscription existir.
5. Configure a autenticação da API conforme [AUTHENTICATION.md](AUTHENTICATION.md).
6. Execute `npm run dev`. Após o servidor começar a escutar, ele cria ou reaproveita a subscription e verifica sua validade a cada 15 minutos. Os erros aparecem no console e são tentados novamente na próxima verificação.

O endereço do túnel precisa estar acessível antes de iniciar a API. Os endpoints `POST /microsoft/webhook` e `POST /microsoft/lifecycle` respondem ao desafio de validação do Graph e recebem suas notificações. Se a URL pública ou o `GRAPH_CLIENT_STATE` mudar, remova a subscription antiga no Graph antes de iniciar novamente: o Graph não devolve o `clientState` das subscriptions existentes, e o endpoint de lifecycle não pode ser alterado em uma subscription existente. Consulte [subscriptions do Graph](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0).

## Teste SSE

Obtenha um access token delegado v2 para a API com o escopo configurado e conecte com curl (em PowerShell use `curl.exe`):

```powershell
curl.exe -N -H "Authorization: Bearer SEU_ACCESS_TOKEN_DA_API" http://localhost:3001/microsoft/events
```

Depois envie um e-mail para a Inbox monitorada. Uma notificação válida produz:

```text
event: email.received
data: {"messageId":"ID_DA_MENSAGEM"}
```

O `EventSource` nativo não permite enviar o cabeçalho `Authorization`; ao integrar o front, use um cliente SSE baseado em `fetch` com o token da API, ou adapte a autenticação para sessão com cookie seguro. A API não habilita CORS; para origens diferentes será necessário configurar uma política explícita. Qualquer usuário que possua um token válido com o escopo configurado recebe os eventos da mailbox fixa; restrições por usuário ou mailbox precisam ser implementadas separadamente.

Para buscar a mensagem diretamente no Graph, o front precisará de seu próprio access token delegado e permissão para ler essa mailbox. Nunca envie `GRAPH_CLIENT_SECRET`, `GRAPH_CLIENT_STATE` ou o token de aplicação ao navegador.

As conexões e o envio são em memória: uma desconexão, reinício ou instância diferente pode causar perda de eventos. A API registra eventos `missed`, mas não recupera mensagens perdidas; isso exigiria uma sincronização da Inbox. A subscription também pode emitir eventos repetidos. `created` significa que uma mensagem foi adicionada à Inbox, inclusive por movimentação, e não necessariamente que ela foi recebida naquele instante.

Execute `npm test` para verificar a autenticação e a entrega de eventos SSE usando chaves de teste locais.
