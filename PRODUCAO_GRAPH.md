# Guia de produção: Microsoft Graph, mailbox corporativa e webhooks

Este guia parte da leitura do código atual em `api/src` e `frontEnd/src`. Ele descreve o que já existe, as diferenças para produção corporativa e uma sequência para recriar a integração.

## 1. Como o projeto funciona hoje

O backend Express expõe as rotas Microsoft em `src/routes/microsoft/microsoft.routes.ts`:

| Rota | Uso atual |
| --- | --- |
| `GET /microsoft/connect` | Página opcional que inicia o login delegado (só existe com `MICROSOFT_CONNECT_UI=true`). |
| `POST /microsoft/connect` | Confere `GRAPH_CONNECT_SECRET` e devolve a URL de autorização. |
| `GET /microsoft/oauth/callback` | Recebe o código OAuth, troca por tokens e cria sessão no navegador. |
| `POST /microsoft/webhook` | Valida a URL no handshake do Graph e recebe notificações de mensagens. |
| `POST /microsoft/lifecycle` | Recebe eventos de ciclo de vida da subscription. |
| `GET /microsoft/events` | SSE; envia `messageId` para os navegadores conectados. |
| `GET /microsoft/messages/:messageId` | Consulta mensagem no Graph. |
| `GET /microsoft/messages/:messageId/attachments...` | Lista e baixa anexos. |

O fluxo atual usa OAuth Authorization Code com PKCE e permissões **delegadas** `User.Read` e `Mail.Read`. A autoridade OAuth está fixa em `consumers`, portanto este código foi montado para conta pessoal. O access token, refresh token, sessão, ID da subscription e clientes SSE ficam em memória. A aplicação monitora uma única Inbox por processo. A subscription é reconciliada no callback e depois a cada 15 minutos; o webhook compara `clientState` e ID da subscription. Eventos SSE não são persistidos e o código também escreve o JSON integral da mensagem nos logs.

`GRAPH_MAILBOX_USER_ID` não é usado pelo backend atual. O `.env.example` anterior continha valores que pareciam credenciais reais. Eles foram removidos do exemplo; se esses valores foram usados ou publicados em algum commit, revogue/rotacione o segredo do aplicativo e os valores de estado/segredo de conexão, e verifique o histórico do repositório e os logs. O arquivo `.env` não foi alterado.

## 2. Arquitetura recomendada para mailbox corporativa

Para um serviço de backend que monitora uma mailbox corporativa sem depender do login de uma pessoa, use OAuth **client credentials** (permissão de aplicativo). O processo obtém token como a identidade do aplicativo e chama recursos no formato `users/{id-ou-UPN}/...`. Não é necessário manter refresh token nem sessão de navegador.

Uma mailbox corporativa é uma mailbox do Exchange Online associada ao usuário/caixa compartilhada no tenant. O registro do aplicativo não “anexa” a mailbox diretamente. A ligação é feita concedendo ao aplicativo acesso de leitura e configurando no serviço o endereço ou ID da mailbox-alvo. A conta/caixa precisa existir e ter mailbox Exchange Online provisionada.

```text
Serviço backend ── client credentials ──> Microsoft Entra ID
       │                                      │ token de aplicativo
       ├── POST /subscriptions ───────────────┴──> Microsoft Graph
       │       resource: users/{mailbox}/mailFolders('inbox')/messages
       │
       └<── POST /microsoft/webhook e /microsoft/lifecycle ── Microsoft Graph
              validar clientState, persistir/encaminhar evento e responder rápido
```

Prefira certificado ou identidade gerenciada (se o backend estiver em Azure) ao client secret. Se usar segredo, guarde-o no Key Vault/secret store do host, defina expiração e rotação. Nunca coloque credenciais em `VITE_*`, frontend, imagem Docker ou controle de versão.

### Permissão mínima e limite à mailbox

O Graph normalmente usa `Mail.Read` de **Aplicativo** para ler mensagens e criar a subscription. Essa permissão pode abrir acesso amplo a mailboxes do tenant. Para produção, limite o app à mailbox necessária com **Exchange Online RBAC for Applications**, concedendo o papel `Application Mail.Read` dentro de um escopo que contenha somente a mailbox de serviço. Remova a permissão organizacional ampla equivalente do Entra se estiver usando o RBAC como limite: as concessões podem ser aditivas. Valide o acesso ao alvo e a uma mailbox fora do escopo com `Test-ServicePrincipalAuthorization` antes de ativar o processamento. A configuração do escopo e dos papéis é feita no Exchange Online PowerShell e pode exigir um administrador Exchange.

