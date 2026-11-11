# Configurações restantes no Azure para Microsoft Graph

Este guia parte do ponto em que o aplicativo single tenant já foi registrado, o client secret foi criado e as permissões de API foram escolhidas. Ele cobre o vínculo com a mailbox corporativa, a hospedagem da API e os ajustes necessários para operar o webhook em produção.

## 1. Defina qual mailbox o serviço vai acompanhar

Confirme que o endereço corporativo, por exemplo `suporte@empresa.com`, existe como mailbox no Exchange Online e está habilitado para receber emails. No modelo app-only, não há uma tela no registro do aplicativo para “conectar” uma conta. O backend escolhe a mailbox nas chamadas Graph, usando `/users/{UPN-ou-ID}/...`; a subscription também aponta para essa mailbox.

Use o mesmo endereço em `GRAPH_MAILBOX`, nas chamadas Graph e ao criar a subscription. Se houver mais de uma mailbox, decida explicitamente quais o serviço pode acessar.

## 2. Restringir o aplicativo à mailbox no Exchange Online

As permissões de aplicação do Microsoft Graph podem dar acesso amplo às mailboxes do tenant. Para um serviço de produção que deve acessar apenas uma mailbox, configure **Exchange Online Application RBAC** com o administrador do Exchange. A configuração é feita no Exchange Online PowerShell, não na tela de App registrations.

### 2.1 Localize o Object ID correto

