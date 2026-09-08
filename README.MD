# Base API Express

API base construída com **Node.js, Express e TypeScript**, utilizando uma arquitetura inspirada em conceitos do NestJS, porém mantendo uma implementação própria, simples e desacoplada.

O projeto utiliza:

- TypeScript
- Node.js
- Express
- Clean Architecture
- SOLID
- Dependency Injection
- Decorators
- Reflect Metadata
- Zod
- JWT Decode
- Path Aliases
- Middleware de autenticação

---

## 📌 Objetivo

O objetivo deste projeto é criar uma estrutura base para desenvolvimento de APIs utilizando Express, mas com alguns recursos normalmente encontrados em frameworks mais completos, como:

- Injeção automática de dependências
- Controllers
- Use Cases
- Decorators
- Validação de dados
- Middlewares
- Adapters
- Separação por módulos

A ideia é manter a aplicação **simples, extensível e organizada**, sem introduzir toda a complexidade de frameworks como NestJS.

---

# 🏗️ Arquitetura

A aplicação segue uma abordagem baseada em **Clean Architecture**, separando responsabilidades entre diferentes camadas.

Uma estrutura simplificada:

```text
src/
├── application/
│   ├── contracts/
│   │   └── Controller.ts
│   │
│   ├── controllers/
│   │   └── Account/
│   │       └── AccountController.ts
│   │
│   ├── entities/
│   │   └── Account.ts
│   │
│   └── useCases/
│       └── AccountUseCase.ts
│
├── adapter/
│   └── expressRouteAdapter.ts
│
├── infrastructure/
│   └── http/
│
├── kernel/
│   ├── decorators/
│   │   └── Injectable.ts
│   │
│   └── di/
│       └── Registry.ts
│
├── routes/
│   └── index.ts
│
├── shared/
│   └── types/
│
├── app.ts
└── server.ts
```

A estrutura pode crescer conforme novos módulos forem adicionados.

---

# 🔄 Fluxo da aplicação

Uma requisição percorre a aplicação seguindo aproximadamente este fluxo:

```text
                  HTTP Request
                       │
                       ▼
                  Express Router
                       │
                       ▼
                 Middleware
                       │
                       ▼
             expressRouteAdapter
                       │
                       ▼
                 Registry (DI)
                       │
                       ▼
                  Controller
                       │
                       ▼
                   Use Case
                       │
                       ▼
                  Repository
                       │
                       ▼
                    Database
```

A resposta percorre o caminho inverso:

```text
Database
   │
   ▼
Repository
   │
   ▼
Use Case
   │
   ▼
Controller
   │
   ▼
expressRouteAdapter
   │
   ▼
Express Response
```

---

# 🚀 Inicialização da aplicação

O ponto de entrada da aplicação é:

```text
src/server.ts
```

Exemplo:

```ts
import "reflect-metadata";

import { app } from "./app";

app.listen(3333, () => {
  console.log("Server running on port 3333");
});
```

O `reflect-metadata` precisa ser carregado antes que os decorators e o sistema de Dependency Injection sejam utilizados.

---

# ⚙️ App

O arquivo:

```text
src/app.ts
```

é responsável por configurar o Express.

Exemplo:

```ts
import express from "express";
import { routes } from "./routes";

const app = express();

app.use(express.json());
app.use(routes);

export { app };
```

O `app` concentra as configurações globais da aplicação.

---

# 🛣️ Rotas

As rotas são separadas por módulo.

Exemplo:

```text
src/
└── routes/
    └── account/
            └── account.routes.ts
        └── index.ts

```

Uma rota pode ser definida assim:

```ts
import { Router } from "express";

import { expressRouteAdapter } from "@/adapter/expressRouteAdapter";
import { AccountController } from "../controllers/AccountController";

export const accountRoutes = Router();

accountRoutes.get("/", expressRouteAdapter(AccountController));
```

Depois, as rotas do módulo são registradas no router principal:

```ts
import { Router } from "express";

import { accountRoutes } from "@/modules/account/routes/account.routes";

const routes = Router();

routes.use("/account", accountRoutes);

export { routes };
```

Dessa forma:

```http
GET /account
```

será direcionado para `AccountController`.

---

# 🔌 Express Route Adapter

O `expressRouteAdapter` funciona como uma ponte entre o Express e a arquitetura da aplicação.

O Express trabalha com:

```ts
Request;
Response;
NextFunction;
```

Enquanto nosso Controller trabalha com uma estrutura própria.

O adapter faz essa conversão.

Exemplo:

```ts
export function expressRouteAdapter(
  controllerClass: Constructor<Controller<"public" | "private", unknown>>,
) {
  return async (request: Request, response: Response) => {
    const controller = Registry.getInstance().resolve(controllerClass);

    const result = await controller.execute({
      body: request.body,
      params: request.params,
      queryParams: request.query,
      accountId: request.userId ?? null,
    });

    return response.status(result.statusCode).json(result.body);
  };
}
```