Se optar por conceder `Mail.Read` como permissão de aplicativo no Entra e não configurar escopo no Exchange, trate o acesso como potencialmente abrangente a todas as mailboxes e valide a política organizacional. Não confunda permissões delegadas com de aplicativo: o consentimento delegado depende de um usuário conectado; client credentials exige permissão de aplicativo e consentimento administrativo.

## 3. Criar o registro no Azure / Microsoft Entra

Os nomes dos menus podem variar um pouco conforme o portal. Use o tenant Microsoft 365 da organização que contém a mailbox.

1. Entre no [portal Microsoft Entra](https://entra.microsoft.com/) com uma conta administrativa autorizada e selecione o tenant correto.
2. Acesse **Identity / Identidade → Applications / Aplicativos → App registrations / Registros de aplicativo → New registration / Novo registro**.
3. Dê um nome como `Tickets Email Graph Production`.
4. Em tipos de conta, selecione **Accounts in this organizational directory only (Single tenant)**. Para client credentials de serviço corporativo não habilite contas pessoais.
5. Não cadastre redirect URI para o fluxo client credentials. Clique **Register**.
6. Na página **Overview**, guarde em um gerenciador seguro:
   - **Application (client) ID**: identifica o aplicativo (`GRAPH_CLIENT_ID` no backend futuro).
   - **Directory (tenant) ID**: identifica o tenant (`GRAPH_TENANT_ID`).
   - **Object ID** do aplicativo e o **Object ID** da Enterprise application/service principal: são IDs diferentes. Para RBAC do Exchange, use o object ID do service principal indicado pela documentação do Exchange, não presuma que é o object ID mostrado no App registrations.
7. Em **API permissions → Add a permission → Microsoft Graph → Application permissions**, procure e selecione `Mail.Read`. Conceda somente as permissões realmente necessárias. Não adicione `Mail.Send` para leitura de e-mails.
8. Clique **Grant admin consent for [organização]** e confirme com o administrador. Aguarde a propagação e confira o status concedido.
9. Para reduzir o alcance, configure o RBAC for Applications do Exchange Online para `Application Mail.Read` e uma scope da mailbox desejada, seguindo o procedimento oficial. Não considere a mailbox restrita até os testes positivo e negativo confirmarem o escopo.
10. Em **Certificates & secrets**, registre um certificado público e mantenha a chave privada apenas no cofre acessível ao serviço. Alternativamente, crie um client secret, copie o **Value** imediatamente (o secret ID não é o valor), registre vencimento e carregue-o no secret store. Não salve o valor em Git.
11. Na área **Enterprise applications**, confirme que a aplicação/service principal existe no tenant e que o consentimento de administrador foi aplicado.

**Vincular a mailbox:** confirme com o administrador Exchange o endereço SMTP/UPN exato da mailbox (por exemplo `tickets@empresa.com`) e sua existência/licença/provisionamento no Exchange Online. Configure esse valor no futuro como `GRAPH_MAILBOX_USER_ID` (UPN ou ID do usuário, conforme o cliente Graph implementado). O aplicativo não deve fazer login interativo nessa conta. Em seguida, associe o service principal ao escopo RBAC da mailbox e teste o token chamando `GET /users/{UPN}/mailFolders/inbox/messages`.

## 4. Preparar endpoint e callback webhook

1. Publique o backend numa URL estável, HTTPS e acessível pela internet, como `https://api.empresa.com`. Configure DNS, certificado TLS, proxy/load balancer e rota até o processo.
2. O webhook precisa aceitar `POST` JSON e query string `validationToken`. Para validação, responda em até 10 segundos com `200`, `Content-Type: text/plain` e o token decodificado em texto puro, sem JSON. O projeto atual faz isso em `/microsoft/webhook` e `/microsoft/lifecycle`.
3. Não exija login de usuário nos endpoints de webhook. Proteja a legitimidade da notificação validando `clientState`, `subscriptionId`, mudança esperada e mailbox/recurso; considere também validar JWT de notificação quando o mecanismo de validação de tokens estiver habilitado. `clientState` é segredo de comparação, não substitui autorização do endpoint.
4. Responda rapidamente: valide o payload, persista em fila durável e responda `202` em poucos segundos; processe o Graph, anexos, logs e notificações aos clientes fora do request. O código atual publica evento em memória e busca/loga mensagem imediatamente; esse desenho não oferece durabilidade nem recuperação.
5. Configure um `clientState` aleatório independente, mantido estável enquanto as subscriptions que o usam existirem. Use HTTPS e não registre o segredo ou tokens nos logs.
6. O `notificationUrl` é `https://api.empresa.com/microsoft/webhook`; o `lifecycleNotificationUrl` é `https://api.empresa.com/microsoft/lifecycle`. Ambos precisam fazer o handshake de validação quando uma subscription é criada.

## 5. Criar e manter a subscription

Com um token de aplicativo válido para Graph, crie uma subscription usando a mailbox específica. Exemplo conceitual (ajuste o expiration para o instante UTC e o limite aceito pelo Graph):

```http
POST https://graph.microsoft.com/v1.0/subscriptions
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "changeType": "created",
  "notificationUrl": "https://api.empresa.com/microsoft/webhook",
  "lifecycleNotificationUrl": "https://api.empresa.com/microsoft/lifecycle",
  "resource": "users/tickets@empresa.com/mailFolders('inbox')/messages",
  "expirationDateTime": "2026-11-10T12:00:00Z",
  "clientState": "SEGREDO_ALEATORIO_CONFIGURADO_NO_BACKEND"
}
```

O Graph valida a URL e entrega `validationToken` antes de concluir. Guarde `subscriptionId`, recurso, URLs, tenant e `expirationDateTime` em armazenamento durável. Renove antes da expiração com `PATCH /subscriptions/{id}` e recrie se a subscription for removida/expirar. Mensagens do Outlook aceitam prazo máximo atual de menos de sete dias (10.080 minutos); escolha uma janela menor e execute um job de renovação periódico com margem. Responda eventos de lifecycle: `reauthorizationRequired`, `subscriptionRemoved` e `missed`. `missed` requer sincronização de recuperação na mailbox; a notificação contém sinalização, não a lista completa do que foi perdido.

Uma subscription pode continuar no Graph quando o serviço reinicia. Portanto, persistência e reconciliação no startup são necessárias. Não crie duplicatas às cegas: liste subscriptions, encontre a correspondente por recurso/URL, renove-a e apague subscriptions antigas com segurança. Se a URL webhook ou o `clientState` mudar, planeje a migração e a remoção/recriação explícita.

## 6. Processar notificações com segurança

1. Receba coleções `value`; cada notificação pode trazer `subscriptionId`, `clientState`, `resource`, `changeType` e `resourceData.id`.
2. Compare `clientState` em tempo constante, valide a subscription armazenada, o recurso esperado e `changeType` permitido. Rejeite itens que não pertençam à mailbox configurada.
3. Grave o evento em fila ou banco com chave de idempotência (subscription + message ID + tipo) para lidar com entrega repetida.
4. Responda `202 Accepted` depois da gravação durável; processe em worker.
5. Consulte a mensagem com Graph usando o mesmo token de aplicativo, por exemplo `GET /users/{mailbox}/messages/{messageId}`. Não confie em campos de notificação para dados não fornecidos.
6. Armazene somente os dados de negócio necessários, proteja corpos e anexos como dados sensíveis, aplique retenção e evite conteúdo de e-mail em logs.
7. Implemente sincronização delta/inicial e recuperação para `missed`, falhas prolongadas, reinícios e eventos não entregues. SSE pode avisar a interface, mas não deve ser o armazenamento do evento.

## 7. Atualizações necessárias ao recriar o backend

- Trocar `PersonalGraphAuthRepository` por cliente OAuth client credentials com certificado/identidade gerenciada; remover login pessoal, callback, cookie e `GRAPH_CONNECT_SECRET` da operação de produção.
- Injetar mailbox alvo e usar `/users/{mailbox}/...` nas rotas Graph, não `/me/...`.
- Persistir tokens em cache seguro (ou usar biblioteca de identidade), subscriptions e fila de notificações; coordenar renovação em instâncias múltiplas.
- Fazer workers idempotentes para ler mensagens, anexos e recuperar lacunas; não imprimir mensagem completa no log.
- Validar notificações e tratar lifecycle; limitar tempo de resposta do webhook.
- Proteger SSE e endpoints de mensagem com autenticação e autorização por mailbox. Hoje o SSE autenticado por JWT recebe eventos da mailbox única do processo; isso não representa autorização multiusuário.
- Tornar configurável a porta e confiar em headers de proxy somente quando o proxy estiver controlado. Hoje `server.ts` fixa a porta `3001`.
- Definir health checks, métricas, alertas para falhas/expiração de subscription, auditoria, retenção de logs, backup da fila e processo de rotação de credenciais.

## 8. Variáveis de ambiente do projeto atual

As variáveis abaixo descrevem o código existente. A autenticação corporativa por aplicativo ainda não está implementada; não basta preencher os campos atuais com um email corporativo.

| Variável | Significado e uso atual |
| --- | --- |
| `GRAPH_CLIENT_ID` | Application (client) ID do registro Entra usado no login Graph atual. |
| `GRAPH_TENANT_ID` | Tenant ID usado pelo middleware opcional que valida JWT para a API. O fluxo de login Graph atual usa autoridade `consumers`, então esta variável não o converte em login corporativo. |
| `GRAPH_CLIENT_SECRET` | Segredo usado pelo backend na troca do código e renovação do fluxo atual. No fluxo corporativo futuro, prefira certificado/identidade gerenciada; se mantido, guarde fora do `.env` versionado. |
| `GRAPH_MAILBOX_USER_ID` | Não é lida pelo código atual. Recomendada como nova configuração de mailbox alvo na implementação app-only; pode ser UPN SMTP ou ID estável, conforme decisão de implementação. |
| `GRAPH_PUBLIC_URL` | URL pública HTTPS da API, sem query/fragmento. Serve para compor callback OAuth e URLs webhook/lifecycle. |
| `GRAPH_CLIENT_STATE` | Valor secreto (32–128 caracteres no validador atual) enviado na subscription e comparado nos webhooks. Mantenha estável enquanto subscription existir. |
| `GRAPH_CONNECT_SECRET` | Protege o início manual do login pessoal em `POST /microsoft/connect`; ao recriar para app-only, tende a ser desnecessária. Mínimo atual: 32 caracteres. |
| `AUTH_JWT_AUDIENCE` | Audiência esperada pelo middleware JWT da API; normalmente o Application ID da API exposta, não necessariamente o ID do cliente Graph. |
| `AUTH_JWT_REQUIRED_SCOPE` | Escopo delegado exigido pelo middleware JWT, por padrão de exemplo `access_as_user`. É independente do token de aplicativo Graph. |
| `FRONTEND_ORIGIN` | Origem exata HTTP(S) permitida pelo CORS, sem barra no fim. Também muda o cookie para `SameSite=None`; exige HTTPS para o uso seguro do cookie. |
| `MICROSOFT_CONNECT_UI` | Se exatamente `true`, habilita a página de conexão pessoal e imprime sua URL nos logs. Não habilita autenticação corporativa app-only. |
| `VITE_API_BASE_URL` | Variável do frontend Vite para a URL base da API. É pública no bundle; nunca coloque segredo nela. Vazia quando frontend/API compartilham origem. |

Configurações que provavelmente serão novas no serviço de produção: `GRAPH_MAILBOX_USER_ID`, método/identificador de certificado ou managed identity, `PORT`, configuração de armazenamento/filas e parâmetros de monitoramento. Defina nomes e validação no novo código; não presuma que o backend atual já os consome.

## 9. Checklist de implantação

- [ ] Tenant corporativo correto, mailbox existente e endereço/ID confirmado.
- [ ] App single-tenant criado; `Mail.Read` de aplicativo consentida por administrador.
- [ ] Credencial de produção em Key Vault/managed identity/certificado, sem segredo em Git.
- [ ] Acesso limitado à mailbox pelo RBAC for Applications e testes fora do escopo negados.
- [ ] API HTTPS pública e ambos os endpoints webhook respondem ao handshake do Graph.
- [ ] Subscription criada para a mailbox correta, persistida e renovada antes da expiração.
- [ ] Webhook valida estado/assinatura/subscription, persiste em fila e retorna rápido.
- [ ] Lifecycle, duplicidade, falhas, notificações perdidas e sincronização de recuperação tratados.
- [ ] Mensagens/anexos protegidos; logs sem conteúdo sensível; SSE/rotas autorizadas por usuário.
- [ ] Alertas e runbook para token, consentimento, mailbox, webhook e renovação.

## Referências oficiais

- [Registrar aplicativo no Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Microsoft Graph: acesso sem usuário / client credentials](https://learn.microsoft.com/en-us/graph/auth-v2-service)
- [Microsoft Graph: permissões](https://learn.microsoft.com/en-us/graph/permissions-overview)
- [Exchange Online: RBAC for Applications](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access)
- [Microsoft Graph: webhooks, validação, entrega e ciclo de vida](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Microsoft Graph: subscription e prazos máximos](https://learn.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0)
- [Microsoft Graph: criação de subscription](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions?view=graph-rest-1.0)
- [Microsoft Entra: credenciais de certificado](https://learn.microsoft.com/en-us/entra/msidweb/authentication/certificates)
