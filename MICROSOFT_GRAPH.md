# Microsoft Graph: webhook e SSE

A API monitora a Inbox da conta Microsoft pessoal conectada. O Graph avisa o backend e a API envia apenas o `messageId` aos clientes SSE conectados. Nenhuma mensagem é buscada ou armazenada.

## Configuração

Siga [CONTA_PESSOAL.md](CONTA_PESSOAL.md) para configurar permissões delegadas, URI de retorno, variáveis de ambiente e login. A API só cria ou reaproveita a subscription depois que a conta for conectada; enquanto estiver conectada, verifica a validade a cada 15 minutos.

O endereço do túnel precisa estar acessível antes de iniciar a API. Os endpoints `POST /microsoft/webhook` e `POST /microsoft/lifecycle` respondem ao desafio de validação do Graph e recebem suas notificações. Se a URL pública ou o `GRAPH_CLIENT_STATE` mudar, remova a subscription antiga no Graph antes de iniciar novamente: o Graph não devolve o `clientState` das subscriptions existentes, e o endpoint de lifecycle não pode ser alterado em uma subscription existente. Consulte [subscriptions do Graph](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0).

## Teste SSE

Depois de conectar a conta conforme [CONTA_PESSOAL.md](CONTA_PESSOAL.md), abra `https://SEU_DOMINIO_PUBLICO/microsoft/events` no mesmo navegador. A autenticação também aceita o JWT delegado da API descrito em [AUTHENTICATION.md](AUTHENTICATION.md).

Depois envie um e-mail para a Inbox monitorada. Uma notificação válida produz:

```text
event: email.received
data: {"messageId":"ID_DA_MENSAGEM"}
```

A sessão criada pelo login pessoal usa cookie seguro. O `EventSource` nativo pode enviar esse cookie em uma aplicação na mesma origem; para o JWT no cabeçalho, use um cliente baseado em `fetch`. A API não habilita CORS. Qualquer usuário que possua a sessão pessoal ou um JWT válido com o escopo configurado recebe os eventos da mailbox conectada; restrições adicionais por usuário precisam ser implementadas separadamente.

Para buscar a mensagem diretamente no Graph, o front precisará de seu próprio access token delegado e permissão para ler essa mailbox. Nunca envie `GRAPH_CLIENT_SECRET`, `GRAPH_CLIENT_STATE` ou o token de aplicação ao navegador.

As conexões e o envio são em memória: uma desconexão, reinício ou instância diferente pode causar perda de eventos. A API registra eventos `missed`, mas não recupera mensagens perdidas; isso exigiria uma sincronização da Inbox. A subscription também pode emitir eventos repetidos. `created` significa que uma mensagem foi adicionada à Inbox, inclusive por movimentação, e não necessariamente que ela foi recebida naquele instante.

Execute `npm test` para verificar o fluxo pessoal e a entrega de eventos SSE com respostas simuladas da Microsoft.