O adapter é responsável por:

1. Receber a requisição do Express
2. Resolver o Controller através do Registry
3. Montar o objeto de entrada
4. Executar o Controller
5. Transformar o resultado em uma resposta HTTP

---

# 🎮 Controllers

Controllers são responsáveis por receber as requisições HTTP e coordenar a execução de um Use Case.

Exemplo:

```ts
@Injectable()
export class AccountController extends Controller<
  "public",
  AccountController.Response
> {
  constructor(private readonly accountUseCase: AccountUseCase) {
    super();
  }

  protected override async handle(): Promise<
    Controller.Response<AccountController.Response>
  > {
    const { account } = await this.accountUseCase.execute();

    return {
      statusCode: 200,
      body: {
        account,
      },
    };
  }
}
```

O Controller **não deve conter regras de negócio complexas**.

Sua principal responsabilidade é:

```text
HTTP Request
     ↓
Controller
     ↓
Use Case
     ↓
HTTP Response
```

---

# 🧠 Use Cases

Os Use Cases concentram as regras de negócio da aplicação.

Exemplo:

```ts
@Injectable()
export class AccountUseCase {
  async execute(): Promise<AccountUseCase.Output> {
    const account = new Account({
      email: "EMAIL@EMAIL.COM",
    });

    return {
      account,
    };
  }
}
```

O Controller chama:

```ts
this.accountUseCase.execute();
```

O Use Case executa a lógica necessária e retorna os dados.

Em uma aplicação maior, ele poderá utilizar:

- Repositories
- Gateways
- Services
- APIs externas
- Filas
- Storage

Por exemplo:

```text
Controller
    │
    ▼
CreateAccountUseCase
    │
    ├── AccountRepository
    │
    ├── EmailGateway
    │
    └── NotificationGateway
```

---

# 💉 Dependency Injection

O projeto possui um sistema próprio de Dependency Injection.

A ideia é permitir:

```ts
@Injectable()
export class AccountController {
  constructor(private readonly accountUseCase: AccountUseCase) {}
}
```

sem precisar fazer manualmente:

```ts
const accountUseCase = new AccountUseCase();

const controller = new AccountController(accountUseCase);
```

---

# 🏷️ `@Injectable()`

O decorator:

```ts
@Injectable()
```

registra uma classe no `Registry`.

Exemplo:

```ts
@Injectable()
export class AccountUseCase {}
```

Internamente:

```ts
export function Injectable(): ClassDecorator {
  return (target) => {
    Registry.getInstance().register(target as unknown as Constructor);
  };
}
```

Isso informa ao sistema de DI que a classe pode ser resolvida automaticamente.

---

# 📦 Registry

O `Registry` funciona como o container de Dependency Injection da aplicação.

Ele mantém as classes registradas:

```text
Registry

AccountController
AccountUseCase
AccountRepository
...
```

Quando uma classe é registrada, o Registry utiliza:

```ts
Reflect.getMetadata("design:paramtypes", impl);
```

para descobrir as dependências do constructor.

Por exemplo:

```ts
@Injectable()
export class AccountController {
  constructor(private readonly accountUseCase: AccountUseCase) {}
}
```

O metadata permite identificar:

```text
AccountController
       │
       └── AccountUseCase
```

Então o Registry consegue resolver:

```ts
const accountUseCase = this.resolve(AccountUseCase);

const controller = new AccountController(accountUseCase);
```

---

# 🔍 Resolução de dependências

O Registry resolve dependências de maneira recursiva.

Exemplo:

```ts
@Injectable()
export class AccountController {
  constructor(private readonly accountUseCase: AccountUseCase) {}
}
```

E:

```ts
@Injectable()
export class AccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}
}
```

E:

```ts
@Injectable()
export class AccountRepository {}
```

O Registry resolve:

```text
AccountController
       │
       ▼
AccountUseCase
       │
       ▼
AccountRepository
```

Internamente:

```text
resolve(AccountController)
        │
        ▼
resolve(AccountUseCase)
        │
        ▼
resolve(AccountRepository)
        │
        ▼
new AccountRepository()
        │
        ▼
new AccountUseCase(accountRepository)
        │
        ▼
new AccountController(accountUseCase)
```

---

# 🗃️ Repositories

Repositories são responsáveis pela comunicação com fontes de dados.

Por exemplo:

```ts
@Injectable()
export class AccountRepository {
  async create(account: Account) {
    // Persistência
  }

  async findById(id: string) {
    // Consulta
  }
}
```

O Use Case não precisa conhecer detalhes da infraestrutura.

Exemplo:

