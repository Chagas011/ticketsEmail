# Documentação técnica da integração com Microsoft Graph

Este documento explica como a integração implementada neste repositório funciona arquivo por arquivo e propõe um roteiro para recriá-la para uma mailbox corporativa. A documentação de configuração Azure e permissões está em [PRODUCAO_GRAPH.md](PRODUCAO_GRAPH.md); este arquivo foca na relação entre código, responsabilidades e ordem de implementação.

## 1. Visão do fluxo existente

```text
Navegador do operador
  └─ GET /microsoft/connect
       └─ POST /microsoft/connect (GRAPH_CONNECT_SECRET)
            └─ Microsoft OAuth → GET /microsoft/oauth/callback
                 └─ tokens delegados guardados em memória
                      └─ criar/renovar subscription Graph
                           └─ Graph valida POST /microsoft/webhook e /microsoft/lifecycle

Chegada de mensagem
  └─ Graph POST /microsoft/webhook
       └─ validar clientState e subscriptionId
            ├─ publicar messageId aos clientes SSE (memória)
            └─ buscar e imprimir a mensagem nos logs

Frontend
  ├─ GET /microsoft/events (SSE) recebe messageId
  ├─ GET /microsoft/messages/:id busca o conteúdo no Graph
  └─ GET /microsoft/messages/:id/attachments/... lista/baixa anexos
```

O backend atual conecta uma conta **pessoal** usando permissões delegadas. Tokens, sessão, estado OAuth, ID de subscription e conexões SSE são mantidos em memória. Reiniciar o processo perde esse estado; várias instâncias não compartilham a mailbox conectada nem a lista de assinantes SSE. O guia de produção recomenda recriar a autenticação como client credentials para uma mailbox corporativa.

## 2. O que cada arquivo faz

### Configuração e ciclo de vida HTTP

| Arquivo                                                                                | Responsabilidade                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`src/config/microsoftGraph.ts`](src/config/microsoftGraph.ts)                         | Carrega `dotenv`, valida `GRAPH_PUBLIC_URL`, `GRAPH_CLIENT_STATE` e `GRAPH_CONNECT_SECRET`, exige `GRAPH_CLIENT_ID` e `GRAPH_CLIENT_SECRET`, e monta callback, notification URL e lifecycle URL. É configuração do fluxo atual; não configura client credentials corporativo.        |
| [`src/server.ts`](src/server.ts)                                                       | Inicializa metadata/decorators e o Express, fixa a porta em `3001`, valida config Graph no startup, informa que aguarda conta pessoal, opcionalmente prepara a URL OAuth se `MICROSOFT_CONNECT_UI=true`, e chama a reconciliação da subscription a cada 15 minutos quando conectado. |
| [`src/app.ts`](src/app.ts)                                                             | Configura CORS para uma origem exata `FRONTEND_ORIGIN`, trata preflight, instala parser JSON e registra as rotas. O webhook depende do parser JSON antes do router.                                                                                                                  |
| [`src/routes/index.ts`](src/routes/index.ts)                                           | Router raiz que monta as rotas Microsoft sob o prefixo `/microsoft`.                                                                                                                                                                                                                 |
| [`src/routes/microsoft/microsoft.routes.ts`](src/routes/microsoft/microsoft.routes.ts) | Liga endpoints HTTP aos controllers e middlewares: webhook, lifecycle, conexão OAuth, callback, SSE, mensagem e anexos.                                                                                                                                                              |

### Autenticação e conexão de conta

