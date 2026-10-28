# Microsoft Graph: webhook e SSE

A API monitora a Inbox de uma mailbox fixa do Microsoft 365. O Graph avisa o backend e a API envia apenas o `messageId` aos clientes SSE conectados. Nenhuma mensagem é buscada ou armazenada.

## Configuração

1. No Microsoft Entra ID, configure a permissão de **aplicativo** Microsoft Graph `Mail.Read` e conceda o consentimento de administrador. Crie um client secret e copie o **valor**, não o ID do segredo.
2. Copie `.env.example` para `.env` dentro de `api`. Os IDs do aplicativo e do locatário já estão no exemplo.
3. Preencha `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX_USER_ID` (Object ID do usuário que possui a mailbox, não o Object ID do aplicativo) e `GRAPH_PUBLIC_URL` (base HTTPS pública que encaminhe para a porta 3001).
4. Gere dois valores aleatórios independentes para `GRAPH_CLIENT_STATE` e `SSE_ACCESS_TOKEN`. Por exemplo, execute duas vezes `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` e use um resultado em cada variável. Mantenha o `GRAPH_CLIENT_STATE` estável enquanto a subscription existir.
5. Execute `npm run dev`. Após o servidor começar a escutar, ele cria ou reaproveita a subscription e verifica sua validade a cada 15 minutos. Os erros aparecem no console e são tentados novamente na próxima verificação.

O endereço do túnel precisa estar acessível antes de iniciar a API. Os endpoints `POST /microsoft/webhook` e `POST /microsoft/lifecycle` respondem ao desafio de validação do Graph e recebem suas notificações. Se a URL pública ou o `GRAPH_CLIENT_STATE` mudar, remova a subscription antiga no Graph antes de iniciar novamente: o Graph não devolve o `clientState` das subscriptions existentes, e o endpoint de lifecycle não pode ser alterado em uma subscription existente. Consulte [subscriptions do Graph](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0).

## Teste SSE

Em outro terminal, conecte com curl (em PowerShell use `curl.exe`):

```powershell
curl.exe -N -H "Authorization: Bearer SEU_SSE_ACCESS_TOKEN" http://localhost:3001/microsoft/events
```

Depois envie um e-mail para a Inbox monitorada. Uma notificação válida produz:

```text
event: email.received
data: {"messageId":"ID_DA_MENSAGEM"}
```

O segredo SSE é uma proteção provisória para testes confiáveis, não deve ser embutido em um aplicativo React público. O `EventSource` nativo não permite enviar o cabeçalho `Authorization`; ao integrar o front, implemente autenticação de usuário validada (por exemplo sessão com cookie seguro), ou use um cliente SSE baseado em `fetch` com autenticação apropriada. O middleware JWT atual apenas decodifica o token e não valida sua assinatura. A API não habilita CORS; para origens diferentes será necessário configurar uma política explícita.

Para buscar a mensagem diretamente no Graph, o front precisará de seu próprio access token delegado e permissão para ler essa mailbox. Nunca envie `GRAPH_CLIENT_SECRET`, `GRAPH_CLIENT_STATE` ou o token de aplicação ao navegador.

As conexões e o envio são em memória: uma desconexão, reinício ou instância diferente pode causar perda de eventos. A API registra eventos `missed`, mas não recupera mensagens perdidas; isso exigiria uma sincronização da Inbox. A subscription também pode emitir eventos repetidos. `created` significa que uma mensagem foi adicionada à Inbox, inclusive por movimentação, e não necessariamente que ela foi recebida naquele instante.

Execute `npm test` para verificar o webhook, SSE e criação/reutilização da subscription com respostas simuladas do Graph.