```ts
@Injectable()
export class CreateAccountUseCase {
  constructor(private readonly accountRepository: AccountRepository) {}

  async execute() {
    const account = new Account({
      email: "email@email.com",
    });

    await this.accountRepository.create(account);

    return {
      account,
    };
  }
}
```

Isso mantém a regra de negócio separada da implementação do banco.

---

# 🔐 Autenticação

Rotas privadas utilizam um middleware de autenticação.

Exemplo:

```ts
accountRoutes.get("/", authMiddleware, expressRouteAdapter(AccountController));
```

O middleware verifica se existe um token no header:

```http
Authorization: Bearer TOKEN
```

Exemplo:

```ts
export function authMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
) {
  const authorization = request.headers.authorization;

  if (!authorization) {
    return response.status(401).json({
      message: "Access token is required",
    });
  }

  const [type, token] = authorization.split(" ");

  if (type !== "Bearer" || !token) {
    return response.status(401).json({
      message: "Invalid authorization header",
    });
  }

  const payload = jwtDecode<JwtPayload>(token);

  if (!payload.sub) {
    return response.status(401).json({
      message: "User ID not found in token",
    });
  }

  request.userId = payload.sub;

  return next();
}
```

### ⚠️ Importante

Atualmente o middleware apenas **decodifica o JWT** para obter o `sub`.

Isso significa que:

```ts
jwtDecode(token);
```

não verifica se:

- o token foi realmente assinado pelo servidor;
- o token está expirado;
- a assinatura é válida;
- o token foi revogado.

Portanto, essa implementação não deve ser considerada uma autenticação completa.

A validação do JWT poderá ser adicionada posteriormente, por exemplo, utilizando o mecanismo de validação do provedor de identidade utilizado pela aplicação.

---

# 👤 `sub` do JWT

Depois de decodificar:

```json
{
  "sub": "123456789",
  "email": "email@email.com"
}
```

o middleware extrai:

```ts
payload.sub;
```

e armazena:

```ts
request.userId = payload.sub;
```

O adapter pode então enviar esse valor para o Controller:

```ts
const result = await controller.execute({
  body: request.body,
  params: request.params,
  queryParams: request.query,
  accountId: request.userId ?? null,
});
```

Dessa maneira, o Controller pode receber:

```ts
{
  (accountId, body, params, queryParams);
}
```

---

# 🌐 Rotas públicas e privadas

A aplicação diferencia dois tipos de rota:

### Rota pública

Não exige autenticação:

```text
Client
  │
  ▼
Express
  │
  ▼
Controller
  │
  ▼
Use Case
```

Exemplo:

```ts
accountRoutes.post("/", expressRouteAdapter(CreateAccountController));
```

O `accountId` será:

```ts
null;
```

### Rota privada

Exige o middleware:

```text
Client
  │
  ▼
Auth Middleware
  │
  ▼
Controller
  │
  ▼
Use Case
```

Exemplo:

```ts
accountRoutes.get("/", authMiddleware, expressRouteAdapter(AccountController));
```

Nesse caso:

```ts
accountId: request.userId;
```

---

# ✅ Validação com Zod

Controllers podem utilizar schemas do Zod para validar os dados recebidos.

Exemplo:

```ts
const createAccountSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
```

O Controller pode utilizar o decorator:

```ts
@Schema(createAccountSchema)
```

Exemplo:

```ts
@Injectable()
@Schema(createAccountSchema)
export class CreateAccountController extends Controller<
  "public",
  CreateAccountController.Response
> {}
```

O fluxo passa a ser:

```text
HTTP Request
      │
      ▼
Controller.execute()
      │
      ▼
Zod Validation
      │
      ├── inválido → erro
      │
      └── válido
            │
            ▼
         handle()
            │
            ▼
         Use Case
```

Isso evita que dados inválidos cheguem à camada de negócio.

---

# 🧱 Entities

Entities representam objetos importantes do domínio.

Exemplo:

```ts
export class Account {
  public readonly id: string;

  public readonly email: string;

  constructor({ email }: Account.Input) {
    this.id = generateId();
    this.email = email;
  }
}
```

A Entity pode concentrar regras e comportamentos relacionados ao próprio domínio.

---

# 📁 Organização por módulos

À medida que a aplicação crescer, os recursos devem ser organizados por domínio.

Exemplo:

```text
src/
    ├── authentication/
    │   ├── controllers/
    │   ├── useCases/
    │   └── repositories/
    │
    └── product/
        ├── controllers/
        ├── useCases/
        ├── repositories/

```

Isso evita que o projeto se transforme em uma grande estrutura baseada apenas no tipo técnico:

```text
controllers/
repositories/
services/
...
```

em toda a aplicação.

A organização por domínio mantém as funcionalidades relacionadas próximas umas das outras.

---

# 🔁 Exemplo completo de uma requisição

Considere:

```http
GET /account
Authorization: Bearer TOKEN
```

### 1. Express recebe a requisição

