# Configurar RBAC do Exchange para `chamados@fecap.br`

Este guia configura o acesso de um aplicativo a uma única mailbox no Exchange Online usando Application RBAC. Execute os comandos no PowerShell de um computador com acesso à internet, usando uma conta administrativa autorizada no Exchange Online. Não é necessário executar nada na VM da API.

> Os comandos de criação abaixo não são idempotentes. Antes de executá-los, confirme que o service principal, o escopo e as atribuições ainda não existem no Exchange. Não repita um comando que já foi concluído com sucesso.

## 1. Reúna os identificadores do aplicativo

No centro de administração do Microsoft Entra, localize o aplicativo:

1. Em **App registrations** → selecione o aplicativo → **Overview**, copie o **Application (client) ID**. Ele será usado como `APP_CLIENT_ID`.
2. Em **Enterprise applications** → selecione o mesmo aplicativo → **Overview**, copie o **Object ID**. Ele será usado como `ENTERPRISE_APP_OBJECT_ID`.

Use o Object ID de **Enterprise applications** nos comandos Exchange. Não use o Object ID exibido em **App registrations**.

Substitua os valores de exemplo abaixo pelos IDs reais. Não coloque `client secret`, senha ou certificado neste guia.

## 2. Instale o módulo do Exchange Online

Abra PowerShell 7 ou Windows PowerShell e execute:

```powershell
Install-Module ExchangeOnlineManagement -Scope CurrentUser
```

Se o módulo já estiver instalado, pode seguir para a próxima etapa.

## 3. Conecte com a conta administradora

Carregue o módulo:

```powershell
Import-Module ExchangeOnlineManagement
```

Conecte-se interativamente, substituindo o UPN pelo login da conta administradora:

```powershell
Connect-ExchangeOnline -UserPrincipalName "admin@fecap.br"
```

Na janela de autenticação da Microsoft, entre com essa conta e complete a MFA, se solicitada. Essa conta é usada para executar a configuração; ela não será usada pela API em suas chamadas ao Graph.

## 4. Defina os valores que serão usados nos comandos

Cole os IDs reais entre aspas:

```powershell
$appId = "APP_CLIENT_ID"
$enterpriseAppObjectId = "ENTERPRISE_APP_OBJECT_ID"
$mailbox = "chamados@fecap.br"
$scopeName = "EmailWorker-Chamados"
```

Confira os valores antes de continuar:

```powershell
Write-Host "App client ID: $appId"
Write-Host "Enterprise app object ID: $enterpriseAppObjectId"
Write-Host "Mailbox: $mailbox"
Write-Host "Escopo: $scopeName"
```

## 5. Registre o aplicativo no Exchange Online

Este comando registra no Exchange o service principal do Entra:

```powershell
New-ServicePrincipal `
  -AppId $appId `
  -ObjectId $enterpriseAppObjectId `
  -DisplayName "Email Worker Chamados"
```

## 6. Crie um escopo limitado à mailbox

Este filtro restringe as atribuições seguintes à mailbox `chamados@fecap.br`:

```powershell
New-ManagementScope `
  -Name $scopeName `
  -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$mailbox'"
```

## 7. Atribua as funções necessárias

Permissão para ler mensagens:

```powershell
New-ManagementRoleAssignment `
  -App $enterpriseAppObjectId `
  -Role "Application Mail.Read" `
  -CustomResourceScope $scopeName
```

Permissão para enviar respostas:

```powershell
New-ManagementRoleAssignment `
  -App $enterpriseAppObjectId `
  -Role "Application Mail.Send" `
  -CustomResourceScope $scopeName
```

`Application Mail.Send` só é necessária se a API for enviar respostas, como no fluxo de reply. Se o aplicativo apenas ler mensagens, não crie essa atribuição.

## 8. Verifique o escopo e as atribuições

Teste a autorização efetiva para a mailbox:

```powershell
Test-ServicePrincipalAuthorization `
  -Identity $appId `
  -Resource $mailbox |
  Format-Table
```

Confirme que `Application Mail.Read` e, se criada, `Application Mail.Send` aparecem com `InScope` igual a `True`.

O teste verifica as atribuições de Exchange RBAC. Ele não contabiliza permissões de aplicativo concedidas separadamente no Entra ID. Revise essas permissões também: concessões independentes podem permitir acesso fora do escopo do Exchange RBAC.

## 9. Desconecte

Quando terminar:

```powershell
Disconnect-ExchangeOnline -Confirm:$false
```

## Observações

- A mailbox `chamados@fecap.br` precisa existir no Exchange Online e ser a mailbox configurada para o aplicativo.
- A conta usada no passo 3 precisa ter funções administrativas que permitam criar service principals, escopos e atribuições RBAC no Exchange Online.
- A API continua autenticando no Microsoft Graph com a identidade do aplicativo. A sessão administrativa do PowerShell não fica armazenada nem é usada pela API.
- Se um comando falhar depois de comandos anteriores terem sido concluídos, primeiro consulte o que já existe. Não execute tudo novamente sem verificar, pois nomes de escopo e atribuições podem já estar criados.