| Arquivo                                                                                                                                      | Responsabilidade                                                                                                                                                                                                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/infra/microsoft/PersonalGraphAuthRepository.ts`](src/infra/microsoft/PersonalGraphAuthRepository.ts)                                   | Implementa OAuth Authorization Code + PKCE usando autoridade `consumers`, escopos `offline_access`, `User.Read`, `Mail.Read`; valida `state`, troca código por tokens, consulta `/me`, renova access token e guarda tokens/session/subscription ID em campos estáticos na memória. Esse arquivo é o ponto de maior diferença para produção corporativa app-only. |
| [`src/application/useCases/Microsoft/ConnectPersonalAccountUseCase.ts`](src/application/useCases/Microsoft/ConnectPersonalAccountUseCase.ts) | Orquestra o início da autorização, finalização do callback, reconciliação forçada da subscription e criação de sessão. Delega OAuth ao repository e subscription ao use case correspondente.                                                                                                                                                                     |
| [`src/application/controllers/Microsoft/PersonalAccountController.ts`](src/application/controllers/Microsoft/PersonalAccountController.ts)   | Serve a página opcional de conexão; exige bearer secret no POST inicial; troca callback `state`/`code`; cria cookie HttpOnly/Secure de 12 horas e tenta reconciliar a subscription. Envia respostas de erro amigáveis e registra erros.                                                                                                                          |
| [`src/middlewares/personalOrJwtAuthMiddleware.ts`](src/middlewares/personalOrJwtAuthMiddleware.ts)                                           | Aceita a sessão pessoal em cookie (em memória) ou, para SSE, delega a verificação ao middleware JWT. Mensagem e anexos exigem apenas a sessão pessoal.                                                                                                                                                                                                           |
| [`src/middlewares/authMiddleware.ts`](src/middlewares/authMiddleware.ts)                                                                     | Valida access token delegado destinado à API (tenant, audiência e escopo configurados). Esse JWT é autenticação da API/SSE, não o token que o backend usa para chamar Microsoft Graph.                                                                                                                                                                           |

### Subscription e notificações do webhook

| Arquivo                                                                                                                                          | Responsabilidade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/application/useCases/Microsoft/ManageGraphSubscriptionUseCase.ts`](src/application/useCases/Microsoft/ManageGraphSubscriptionUseCase.ts)   | Orquestra criação/reconciliação/renovação. Exige conta conectada, lista subscriptions, procura o recurso Inbox `me/mailFolders('inbox')/messages` ou `users/{id}/...`, cria se ausente, rejeita URLs antigas diferentes e renova se for pedido ou faltar menos de 24 h. Usa `pending` para coalescer execuções concorrentes dentro do processo e `renewalRequested` para repetir reconciliação após falha/evento lifecycle. O prazo pedido é de seis dias. Não persiste subscription ID.                                                                                                                                                                                                                                                                                               |
| [`src/infra/microsoft/GraphSubscriptionRepository.ts`](src/infra/microsoft/GraphSubscriptionRepository.ts)                                       | Faz chamadas autenticadas ao Graph para listar com paginação, criar (`POST /subscriptions`) e renovar (`PATCH /subscriptions/{id}`). Inclui `changeType: created`, notification/lifecycle URLs e `clientState`; solicita expiração em seis dias. Converte as respostas na entity `GraphSubscription`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| [`src/application/controllers/Microsoft/GraphWebhookController.ts`](src/application/controllers/Microsoft/GraphWebhookController.ts)             | Fábrica de handler para notificação normal ou lifecycle. Se há `validationToken`, devolve `200 text/plain` com o token para concluir o handshake. Caso contrário exige JSON com `value`, chama o use case receptor e responde `202`. Se o use case sinaliza recuperação, inicia reconciliação em background.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| [`src/application/useCases/Microsoft/ReceiveGraphNotificationUseCase.ts`](src/application/useCases/Microsoft/ReceiveGraphNotificationUseCase.ts) | **Use case central do webhook.** Primeiro verifica se o corpo é uma coleção Graph `value`. Para cada item, compara o `clientState` em tempo constante (`timingSafeEqual`) com `GRAPH_CLIENT_STATE` e confere se `subscriptionId` é o ID mantido pelo auth repository. Itens não validados são ignorados. Para lifecycle, solicita reconciliação em `reauthorizationRequired` e `subscriptionRemoved`; para `missed`, só avisa que precisa sincronizar manualmente. Para notificação comum `created` com `resourceData.id`, publica o ID no repositório de eventos e agenda busca/log da mensagem. Retorna boolean indicando se o controller deve reconciliar. Não persiste evento, não deduplica, não confere tenant/recurso/mailbox e não executa recuperação automática de `missed`. |
| [`src/application/entites/GraphSubscription.ts`](src/application/entites/GraphSubscription.ts)                                                   | Modelo simples com ID, recurso, URLs, expiração e change type que o use case usa ao escolher/renovar subscriptions. O diretório tem o nome `entites` no código.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

