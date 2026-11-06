# Autenticação e autorização para Microsoft Graph

Guia independente para iniciar um **novo sistema** que acessa uma mailbox corporativa em um tenant Microsoft Entra ID **single tenant**.

## 1. Escolha como o sistema vai acessar o email

Para um serviço de backend que precisa monitorar uma mailbox continuamente, use **app-only**: o backend autentica o próprio aplicativo, sem login interativo de uma pessoa. O token dá acesso à mailbox indicada pelo sistema.

Se cada pessoa precisar entrar com sua conta e o sistema só puder acessar os emails permitidos para essa pessoa, use **delegated access**. Esse fluxo exige login interativo e usa permissões delegadas.

Este guia usa **app-only como caminho principal**. A seção 9 resume o fluxo delegado. No Graph, permissões de aplicação representam o aplicativo sem usuário conectado; permissões delegadas representam o aplicativo agindo em nome de uma pessoa. [Visão geral das permissões Graph](https://learn.microsoft.com/en-us/graph/permissions-overview)

### Conceitos

- **Autenticação**: prova a identidade do aplicativo perante o Microsoft Entra ID.
- **Autorização**: determina quais operações o aplicativo pode executar na mailbox.
- **Access token**: credencial temporária enviada em `Authorization: Bearer ...` para o Microsoft Graph. Mantenha-o no backend.
- **Single tenant**: o aplicativo pertence a um tenant e o fluxo de login delegado aceita identidades desse diretório. No modelo app-only, o service principal e as permissões ficam nesse tenant; o backend solicita o token pelo endpoint específico dele.
- **Mailbox alvo**: endereço SMTP/UPN ou ID do usuário corporativo que o backend acessa. Ter uma mailbox dedicada, como `suporte@empresa.com`, ajuda a restringir o acesso.

## 2. Registrar o aplicativo no Microsoft Entra

1. Entre no [Microsoft Entra admin center](https://entra.microsoft.com/) e selecione o diretório corporativo correto.
2. Abra **Identity → Applications → App registrations → New registration**.
3. Informe um nome, por exemplo `Email Worker Produção`.
4. Em **Supported account types**, selecione **Accounts in this organizational directory only** (single tenant).
5. Se o serviço for exclusivamente backend/app-only, não precisa de redirect URI para login de usuário.
6. Após criar, guarde:
   - **Application (client) ID**;
   - **Directory (tenant) ID**.
7. Em **Certificates & secrets**, configure uma credencial do aplicativo:
   - Para o primeiro protótipo, crie um **Client secret** e copie o campo **Value** imediatamente; ele não poderá ser consultado depois.
   - Para produção, prefira certificado ou identidade federada/gerenciada, quando disponível. Não coloque credenciais em código, imagem Docker ou repositório. [Credenciais de aplicativos Entra](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-credentials)

## 3. Escolher como conceder permissões à mailbox

Escolha **um** dos modelos abaixo para cada permissão de email. Não conceda a mesma permissão sem escopo no Entra e com escopo no Exchange RBAC: as autorizações são somadas, e a permissão ampla do Entra pode permitir acesso fora da mailbox restrita.

### Opção A — permissão ampla pelo Entra

No registro, abra **API permissions → Add a permission → Microsoft Graph → Application permissions**. Para ler mensagens, adicione `Mail.Read`; para responder, adicione `Mail.Send`. Conceda admin consent. Essas permissões podem permitir acesso às mailboxes do tenant; use este modelo somente se essa abrangência for apropriada ou se houver outra política eficaz que limite o acesso.

### Opção B — mailbox restrita pelo Exchange Application RBAC

Para dar acesso somente a uma mailbox ou escopo definido, atribua no Exchange Online RBAC as funções `Application Mail.Read` e, se necessário para responder, `Application Mail.Send`, cada uma com o escopo pretendido. Não mantenha no Entra uma concessão ampla duplicada das mesmas permissões; remova-a depois de preparar e validar as atribuições RBAC. Consulte [azure.md](./azure.md) para os passos e comandos. [Application RBAC para Exchange Online](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)

`Mail.ReadWrite` não é necessário apenas para ler e responder. Adicione outras permissões somente quando uma operação concreta exigir.

## 4. Configurar o ambiente

Crie um `.env` local fora do controle de versão, ou use um cofre de segredos no ambiente hospedado:

```dotenv
ENTRA_TENANT_ID=<directory-tenant-id>
ENTRA_CLIENT_ID=<application-client-id>
ENTRA_CLIENT_SECRET=<client-secret-value>
GRAPH_MAILBOX=<email-ou-UPN-da-mailbox>
```


Significado:

- `ENTRA_TENANT_ID`: restringe a emissão do token ao tenant corporativo.
- `ENTRA_CLIENT_ID`: identifica o registro do aplicativo.
- `ENTRA_CLIENT_SECRET`: prova a identidade do app no exemplo mínimo. Em produção, prefira certificado/identidade gerenciada.
- `GRAPH_MAILBOX`: mailbox que o serviço acessará. Use seu UPN ou ID estável do Entra.

Gere valores aleatórios para segredos; não reutilize senha de usuário. Adicione `.env` ao `.gitignore`. Nunca envie client secret, token ou refresh token ao navegador.

## 5. Obter token app-only com client credentials

O fluxo client credentials solicita um token diretamente ao endpoint `/token`. Use `scope=https://graph.microsoft.com/.default` para pedir as permissões de aplicação previamente consentidas para o registro. [Acesso app-only ao Graph](https://learn.microsoft.com/en-us/graph/auth-v2-service)

Exemplo mínimo em Node.js/TypeScript com `fetch`:

```ts
const tenantId = process.env.ENTRA_TENANT_ID!;
const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

async function getGraphToken(): Promise<string> {
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.ENTRA_CLIENT_ID!,
      client_secret: process.env.ENTRA_CLIENT_SECRET!,
      grant_type: "client_credentials",
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  const data = await response.json();
  if (!response.ok)
    throw new Error(
      `Entra token error: ${response.status} ${JSON.stringify(data)}`,
    );
  return data.access_token as string;
}
```

No fluxo app-only não há refresh token: quando o access token expira, solicite outro token com client credentials. Em produção, use MSAL ou uma biblioteca de identidade suportada e uma credencial segura.

## 6. Fazer a primeira chamada ao Graph

App-only não representa uma pessoa, então use `/users/{mailbox}`, não `/me`:

```ts
const token = await getGraphToken();
const mailbox = encodeURIComponent(process.env.GRAPH_MAILBOX!);
const response = await fetch(
  `https://graph.microsoft.com/v1.0/users/${mailbox}/mailFolders/inbox/messages?$top=10&$select=id,subject,from,receivedDateTime,bodyPreview`,
  { headers: { Authorization: `Bearer ${token}` } },
);

if (!response.ok)
  throw new Error(`Graph error: ${response.status} ${await response.text()}`);
const result = await response.json();
console.log(result.value);
```

A permissão `Mail.Read` autoriza leitura. Para responder a uma mensagem já recebida, use o ID da mensagem e a mailbox alvo:

```ts
const response = await fetch(
  `https://graph.microsoft.com/v1.0/users/${mailbox}/messages/${encodeURIComponent(messageId)}/reply`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ comment: "Olá, recebemos sua solicitação." }),
  },
);

