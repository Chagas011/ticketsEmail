# Configura Exchange Online Application RBAC para auxilio.dti@fecap.br.
# Execute em PowerShell no computador do administrador; não precisa estar na VM da API.
# Pré-requisito, uma vez por computador:
#   Install-Module ExchangeOnlineManagement -Scope CurrentUser
# A conta conectada precisa ter as funções administrativas necessárias no Exchange Online.
# Execute este script uma única vez para este app/escopo; os comandos de criação não são repetíveis.

$ErrorActionPreference = "Stop"

$mailbox = "auxilio.dti@fecap.br"
$scopeName = "EmailWorker-AuxilioDTI"
$displayName = "Email Worker Produção"

function Read-RequiredValue {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Prompt
  )

  $value = (Read-Host $Prompt).Trim()
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "O valor '$Prompt' é obrigatório."
  }

  return $value
}

$appId = Read-RequiredValue "Application (client) ID do app"
$enterpriseAppObjectId = Read-RequiredValue "Object ID da Enterprise Application (service principal)"
$adminUpn = Read-RequiredValue "UPN da conta administradora do Exchange Online"

Write-Host "`nMailbox alvo: $mailbox"
Write-Host "Confirme que o endereço existe como mailbox no Exchange Online."
Write-Host "O Object ID solicitado deve ser o da Enterprise Application, não o Object ID de App registrations."

$confirm = Read-Host "Digite CONFIGURAR para criar o escopo e as permissões"
if ($confirm -cne "CONFIGURAR") {
  Write-Host "Cancelado; nenhuma configuração foi aplicada."
  exit 0
}

Import-Module ExchangeOnlineManagement
Connect-ExchangeOnline -UserPrincipalName $adminUpn

try {
  # Registra no Exchange o ponteiro para o service principal do Entra.
  New-ServicePrincipal `
    -AppId $appId `
    -ObjectId $enterpriseAppObjectId `
    -DisplayName $displayName

  # Limita as atribuições RBAC abaixo à mailbox indicada.
  New-ManagementScope `
    -Name $scopeName `
    -RecipientRestrictionFilter "PrimarySmtpAddress -eq '$mailbox'"

  # Permite ler mensagens e criar a resposta usando a identidade do app.
  New-ManagementRoleAssignment `
    -App $enterpriseAppObjectId `
    -Role "Application Mail.Read" `
    -CustomResourceScope $scopeName

  New-ManagementRoleAssignment `
    -App $enterpriseAppObjectId `
    -Role "Application Mail.Send" `
    -CustomResourceScope $scopeName

  Write-Host "`nTestando as atribuições RBAC para $mailbox..."
  Test-ServicePrincipalAuthorization `
    -Identity $appId `
    -Resource $mailbox | Format-Table

  Write-Host "`nVerifique se Application Mail.Read e Application Mail.Send aparecem com InScope = True."
  Write-Host "O teste acima avalia as permissões do Exchange RBAC; ele não inclui permissões concedidas separadamente no Entra."
}
finally {
  Disconnect-ExchangeOnline -Confirm:$false
}