**Detalhe do use case do webhook:** `ReceiveGraphNotificationUseCase.execute(body, lifecycle)` não envia uma resposta HTTP. Ele só valida e coordena efeitos de aplicação; `GraphWebhookController` cuida do protocolo HTTP e do handshake. A segurança implementada se baseia no segredo `clientState` e no ID da subscription guardado na memória. Como esse ID se perde no reinício, notificações de uma subscription que continue ativa podem ser descartadas até a reconexão/reconciliação. O valor `tenantId` é lido no tipo local mas não verificado.

### Busca de mensagem, anexos e SSE

| Arquivo                                                                                                                                    | Responsabilidade                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/infra/microsoft/GraphMessageRepository.ts`](src/infra/microsoft/GraphMessageRepository.ts)                                           | Consulta `/me/messages/{id}`, lista attachments e transmite conteúdo `$value`; usa token delegado da conta pessoal. Define timeout e traduz status HTTP em `GraphMessageError`. |
| [`src/application/useCases/Microsoft/GetGraphMessageUseCase.ts`](src/application/useCases/Microsoft/GetGraphMessageUseCase.ts)             | Encaminha a busca de mensagem ao repository pedindo corpo em texto via header `Prefer`.                                                                                         |
| [`src/application/useCases/Microsoft/LogGraphMessageUseCase.ts`](src/application/useCases/Microsoft/LogGraphMessageUseCase.ts)             | Busca mensagem e escreve o JSON completo no console. Útil para diagnóstico, mas não deve ser levado sem revisão para produção porque logs podem conter conteúdo pessoal.        |
| [`src/application/controllers/Microsoft/GraphMessageController.ts`](src/application/controllers/Microsoft/GraphMessageController.ts)       | Valida `messageId`, consulta o use case, retorna JSON, traduz 404 e esconde erros internos com 502. Resposta recebe `Cache-Control: no-store`.                                  |
| [`src/application/controllers/Microsoft/GraphAttachmentController.ts`](src/application/controllers/Microsoft/GraphAttachmentController.ts) | Valida IDs, lista anexos ou faz streaming de conteúdo para download; converte 404 e outros erros em respostas seguras.                                                          |
| [`src/application/useCases/Microsoft/EmailEventsUseCase.ts`](src/application/useCases/Microsoft/EmailEventsUseCase.ts)                     | Expõe métodos simples para registrar e remover uma resposta Express conectada à lista SSE.                                                                                      |
| [`src/infra/memory/EmailEventRepository.ts`](src/infra/memory/EmailEventRepository.ts)                                                     | Mantém respostas SSE em um `Set` na memória e publica `event: email.received` com JSON contendo `messageId`; remove conexões quebradas. Não tem fila, persistência nem replay.  |
| [`src/application/controllers/Microsoft/EmailEventsController.ts`](src/application/controllers/Microsoft/EmailEventsController.ts)         | Abre conexão SSE, define headers anti-buffering, envia comentário inicial, registra conexão, envia heartbeat a cada 25 s e remove cliente ao fechar/expirar autenticação.       |
| [`frontEnd/src/App.tsx`](../frontEnd/src/App.tsx)                                                                                          | Abre `EventSource` com cookies, interpreta evento SSE, lista IDs na sessão da página e busca o conteúdo da mensagem quando selecionada. O estado não é persistido.              |
| [`frontEnd/src/messageStream.ts`](../frontEnd/src/messageStream.ts)                                                                        | Valida o JSON SSE e o formato do message ID; evita inserir o mesmo ID duas vezes na lista em memória.                                                                           |
| [`frontEnd/src/Attachments.tsx`](../frontEnd/src/Attachments.tsx)                                                                          | Busca metadados de anexos, descarrega conteúdo sob demanda, oferece preview para alguns tipos MIME e revoga URLs locais de objeto.                                              |
| `frontEnd/src/main.tsx`                                                                                                                    | Ponto de entrada React: importa CSS global, monta `App` no elemento `#root` e ativa `StrictMode`.                                                                               |
| `frontEnd/src/index.css`, `frontEnd/src/App.css`                                                                                           | Estilos globais e da interface. Não participam da autenticação, subscription ou protocolo do webhook.                                                                           |
| `frontEnd/vite.config.ts`                                                                                                                  | Configura Vite e plugins de React/React Compiler; não contém lógica de integração Graph.                                                                                        |