No [Microsoft Entra admin center](https://entra.microsoft.com/):

1. Abra **Identity → Applications → Enterprise applications**.
2. Localize o service principal correspondente ao aplicativo.
3. Copie o **Object ID** dessa Enterprise Application.

Não confunda esse valor com o **Application (client) ID** nem com o Object ID exibido em **App registrations**. Para o comando do Exchange, use o Object ID da Enterprise Application/service principal.

### 2.2 Crie o escopo e atribua as funções no Exchange

Esses comandos são executados uma vez por um administrador, em um computador com acesso à internet. **Não precisam ser executados dentro da VM que hospeda a API.** Use Windows PowerShell ou PowerShell 7 no seu computador; uma janela de login Microsoft será aberta durante a conexão. O administrador precisa ter a função Exchange Administrator no Entra e as permissões delegadoras necessárias para atribuir funções de aplicativo no Exchange (normalmente, membro de Organization Management). Combine isso com o administrador do tenant antes de executar os comandos.

1. Abra o PowerShell.
2. Instale o módulo Exchange Online (na primeira utilização):

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
```

3. Importe o módulo e conecte-se com a conta administradora do Microsoft 365:

```powershell
Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName admin@empresa.com
```

Se preferir, use o script [configurar-rbac-exchange.ps1](./configurar-rbac-exchange.ps1), que aplica as atribuições para `auxilio.dti@fecap.br`. Execute-o uma única vez para esse app e escopo; ele solicita os IDs e a conta administradora.

Substitua `admin@empresa.com` pelo endereço da conta administradora. Depois de autenticar, execute na mesma sessão os comandos abaixo. Troque os valores de exemplo pelo Application (client) ID, pelo Object ID copiado da Enterprise Application e pelo endereço real da mailbox:

```powershell
$appId = "<Application (client) ID>"
$enterpriseAppObjectId = "<Object ID da Enterprise Application>"
$mailbox = "suporte@empresa.com"

New-ServicePrincipal `
  -AppId $appId `
  -ObjectId $enterpriseAppObjectId `
  -DisplayName "Email Worker Produção"

New-ManagementScope `
  -Name "EmailWorker-SomenteMailboxSuporte" `
  -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$mailbox'"

New-ManagementRoleAssignment `
  -App $enterpriseAppObjectId `
  -Role "Application Mail.Read" `
  -CustomResourceScope "EmailWorker-SomenteMailboxSuporte"

New-ManagementRoleAssignment `
  -App $enterpriseAppObjectId `
  -Role "Application Mail.Send" `
  -CustomResourceScope "EmailWorker-SomenteMailboxSuporte"
```

Se o backend também envia respostas, atribua a função `Application Mail.Send` dentro do mesmo escopo:

```powershell
New-ManagementRoleAssignment `
  -App $enterpriseAppObjectId `
  -Role "Application Mail.Send" `
  -CustomResourceScope "EmailWorker-SomenteMailboxSuporte"
```

O escopo usa o endereço SMTP primário da mailbox. Se sua regra de destinatários for diferente, ajuste o filtro com o administrador Exchange e confirme que ele seleciona exatamente os destinatários pretendidos.

### 2.3 Verifique o resultado

Após a propagação da configuração, teste a autorização para a mailbox incluída no escopo e para outra mailbox que deve ficar fora dele:

```powershell
Test-ServicePrincipalAuthorization `
  -Identity $appId `
  -Resource suporte@empresa.com | Format-Table
```

Confirme no resultado que as funções esperadas estão autorizadas para a mailbox alvo. Faça também uma chamada Graph real com a identidade da aplicação; teste que a mailbox permitida funciona e que uma mailbox fora do escopo é negada.

Ao terminar, encerre a sessão:

```powershell
Disconnect-ExchangeOnline -Confirm:$false
```

> **Atenção às permissões duplicadas:** permissões de aplicação concedidas diretamente no Microsoft Entra e funções atribuídas pelo Exchange Application RBAC são cumulativas. Se o aplicativo mantiver uma permissão Graph ampla como `Mail.Read` diretamente consentida no Entra, o escopo Exchange não a limita. Para usar o RBAC como restrição efetiva, remova a concessão ampla duplicada do Entra depois de preparar e validar a configuração Exchange. Faça essa mudança coordenada com o administrador responsável. A seção 3 de [AUTHORIZATION.MD](./AUTHORIZATION.MD) explica os dois modelos.

## 3. Configure a hospedagem e as variáveis de ambiente

Publique o backend em um host que suporte o runtime usado pelo projeto. A rota do webhook precisa ser acessível pela internet em HTTPS, sem autenticação interativa, para que o Graph consiga validar a URL e entregar notificações.

Se a API estiver em **Azure App Service**, selecione o recurso no portal e acesse **Settings → Environment variables → App settings**. Se estiver hospedada em outro provedor, cadastre essas variáveis no painel de configuração desse provedor. Em ambos os casos, use os valores de produção esperados pelo backend, por exemplo:

```text
ENTRA_TENANT_ID
ENTRA_CLIENT_ID
ENTRA_CLIENT_SECRET
GRAPH_MAILBOX
GRAPH_WEBHOOK_URL
GRAPH_CLIENT_STATE
```

Use os valores do tenant, do aplicativo e da mailbox de produção. `GRAPH_WEBHOOK_URL` deve conter a URL pública completa, por exemplo `https://api.empresa.com/graph/notifications`. Gere `GRAPH_CLIENT_STATE` aleatoriamente e mantenha o mesmo valor usado pela aplicação ao criar a subscription. Os nomes exatos dependem da implementação; consulte [AUTHORIZATION.MD](./AUTHORIZATION.MD) e [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD).

Para o secret, prefira armazená-lo em um cofre de segredos, como Azure Key Vault, e configurar a referência no ambiente de hospedagem. Evite inserir o valor em código, imagem Docker, configuração versionada ou logs. No App Service, alterações em App settings reiniciam o aplicativo.

Se usar slots de implantação no App Service, marque credenciais e configurações específicas de produção como configurações de slot para que não sejam trocadas acidentalmente durante um swap.

## 4. Opcional: exponha sua API para o frontend

**Expose an API / Expor uma API** publica um escopo OAuth da sua API para que um cliente, como um frontend, possa pedir autorização para chamar seu backend em nome de um usuário conectado. Essa configuração não publica o servidor, não cria uma rota HTTP e não cadastra a URL do webhook do Microsoft Graph. O webhook usa a URL pública da API em `notificationUrl` quando o backend cria a subscription; veja a seção 6 e [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD).

Configure esta seção somente se o frontend precisar autenticar usuários e chamar endpoints protegidos da sua API. Se o backend não tiver chamadas autenticadas por usuários, este escopo não é necessário para a integração app-only do Graph.

### 4.1 Publique um escopo delegado

No Microsoft Entra admin center:

1. Abra **Identity → Applications → App registrations → seu aplicativo → Expose an API**.
2. Em **Application ID URI**, confirme ou defina o URI da API. O padrão sugerido é `api://<API_CLIENT_ID>`; salve-o.
3. Selecione **Add a scope** e preencha:
   - **Scope name**: `access_as_user`.
   - **Who can consent?**: escolha usuários ou somente administradores conforme a política do tenant.
   - **Admin consent display name/description**: texto claro informando que o cliente pode acessar a API em nome do usuário.
   - **User consent display name/description**: preencha se o tenant permitir consentimento do usuário.
   - **State**: `Enabled`.
4. Salve o escopo. O identificador completo será `api://<API_CLIENT_ID>/access_as_user` (ou `<APPLICATION_ID_URI>/access_as_user` se você escolheu outro URI).

### 4.2 Autorize o frontend cliente

No registro do **frontend** no Entra, abra **API permissions → Add a permission → My APIs → sua API**. Selecione **Delegated permissions**, marque `access_as_user` e adicione a permissão. Conceda consentimento administrativo se a política do tenant exigir. O frontend então solicita esse escopo usando o fluxo de login adequado, como Authorization Code com PKCE via MSAL.

No backend, valide o access token recebido do frontend: assinatura, emissor do tenant, audiência da sua API, validade e presença do escopo `access_as_user` (`scp`). Não aceite o token app-only destinado ao Microsoft Graph como autenticação de usuário da sua API. A configuração do escopo, por si só, não implementa validação no backend nem protege rotas; essa validação precisa existir na aplicação. Consulte a seção 7 de [AUTHORIZATION.MD](./AUTHORIZATION.MD).

## 5. Garanta HTTPS e defina o domínio público

Para começar, o domínio padrão `https://<nome-do-app>.azurewebsites.net` pode ser usado. Se usar um domínio próprio:

1. No App Service, abra **Settings → Custom domains** e inicie a adição do domínio.
2. Crie no DNS o registro solicitado pelo portal e conclua a validação de propriedade.
3. Configure o certificado TLS e associe o binding HTTPS ao domínio.
4. Ative **HTTPS Only** nas configurações do App Service.
5. Teste a URL pública da rota, por exemplo `https://api.empresa.com/graph/notifications`.

O endpoint deve responder ao desafio `validationToken` com HTTP 200 e texto puro. Os detalhes da rota e do teste estão em [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD).

## 6. Crie a subscription apontando para a URL publicada

Não há um campo para cadastrar a URL do webhook em **App registrations** ou **Enterprise applications**. Depois de publicar a API, o backend cria a subscription com uma chamada autenticada `POST https://graph.microsoft.com/v1.0/subscriptions`, informando a URL no campo `notificationUrl` e a mailbox no campo `resource`.

Siga [SUBSCRIPTION_WEBHOOK.MD](./SUBSCRIPTION_WEBHOOK.MD) para criar, validar, armazenar e renovar a subscription. A URL precisa estar disponível em HTTPS antes da criação, porque o Graph valida o endpoint durante essa operação.

## 7. Checklist de implantação

- A mailbox corporativa existe no Exchange Online e o endereço usado pela aplicação está correto.
- O service principal foi identificado pelo Object ID da Enterprise Application.
- O Exchange Application RBAC permite as operações necessárias somente no escopo planejado.
- As permissões amplas duplicadas no Entra não anulam a restrição de mailbox pretendida.
- As configurações de produção estão no provedor de hospedagem/cofre de segredos e não no repositório.
- O domínio público resolve para a API, o certificado HTTPS é válido e HTTPS Only está ativo.
- O webhook retorna corretamente o desafio do Graph.
- A subscription foi criada para a mailbox certa, e seu ID e expiração são persistidos para renovação.
- O teste confirma acesso à mailbox autorizada e nega acesso a outra mailbox.

## Referências oficiais

- [Exchange Online Application RBAC](https://learn.microsoft.com/en-us/exchange/permissions-exo/application-rbac)
- [Configurações de ambiente do Azure App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Configurar bindings SSL para domínios no App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-ssl-bindings)
- [Receber change notifications via webhooks do Microsoft Graph](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks)
- [Configurar uma API para expor escopos no Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-configure-app-expose-web-apis)
