# Monitorar conta Microsoft pessoal

A API monitora uma conta pessoal por processo. O login usa OAuth authorization code com PKCE e pede permissões **delegadas** `User.Read` e `Mail.Read`, além de `offline_access`. A subscription e sua renovação usam o access token do usuário; `GRAPH_MAILBOX_USER_ID` não é mais necessário.

## Preparar o aplicativo no Microsoft Entra

1. Em **Registros de aplicativo**, selecione seu aplicativo e verifique em **Autenticação** se os tipos de conta suportados incluem contas Microsoft pessoais. Dependendo do registro atual pode ser necessário ajustar essa opção ou criar outro aplicativo.
2. Em **Permissões de API**, adicione Microsoft Graph → **Permissões delegadas** → `User.Read` e `Mail.Read`. Ao entrar, conceda o consentimento solicitado.
3. Em **Autenticação → Adicionar plataforma → Web**, cadastre exatamente `https://SEU_DOMINIO_PUBLICO/microsoft/oauth/callback` como URI de redirecionamento. Não selecione SPA para este callback: a troca do código é feita pelo backend.
4. Garanta que `GRAPH_PUBLIC_URL` seja a URL HTTPS pública da API, sem a barra final e sem caminho que o proxy não encaminhe. O Graph e o navegador precisam conseguir acessar essa URL.
5. Configure as variáveis indicadas em `.env.personal.example`. Gere valores independentes para `GRAPH_CLIENT_STATE` e `GRAPH_CONNECT_SECRET`, por exemplo executando duas vezes `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Não inclua os segredos em código, exemplos ou commits.

O valor de `GRAPH_CLIENT_STATE` deve continuar o mesmo enquanto a subscription existir. Caso seja trocado, subscriptions antigas precisam ser removidas ou expirar para que outra seja criada com o novo valor; o Graph não revela o valor antigo ao listar subscriptions. URLs diferentes em subscription existente também exigem correção manual. A API não remove subscriptions automaticamente.

## Conectar e testar

O Dockerfile habilita a página de conexão. Ao iniciar, a API prepara a autorização em memória e exibe nos logs o endereço da página, sem registrar o link temporário de autorização nem seus segredos. Depois de iniciar o container, abra no seu navegador `https://SEU_DOMINIO_PUBLICO/microsoft/connect`, informe o `GRAPH_CONNECT_SECRET` e clique em **Conectar com Microsoft**. A página solicita a URL de autorização e redireciona o navegador para o login. Se o estado preparado tiver expirado, a API gera outro ao conectar. O container na VM não consegue abrir automaticamente o navegador no seu computador; você precisa abrir a página e autorizar a conta. As variáveis do `.env` devem ser fornecidas ao container em tempo de execução, pois esse arquivo não é copiado para a imagem.

Como alternativa, envie um POST autenticado ao endpoint de conexão. Use HTTPS para o endereço público; o exemplo abaixo usa localhost apenas para o pedido inicial feito na mesma máquina da API:

```powershell
curl.exe -X POST -H "Authorization: Bearer SEU_GRAPH_CONNECT_SECRET" http://localhost:3001/microsoft/connect
```

Se usar o POST manual, copie a `authorizationUrl` da resposta para o navegador. A URL de login contém um estado temporário e só deve ser usada uma vez; não a compartilhe. Após o login e o consentimento, a API tentará criar ou renovar a subscription e gravará um cookie de sessão `HttpOnly` e `Secure` no navegador. A resposta informa se a subscription ficou ativa. Se a criação falhar, consulte os logs: a API tentará novamente a cada 15 minutos enquanto a conta estiver conectada.

No **mesmo navegador**, abra `https://SEU_DOMINIO_PUBLICO/microsoft/events`. A conexão permanece aberta; envie um e-mail para a Inbox para receber `event: email.received` e o `messageId`. Para integrar React no mesmo domínio, use `EventSource('/microsoft/events')`. Se o frontend e a API estiverem em origens diferentes, será necessário configurar CORS e a política de cookies apropriados; a sessão atual usa `SameSite=Lax` e não configura CORS.

O SSE também continua aceitando um token JWT delegado da API autorizado pelo middleware já existente. Essa autenticação é independente do login pessoal do Graph. Todo usuário aceito por essa rota recebe os eventos da única mailbox conectada; adicione autorização específica antes de compartilhar a API.

## Limites

Access token, refresh token, estado de login, sessão do navegador, ID da subscription e conexões SSE ficam somente na memória. Após reiniciar, será necessário conectar a conta novamente; não há replay dos eventos perdidos. O refresh token é renovado em memória quando possível, mas a Microsoft pode exigir novo login. Use apenas uma instância da API: múltiplas instâncias não compartilham tokens nem conexões. O cookie de sessão dura 12 horas e expira independentemente da subscription; a conexão SSE é encerrada ao expirar a sessão ou o JWT usado para abri-la. Para voltar a receber eventos após expirar o cookie, execute a conexão novamente.

A subscription pode permanecer ativa no Graph após o processo parar. Ela só será reconhecida após uma nova conexão bem-sucedida. Eventos que chegarem antes disso ou enquanto nenhum cliente SSE estiver conectado não são armazenados. Notificações `missed` são registradas no log, mas não são recuperadas automaticamente.
