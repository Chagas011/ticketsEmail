# Autenticação da API com Microsoft Entra

`authMiddleware` valida access tokens delegados v2.0 emitidos para esta API, no locatário `GRAPH_TENANT_ID`. Ele verifica assinatura RS256 com as chaves públicas do Entra, emissor, audiência, expiração, início de validade quando presente, versão, locatário, `sub` e o escopo delegado configurado. Tokens de aplicativo sem `scp`, tokens de ID e access tokens destinados ao Microsoft Graph não são aceitos.

No registro de aplicativo que representa esta API, configure **Expor uma API**, defina o Application ID URI e crie um escopo delegado, por exemplo `access_as_user`. Configure o recurso para emitir access tokens versão 2 (`requestedAccessTokenVersion: 2`). O cliente precisa receber consentimento para esse escopo e solicitar um access token para a API usando o escopo completo (por exemplo `api://<id-da-api>/access_as_user`). Consulte a [documentação do Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis).

Configure no `.env`:

```env
GRAPH_TENANT_ID=id-do-locatario
AUTH_JWT_AUDIENCE=id-do-aplicativo-que-representa-a-api
AUTH_JWT_REQUIRED_SCOPE=access_as_user
```

A audiência de tokens v2 é o ID do aplicativo da API; não é necessariamente o ID do aplicativo usado pelo backend para acessar o Graph. Não use o token do Graph no header enviado à sua API. O middleware usa o valor curto do escopo na claim `scp`; o cliente solicita o escopo completo. As chaves públicas são obtidas do endpoint do locatário e mantidas em cache pela biblioteca de verificação.

Para proteger uma rota Express após configurar o Entra:

```ts
router.get("/recurso", authMiddleware, controller);
```

A validação do token e do escopo não decide quais usuários podem acessar uma mailbox específica. A rota deve verificar essa autorização separadamente. A rota SSE usa este middleware e exige o access token da API no header `Authorization`; o `EventSource` nativo não permite definir esse header, portanto a integração futura precisa usar um cliente SSE baseado em `fetch` ou adaptar a autenticação para sessão com cookie seguro.