```text
GET /account
```

### 2. Router identifica a rota

```ts
accountRoutes.get("/", authMiddleware, expressRouteAdapter(AccountController));
```

### 3. Middleware verifica o token

```ts
request.headers.authorization;
```

Se não existir:

```http
401 Unauthorized
```

Se existir:

```text
Bearer TOKEN
```

o token é extraído.

### 4. JWT é decodificado

```ts
const payload = jwtDecode(token);
```

Obtendo:

```ts
payload.sub;
```

### 5. O `userId` é armazenado

```ts
request.userId = payload.sub;
```

### 6. Adapter resolve o Controller

```ts
Registry.resolve(AccountController);
```

O Registry identifica:

```text
AccountController
       │
       ▼
AccountUseCase
```

e cria as instâncias automaticamente.

### 7. Controller é executado

```ts
controller.execute(...)
```

### 8. Controller chama o Use Case

```ts
this.accountUseCase.execute();
```

### 9. Use Case executa a regra de negócio

```ts
const account = new Account(...);
```

### 10. Controller retorna a resposta

```ts
return {
  statusCode: 200,
  body: {
    account,
  },
};
```

### 11. Adapter envia a resposta

```http
HTTP 200
```

---

# 🧩 Princípios utilizados

O projeto busca seguir alguns princípios fundamentais.

## Single Responsibility Principle

Cada camada possui uma responsabilidade:

```text
Controller → HTTP
Use Case   → Regra de negócio
Repository → Persistência
Middleware → HTTP middleware
Adapter    → Conversão entre frameworks e aplicação
Entity     → Domínio
```

---

## Dependency Inversion

A regra de negócio não deve depender diretamente de detalhes de infraestrutura.

O objetivo é permitir que futuramente seja possível trocar:

```text
PostgreSQL
```

por:

```text
DynamoDB
```

sem precisar alterar toda a regra de negócio.

---

## Separation of Concerns

Cada parte da aplicação possui uma função bem definida.

Isso facilita:

- manutenção;
- testes;
- evolução;
- substituição de tecnologias;
- reutilização;
- entendimento do código.

---

# 🛠️ Tecnologias

| Tecnologia       | Utilização                 |
| ---------------- | -------------------------- |
| Node.js          | Runtime                    |
| Express          | HTTP Server                |
| TypeScript       | Linguagem                  |
| Zod              | Validação                  |
| Reflect Metadata | Metadata dos decorators    |
| JWT Decode       | Leitura do payload JWT     |
| KSUID            | Geração de identificadores |
| ts-node-dev      | Desenvolvimento            |
| ESLint           | Lint                       |

---

# 📦 Instalação

Clone o projeto e instale as dependências:

```bash
npm install
```

---

# ▶️ Desenvolvimento

Execute:

```bash
npm run dev
```

O projeto utiliza:

```bash
ts-node-dev
```

para reiniciar automaticamente a aplicação durante o desenvolvimento.

---

# 🏗️ Build

Para gerar a versão compilada:

```bash
npm run build
```

Os arquivos serão gerados no diretório:

```text
dist/
```

---

# 🚀 Produção

Depois do build:

```bash
npm start
```

que executa:

```bash
node dist/server.js
```

---

# ⚙️ TypeScript

O projeto utiliza decorators e metadata para implementar Dependency Injection.

Por isso são necessárias:

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

Também utilizamos aliases:

```ts
import { Account } from "@/application/entities/Account";
```

Configurados através de:

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

---

# 📜 Scripts

```bash
npm run dev
```

Inicia o servidor em desenvolvimento.

```bash
npm run build
```

Compila o TypeScript.

```bash
npm start
```

Executa a aplicação compilada.

---

# 🎯 Filosofia do projeto

Este projeto não tem como objetivo recriar o NestJS.

A proposta é utilizar alguns conceitos interessantes de frameworks modernos mantendo uma implementação pequena e fácil de entender.

Os principais conceitos são:

```text
Express
   +
Clean Architecture
   +
SOLID
   +
Dependency Injection
   +
Decorators
   +
Controllers
   +
Use Cases
   +
Middlewares
```

O objetivo final é ter uma base que permita desenvolver APIs maiores sem transformar a aplicação em um código fortemente acoplado ao Express.

---

# 📌 Fluxo resumido

```text
                    ┌───────────────┐
                    │    Client     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │    Express    │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │   Middleware  │
                    └───────┬───────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │ Express Adapter   │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │      Registry     │
                  │       (DI)        │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │    Controller     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │     Use Case      │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │    Repository     │
                  └─────────┬─────────┘
                            │
                            ▼
                  ┌───────────────────┐
                  │     Database      │
                  └───────────────────┘
```

Essa arquitetura permite que o Express fique concentrado na camada de entrada HTTP enquanto as regras de negócio permanecem independentes da infraestrutura.
