# Padrões do projeto

- Classes que recebem dependências devem usar `@Injectable()` e injeção pelo construtor.
- Use Axios nas requisições HTTP do backend e async/await em operações assíncronas.
- Conecte controllers às rotas por `expressRouteAdapter`.
- Não acrescente `static`, `void` ou o modificador de acesso `public`.
- Para estado compartilhado em memória, use `@Injectable({ singleton: true })`.
- Preserve os fluxos de autenticação, o SSE e as respostas especiais do Graph ao alterar a integração.