### Infraestrutura transversal

| Arquivo                                                                              | Responsabilidade                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/kernel/di/Registry.ts`](src/kernel/di/Registry.ts)                             | Container de dependency injection: registra e resolve classes usadas pelos adapters/controllers/use cases.                                                       |
| [`src/kernel/decorators/Injectable.ts`](src/kernel/decorators/Injectable.ts)         | Marca uma classe para registro/resolução no container.                                                                                                           |
| [`src/adapter/expressRouteAdapter.ts`](src/adapter/expressRouteAdapter.ts)           | Adapta Controllers da arquitetura ao Express e resolve dependências pelo Registry. As rotas Graph atuais usam controllers estáticos diretamente em várias rotas. |
| [`src/application/contracts/Controller.ts`](src/application/contracts/Controller.ts) | Base para controllers que seguem o contrato interno da aplicação.                                                                                                |
| [`src/shared/types/express.d.ts`](src/shared/types/express.d.ts)                     | Acrescenta propriedades de usuário/expiração ao tipo Express Request para middlewares.                                                                           |
| [`src/application/entites/Account.ts`](src/application/entites/Account.ts)           | Entity de conta genérica; não dirige a integração Graph atual.                                                                                                   |
| `src/application/errors/**`                                                          | Erros genéricos de domínio e HTTP. Os endpoints Microsoft tratam várias falhas localmente; nem todas essas classes participam do fluxo Graph.                    |
| `src/kernel/decorators/Schema.ts`                                                    | Decorator de validação de schema para o padrão de controllers; não é usado no handshake atual do webhook.                                                        |

## 3. Configurações e dependências do código atual

Consulte [PRODUCAO_GRAPH.md, seção de variáveis](PRODUCAO_GRAPH.md#8-variáveis-de-ambiente-do-projeto-atual) para o inventário completo. As mais ligadas ao fluxo descrito são:

- `GRAPH_CLIENT_ID` e `GRAPH_CLIENT_SECRET`: app usado na troca OAuth atual.
- `GRAPH_PUBLIC_URL`: base HTTPS usada para callback e webhook.
- `GRAPH_CLIENT_STATE`: segredo enviado no `POST /subscriptions` e comparado no webhook.
- `GRAPH_CONNECT_SECRET`: protege o endpoint que inicia conexão pessoal.
- `MICROSOFT_CONNECT_UI=true`: habilita a página HTML de conexão.
- `FRONTEND_ORIGIN`: CORS e comportamento do cookie quando frontend está em outra origem.
- `GRAPH_TENANT_ID`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_REQUIRED_SCOPE`: middleware JWT da API, separado do token Graph.

Para testar integração ponta a ponta hoje, o ambiente precisa de endpoint HTTPS público, redirect URI igual a `${GRAPH_PUBLIC_URL}/microsoft/oauth/callback`, permissões delegadas `User.Read` e `Mail.Read`, login de conta pessoal permitido no registro e porta/rotas expostas pelo host. O endpoint webhook precisa estar alcançável externamente para o handshake do Graph. Para produção corporativa, siga os passos de registro, permissão de aplicação, mailbox e RBAC do documento [PRODUCAO_GRAPH.md](PRODUCAO_GRAPH.md); o código atual ainda não implementa esse modo.

## 4. Roteiro para recriar a integração

### Fase 1 — Definir a identidade e autenticar o backend

1. Defina se será uma mailbox dedicada ou shared mailbox e confirme o UPN/ID da mailbox, tenant e Exchange Online provisionado.
2. No Entra, crie app single-tenant com permissão de aplicação `Mail.Read`; admin consente.
3. Restrinja o alcance à mailbox pretendida com Exchange Online RBAC for Applications e prove que uma mailbox fora do escopo é negada.
4. Configure certificado ou managed identity; implemente obtenção de token app-only e cache/renovação. Não use o login `consumers`, cookies ou fluxo OAuth de usuário para o worker corporativo.
5. Implemente um pequeno acesso de leitura via `GET /users/{mailbox}/mailFolders/inbox/messages` para confirmar identidade, permissão e mailbox antes de adicionar notificações.

### Fase 2 — Construir o webhook antes de criar subscription

6. Defina a URL HTTPS estável e implemente a rota webhook sem autenticação interativa de usuário.
7. Implemente handshake `validationToken`: responder `200 text/plain` com o valor decodificado, rapidamente. Faça o mesmo para a URL de lifecycle configurada.
8. Implemente validação do payload: `clientState`, subscription ID persistido, tenant, recurso/mailbox e change type esperado. Gere e armazene `clientState` aleatório em secret store.
9. Faça o handler gravar eventos válidos numa fila/banco com idempotência e responder `202` rapidamente. Separe a leitura da mensagem para worker assíncrono.

> A ordem prática exige deixar o webhook mínimo funcional antes do POST de subscription: o Graph chama a URL para validá-la durante a criação. A subscription é criada depois que a rota está publicada e consegue responder ao handshake.

### Fase 3 — Criar, persistir e renovar subscription

10. Implemente o gerenciador que monta `resource: users/{mailbox}/mailFolders('inbox')/messages`, `changeType`, notification URL, lifecycle URL, `clientState` e expiração.
11. Crie a subscription via Graph e confirme que a URL de notificação e lifecycle passaram pelo handshake.
12. Persista `subscriptionId`, recurso, tenant, URLs e expiração. Não dependa de variável estática/memória para reconhecer eventos.
13. Implemente job periódico que renova antes da expiração; trate subscription removida, falha de reautorização, expiração e recriação sem duplicar assinaturas.

### Fase 4 — Receber e processar mensagens

14. Worker consome notificação, consulta a mensagem por `users/{mailbox}/messages/{id}`, trata 404/movimentação, retries, throttling e duplicidade.
15. Armazene apenas os dados necessários; proteja corpo e anexos e não imprima mensagens em logs. Crie mecanismo de reconciliação/delta para cobrir `missed`, indisponibilidade e reinício.
16. Se a interface precisar de atualização instantânea, publique uma referência/evento em broker ou serviço compartilhado e implemente SSE/WebSocket autenticado. Não use conexão Express em memória como fila de produção.

### Fase 5 — Segurança operacional e validação

17. Autorize cada usuário da API contra as mailboxes que ele pode acessar; um JWT válido sozinho não deve dar acesso a qualquer mailbox.
18. Configure métricas e alertas para token, fila, webhook, Graph throttling, falhas de renovação e expiração de subscription.
19. Teste criação e handshake, notificação `created`, mensagem não encontrada, payload inválido, `clientState` errado, notificação repetida, lifecycle, perda temporária da API, rotação de credencial e acesso negado fora da scope.
20. Faça deploy gradual; verifique logs sem dados sensíveis, fila recuperável e procedimento de revogação/rotação documentado.

## 5. Critério de conclusão por fase

| Fase          | Pronto quando                                                                             |
| ------------- | ----------------------------------------------------------------------------------------- |
| Autenticação  | O serviço obtém token app-only e lê a mailbox alvo; acesso fora do escopo é negado.       |
| Webhook       | HTTPS público responde ao validation token e persiste payload válido antes de responder.  |
| Subscription  | Graph retorna ID/expiração, envia evento e o job renova sem duplicar.                     |
| Processamento | Worker recupera conteúdo da mensagem de forma idempotente e sem dados sensíveis nos logs. |
| Operação      | Reinícios, `missed`, retries e alertas não causam perda silenciosa de eventos.            |
