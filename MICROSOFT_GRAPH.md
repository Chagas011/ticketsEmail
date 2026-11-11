# Microsoft Graph: acesso como aplicativo

A API monitora uma caixa do Exchange Online usando o fluxo OAuth **client credentials**. O backend obtém um token de aplicativo, cria a subscription automaticamente e o renova quando necessário. Não é preciso login do usuário. A rota SSE envia apenas o `messageId` ao frontend.

## Configuração

1. No Microsoft Entra, registre um aplicativo no tenant da organização e crie um segredo em **Certificados e segredos**. Use o **valor** do segredo.
2. Preencha `GRAPH_CLIENT_ID`, `GRAPH_TENANT_ID`, `GRAPH_CLIENT_SECRET`, `GRAPH_MAILBOX_USER_ID`, `GRAPH_PUBLIC_URL` e `GRAPH_CLIENT_STATE` conforme [.env.example](.env.example). `GRAPH_MAILBOX_USER_ID` é o **ID de objeto** (GUID) da caixa de correio no tenant, inclusive para uma caixa compartilhada. Configure também `GRAPH_MAILBOX_ADDRESS` para identificar a caixa na consulta de conversas.
3. Atribua à aplicação permissão para ler a mailbox. Uma opção é **Application Mail.Read** no RBAC para aplicativos do Exchange com escopo na caixa; alternativamente, use a permissão de aplicativo `Mail.Read` do Microsoft Graph com consentimento de administrador. Para usar o endpoint de resposta, é necessário também `Application Mail.Send` no RBAC ou `Mail.Send` de aplicativo no Graph.
4. As permissões do Entra e do RBAC do Exchange são somadas. Portanto, conceder `Mail.Read` de aplicativo no Entra para toda a organização pode ampliar o acesso além do escopo configurado no Exchange. Confira as atribuições efetivas antes de entrar em produção. Consulte [RBAC para aplicativos do Exchange](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac).
5. `GRAPH_PUBLIC_URL` deve ser HTTPS e apontar para o backend publicamente, para que a Microsoft valide e envie notificações ao webhook. Configure `FRONTEND_ORIGIN` com a origem exata do frontend se ele estiver em outra origem.
6. Reconstrua a imagem Docker e recrie o contêiner com o arquivo de ambiente. A subscription é criada ou reconciliada na inicialização e verificada a cada 15 minutos. Confira os logs para confirmar a criação ou renovação. Se houver falha, a API tentará novamente.

Não são mais necessários `GRAPH_CONNECT_SECRET`, `AUTH_JWT_AUDIENCE`, `AUTH_JWT_REQUIRED_SCOPE`, login, cookie ou redirect URI para esse fluxo.

## Funcionamento

- `POST /microsoft/webhook`: recebe a notificação da Microsoft e confere o `clientState` e a subscription.
- `GET /microsoft/events`: conexão SSE sem autenticação; envia `event: email.received` com `{"messageId":"..."}`.
- `GET /microsoft/messages/:messageId`: retorna o conteúdo do e-mail ao frontend.
- As rotas de conversas, anexos e resposta também usam a mailbox configurada.

**As rotas da API não autenticam clientes.** Quem puder acessá-las poderá receber IDs, ler mensagens e anexos e, quando a permissão de envio estiver concedida, responder e-mails. As permissões e o escopo no Exchange controlam o acesso da aplicação à Microsoft, mas não identificam quem chama esta API. CORS também não impede chamadas feitas fora do navegador.

A subscription acompanha apenas a Inbox. Mensagens no lixo eletrônico não geram evento até serem movidas para a Inbox. Os clientes SSE e o token ficam em memória; não há histórico para clientes desconectados. A API imprime o JSON do e-mail recebido nos logs; trate-os como dados privados. Após reiniciar, a API obtém um novo token e reconcilia a subscription automaticamente, sem login.

Se `GRAPH_CLIENT_STATE` for alterado, remova a subscription anterior no Graph e deixe a API criar outra: o Graph não retorna o valor anterior ao listar subscriptions. O mesmo procedimento pode ser necessário ao mudar a URL pública.
