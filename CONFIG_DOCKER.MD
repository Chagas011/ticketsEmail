# Docker: API, Redis e worker

O arquivo `compose.yaml` inicia os três serviços. O Redis usa um volume persistente
e não expõe porta para fora da rede Docker. A API fica disponível somente em
`127.0.0.1:3001` do host.

No `.env`, configure as credenciais do Graph e `REDIS_URL=redis://redis:6379/0`.
O nome `redis` é o endereço do serviço dentro da rede do Compose.
Configure também `OPENAI_API_KEY` com sua chave da API da OpenAI. O worker usa
`OPENAI_MODEL=gpt-6-luna` por padrão para avaliar e-mails sem ticket existente.

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f api worker
```

Para parar os serviços, use `docker compose down`. O volume da fila permanece
salvo. Para reconstruir após alterações no código, execute novamente
`docker compose up -d --build`.

Para desenvolvimento fora do Docker, use `REDIS_URL=redis://localhost:6379/0`
com um Redis local e rode `npm run dev` e `npm run worker` em terminais separados.
