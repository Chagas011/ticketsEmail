# Roadmap para recriar a integração Microsoft Graph

Siga os documentos nesta ordem. Ela parte de um sistema novo, backend single tenant, acesso app-only e uma mailbox corporativa. Os passos de cadastro do app, criação do secret e configuração das permissões você já conhece; consulte [AUTHORIZATION.MD](./AUTHORIZATION.MD) para confirmar o modelo de autorização escolhido.

## 1. Definir identidade, mailbox e autorização — `AUTHORIZATION.MD`

- Confirme o tenant single tenant, `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` e a mailbox alvo.
- Escolha entre permissão ampla no Entra ou escopo de mailbox pelo Exchange Application RBAC.
- Não conceda a mesma permissão ampla no Entra se a intenção for limitar essa permissão a uma mailbox pelo RBAC.
- Implemente no backend a obtenção do token app-only com client credentials.

**Resultado esperado:** o backend consegue obter token para chamar o Graph, sem expor credenciais ao frontend.

## 2. Configurar o Exchange e a hospedagem — `azure.md`

- Localize o Object ID da Enterprise Application.
- Se for usar acesso restrito, conecte ao Exchange Online PowerShell, crie o escopo, atribua `Application Mail.Read` (e `Application Mail.Send` se for responder) e teste a mailbox permitida e uma não permitida.
- Guarde segredos em configuração segura, preferencialmente Key Vault.
- Publique a API, configure variáveis de ambiente, domínio público e HTTPS.

**Resultado esperado:** a identidade só tem o acesso planejado e a API possui uma URL pública HTTPS.

## 3. Validar leitura de email — `GETEMAIL.MD`

- Liste uma página da Inbox usando `/users/{mailbox}/mailFolders/inbox/messages`.
- Busque uma mensagem específica por ID e confira corpo, remetente, assunto e data.
- Trate paginação, erros e limites de requisição do Graph.

**Resultado esperado:** chamadas autenticadas leem a mailbox corporativa correta.

## 4. Receber mudanças em tempo real — `SUBSCRIPTION_WEBHOOK.MD`

- Implemente a rota pública `POST /graph/notifications`.
- Responda ao desafio `validationToken` em texto puro.
- Valide `clientState` e `subscriptionId`, e responda rapidamente ao Graph.
- Crie a subscription com `notificationUrl` HTTPS e o recurso da Inbox da mailbox escolhida.
- Persista ID e expiração da subscription e implemente renovação antes do vencimento.
- Ao receber um ID de mensagem, enfileire o trabalho e busque os dados com o fluxo de `GETEMAIL.MD`.

**Resultado esperado:** a chegada de uma mensagem gera uma notificação e o backend busca os dados atuais no Graph.

## 5. Persistir e apresentar as mensagens

Depois que leitura e webhook funcionarem:

- Persista mensagens em banco com uma chave que evite duplicação de notificações.
- Ao receber repetidamente a mesma mensagem, atualize o registro existente.
- Associe respostas e mensagens relacionadas pela conversa (`conversationId`) e/ou pelas relações que a aplicação decidir suportar.
- Exponha endpoints próprios da API para o frontend; o frontend não chama o Graph com o segredo do aplicativo.

**Resultado esperado:** a interface apresenta conversas consistentes e notificações repetidas não criam linhas duplicadas.

## 6. Implementar envio de resposta, se necessário

Para responder email, mantenha a autorização `Mail.Send` no mesmo modelo escolhido e use o endpoint `/users/{mailbox}/messages/{messageId}/reply`. Armazene a resposta enviada e trate `202 Accepted` como solicitação aceita pelo Graph, não como confirmação final de entrega. Consulte os exemplos de resposta em [AUTHORIZATION.MD](./AUTHORIZATION.MD).

## Ordem resumida

```text
AUTHORIZATION.MD
      ↓
azure.md
      ↓
GETEMAIL.MD
      ↓
SUBSCRIPTION_WEBHOOK.MD
      ↓
Banco de dados e API do frontend
      ↓
Resposta de email (se necessária)
```

## Critério para avançar entre etapas

- **Autorização:** token app-only válido e acesso permitido somente conforme o modelo escolhido.
- **Azure/Exchange:** mailbox e ambiente de produção configurados; webhook acessível por HTTPS.
- **GET:** listagem e leitura individual retornam os dados esperados.
- **Subscription:** validação aceita, notificações chegam e são renovadas antes da expiração.
- **Aplicação:** mensagens são atualizadas idempotentemente e aparecem como conversas.
