# Responder a um e-mail recebido

Este recurso usa o fluxo de conta pessoal que já existe neste projeto. A resposta é enviada pelo endpoint Microsoft Graph `POST /me/messages/{id}/reply`, preservando a conversa original. O Graph requer a permissão delegada `Mail.Send` para esta operação e responde `202 Accepted` quando aceita o pedido; esse status não confirma que a entrega final já ocorreu.

## 1. Conceder a permissão no Microsoft Entra

1. Acesse o portal [Microsoft Entra](https://entra.microsoft.com/) e abra **Identidade → Aplicativos → Registros de aplicativo**.
2. Selecione o mesmo registro usado pelo backend (`GRAPH_CLIENT_ID`).
3. Abra **Permissões de API → Adicionar uma permissão → Microsoft Graph → Permissões delegadas**.
4. Pesquise `Mail.Send`, marque a permissão e confirme em **Adicionar permissões**.
5. Para conta corporativa, um administrador pode precisar clicar em **Conceder consentimento do administrador**. Para conta Microsoft pessoal, a permissão será consentida durante o próximo login.
6. A permissão já existente `Mail.Read` continua necessária para abrir o corpo do e-mail. Não remova `User.Read` nem `offline_access` do fluxo atual.

## 2. Atualizar o backend e reconectar

O código passou a solicitar `Mail.Send` no escopo OAuth em `PersonalGraphAuthRepository.ts`. Recompile/reinicie ou publique a API atualizada. No navegador, acesse `/microsoft/connect`, informe o `GRAPH_CONNECT_SECRET` e conclua o login/consentimento novamente. A sessão e tokens antigos em memória não carregam a nova permissão; após concedê-la, faça nova autorização. Se o login não mostrar a tela de consentimento e continuar dando 403, remova o consentimento/permissão concedida para o app e conecte outra vez, ou use uma nova sessão de navegador.

## 3. Usar a interface

1. Abra o frontend e conecte a conta Microsoft.
2. Aguarde a conexão SSE aparecer como ativa e selecione um e-mail na lista.
3. No painel da mensagem, desça até **Responder a este e-mail**.
4. Escreva a resposta e clique **Enviar resposta**.
5. Aguarde a confirmação. O backend retorna `202` após o Graph aceitar o pedido e a resposta deve aparecer na conversa e em **Itens Enviados**.

## 4. Contrato da API

```http
POST /microsoft/messages/{messageId}/reply
Content-Type: application/json
Cookie: graph_personal_session=...

{ "comment": "Texto da resposta" }
```

A rota exige a sessão pessoal, valida ID e comentário (1 a 10.000 caracteres), chama Graph e devolve `202 Accepted`. Respostas comuns de erro:

- `400`: ID ou texto vazio/fora do limite.
- `401`: sessão ausente/expirada; reconecte a conta.
- `403`: permissão `Mail.Send` ausente ou não consentida; conceda e autorize novamente.
- `404`: mensagem não encontrada/indisponível.
- `502`: erro inesperado do Graph ou falha de rede.

## 5. Se não funcionar

- **403 / ErrorAccessDenied:** confirme `Mail.Send` como permissão *delegada* no registro e refaça o login para obter consentimento novo.
- **401:** o cookie dura 12 horas e fica em memória; reconecte a conta após expiração ou reinício da API.
- **CORS no navegador:** se frontend e API forem de origens diferentes, configure `FRONTEND_ORIGIN` com a origem exata e reinicie o backend. A API permite `POST` para essa origem.
- **202, mas mensagem ainda não chegou:** `202` indica aceite do pedido, não conclusão da entrega. Verifique Itens Enviados, fila/serviço Exchange e políticas da organização.

## Produção corporativa futura

Este endpoint usa atualmente `/me` e token delegado de usuário. Ao migrar para client credentials e mailbox corporativa, use `/users/{mailbox}/messages/{id}/reply`, conceda a permissão de **aplicativo** apropriada e limite-a à mailbox com Exchange Online RBAC for Applications. Não basta reutilizar o token ou o modo de consentimento pessoal atual.

Referências oficiais: [Reply a message](https://learn.microsoft.com/en-us/graph/api/message-reply?view=graph-rest-1.0) e [Permissões Microsoft Graph](https://learn.microsoft.com/en-us/graph/permissions-overview).