if (!response.ok)
  throw new Error(
    `Graph reply error: ${response.status} ${await response.text()}`,
  );
```

A chamada de resposta exige `Mail.Send`. O Graph pode retornar `202 Accepted`; isso significa que aceitou a solicitação, não que o email já foi entregue.

## 7. Autenticar usuários que chamam seu próprio backend

O token app-only da seção 5 é para o Graph, não para seus usuários nem para proteger sua API. Se o sistema tiver frontend/login de usuários:

1. Registre/configure o frontend como cliente público com Authorization Code + PKCE usando MSAL.
2. Registre a API e use **Expose an API** para publicar um escopo, por exemplo `access_as_user`.
3. Autorize o frontend a solicitar `api://<API_CLIENT_ID>/access_as_user`.
4. O frontend envia esse access token em `Authorization: Bearer ...` para sua API.
5. A API valida assinatura, emissor do tenant, audiência da API, expiração e escopo/role antes de atender a chamada.
6. A API usa sua credencial app-only separada para chamar o Graph na mailbox de serviço.

Não use o token app-only do Graph como token de sessão do navegador. Mantenha a credencial e a chamada ao Graph no backend.

## 8. Alternativa: login corporativo delegado

Se uma pessoa deve entrar e o Graph deve operar na mailbox dessa pessoa, configure **Delegated permissions** em vez de app-only. O fluxo é OAuth Authorization Code (com PKCE); a pessoa autentica no tenant e consente `User.Read`, `Mail.Read` e `Mail.Send`. Solicite `offline_access` no parâmetro `scope` se o backend precisar de refresh token. Para esse fluxo, chamadas de email usam `/me/...`. [Acesso delegado ao Graph](https://learn.microsoft.com/en-us/graph/auth-v2-user)

A URL de autorização e a troca do código usam a autoridade do tenant:

```text
https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/authorize
https://login.microsoftonline.com/<TENANT_ID>/oauth2/v2.0/token
```

Cadastre no Entra o redirect URI exato do callback do sistema. Guarde `state` e o PKCE `code_verifier` associados à tentativa no backend; valide o `state` no callback antes de trocar o `code`. O client secret, se usado por um backend confidencial, nunca pode sair do servidor. Para um serviço unattended, prefira a seção app-only para não depender de uma pessoa, consentimento interativo ou refresh token de usuário.

## 9. Verificação rápida

- `invalid_client`: confirme tenant, client ID e **Value** do secret/certificado.
- `invalid_scope` ou `401/403` no Graph: confirme Application permissions, `.default` e admin consent.
- `403` para a mailbox: confirme que a mailbox existe no Exchange Online e que a autorização Exchange RBAC inclui exatamente essa mailbox e operação.
- `404` ao consultar `/users/{mailbox}`: confira UPN/ID e existência/provisionamento da mailbox.
- Não use `/me` com token app-only; informe a mailbox em `/users/{mailbox}/...`.
- Não registre tokens, secrets ou corpos de email em logs de produção.

## Referências oficiais

- [Registrar aplicativo no Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app)
- [Obter acesso app-only ao Microsoft Graph](https://learn.microsoft.com/en-us/graph/auth-v2-service)
- [Permissões e autorização do Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-overview)
- [Application RBAC para mailboxes no Exchange Online](https://learn.microsoft.com/en-us/graph/auth-limit-mailbox-access)
