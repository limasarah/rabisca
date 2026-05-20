# Rabisca — Desenho colaborativo seguro para crianças

Rabisca é um MVP de aplicativo web para desenho colaborativo em tempo real, pensado para crianças e famílias. Suporta salas privadas, desenho em tempo real com baixa latência, modos de jogo (adivinhar tema, histórias em sequência) e um chat rápido com mensagens seguras.

![Screenshot placeholder](docs/screenshot-1.png)

## Funcionalidades
- Salas privadas com código simples
- Desenho em tempo real (canvas) com batching para reduzir uso de rede
- Modos: `free` (livre), `guess` (desenho + adivinhação) e `story` (telefone sem-fio)
- Mensagens rápidas seguras (quick safe chat)
- Rate-limiting por socket para evitar spam
- Opção de persistência em Redis e suporte a adapter Socket.io para múltiplos nós

## Stack
- Backend: Node.js, Express, Socket.io, Redis (opcional)
- Frontend: HTML5, CSS, Vanilla JavaScript

## Estrutura do repositório

- `frontend/` — arquivos estáticos do cliente (index.html, app.js, style.css)
- `backend/` — servidor Node.js, Socket.io e utilitários
- `backend/src/services/roomStore.js` — implementação do armazenamento de salas (em memória + Redis)

## Instalação (desenvolvimento)

Requisitos: Node.js (>=18), npm. Docker é opcional.

1. Clone o repositório

```bash
git clone <repo-url>
cd rabisca
```

2. Instale dependências do backend

```bash
cd backend
npm install
```

3. (Opcional) Instale dependências do frontend para conveniência

```bash
cd ../frontend
npm install
```

4. Configure variáveis de ambiente

Copie `.env.example` para `.env` e ajuste conforme necessário.

```bash
cp .env.example .env
# editar .env
```

5. Executar em modo de desenvolvimento

```bash
# no diretório raiz
npm run dev:backend
# em outra aba (opcional)
npm run start:frontend
```

Abra o frontend em `http://localhost:3000` e o backend em `http://localhost:4000`.

## Scripts npm principais

- `npm run start:backend` — inicia o backend (produção)
- `npm run dev:backend` — inicia backend com `nodemon` (desenvolvimento)
- `npm run start:frontend` — serve o diretório `frontend` localmente (usar `npx serve`)

## Deploy

Recomendações de deploy profissional:

- Frontend: Vercel (ou qualquer hospedagem estática)
  - Configure a pasta de publicação como `/frontend`.
- Backend: Render (ou qualquer serviço Node)
  - Variáveis de ambiente: `PORT`, `REDIS_URL`, `DISABLE_REDIS`, `CLIENT_URL`.
  - Defina o comando de start como `npm run start` dentro de `backend/`.
  - Ative health checks para `/health`.

### Vercel (frontend)

- O frontend é estatico; a pasta de publicação deve ser `frontend`.
- Adicione a variavel de ambiente `BACKEND_URL` no painel do Vercel apontando para a URL do backend (ex: `https://your-backend.onrender.com`).
- Para injetar a URL no cliente, no build do Vercel adicione um passo que define a variavel global `window.__BACKEND_URL__` — ex.: no `vercel.json` ou em um script de build gere um pequeno arquivo `frontend/env.js` com:

```js
window.__BACKEND_URL__ = "https://your-backend.onrender.com";
```

Inclua esse arquivo no `index.html` antes de `app.js`.

### Render (backend)

- Crie um serviço Web no Render usando o repositório. Escolha `Node` (ou `Docker` se preferir usar `backend/Dockerfile`).
- Comando de start (Node): `npm install && npm run start` na pasta `backend`.
- Variáveis de ambiente recomendadas:
  - `PORT`=4000
  - `REDIS_URL`=redis://your-redis:6379 (ou `DISABLE_REDIS=1` para desabilitar)
  - `CLIENT_URL`=https://your-frontend.vercel.app

### Docker / docker-compose (teste local)

Use o `docker-compose.yml` incluído para levantar um ambiente com `redis` + `backend`:

```bash
docker-compose up --build
```

Isso expõe o backend em `http://localhost:4000` e o Redis em `localhost:6379`.

### Socket.io e CORS

O backend lê `CLIENT_URL` no `.env` para configurar CORS e o origin do Socket.io. Configure o frontend para conectar ao backend (ex: `const socket = io('https://your-backend.onrender.com')`) quando frontend e backend estiverem em domínios diferentes.

## Variáveis de ambiente importantes

- `PORT` — porta do backend (ex: 4000)
- `REDIS_URL` — URL do Redis para adapter (ex: `redis://127.0.0.1:6379`) ou `DISABLE` para desabilitar
- `DISABLE_REDIS` — `1` para desabilitar Redis
- `CLIENT_URL` — URL do frontend para CORS (ex: `https://your-app.vercel.app`)
- `RATE_LIMIT_PER_SEC` — limite de eventos por socket

## MVP Final — produção rápida

Siga estes passos para rodar uma versão MVP estável e pronta para testes reais.

- Build do frontend e start do backend (local, sem Redis):

```bash
# na raiz do projeto
npm ci
npm run build
DISABLE_REDIS=1 PORT=4000 NODE_ENV=production npm run start:prod
```

- Docker (frontend):

```bash
# build do container frontend
docker build -t rabisca-frontend:latest -f frontend/Dockerfile frontend
# rodar
docker run -p 8080:80 rabisca-frontend:latest
```

- Observabilidade mínima:
  - Verifique `GET /health` do backend para checar disponibilidade.
  - Logs do backend são impressos no stdout; para produção, roteie para provider de logs.

## Checklist para testes com usuários reais

- Defina `CLIENT_URL` apontando para a URL pública do frontend (Vercel/NGINX) e configure CORS.
- Se planeja multi-node ou alta carga, forneça `REDIS_URL` apontando a instância Redis e remova `DISABLE_REDIS`.
- Configure segredos no GitHub: `VERCEL_TOKEN`, `RENDER_API_KEY`, `RENDER_SERVICE_ID` para CI/deploy manual.


## Roadmap

- Refatorar para monorepo com workspaces (pnpm/yarn)
- Adicionar lint (ESLint), formatação (Prettier) e CI (GitHub Actions)
- Containerização com Docker + docker-compose para testes locais (backend + Redis)
- Métricas e observabilidade (Prometheus/StatsD)
- Autenticação leve (opcional) com controle parental

## Contribuição

Abra issues ou PRs. Mantenha commits pequenos e descritivos.

## Licença

MIT
# Rabisca

Rabisca é um protótipo de aplicativo colaborativo de desenho infantil inspirado em Gartic e Paint, com foco em segurança, privacidade e uso familiar.

## Arquitetura

- `backend/`: servidor Node.js com Socket.io e lógica de salas temporárias.
- `mvp-web/`: versão web inicial com HTML5 Canvas para validar desenho em tempo real.
- `flutter_app/`: esqueleto do aplicativo mobile multiplataforma com Flutter.

## Funcionalidades Principais

- Salas privadas criadas com código único.
- Entrada apenas por apelido.
- Comunicação em tempo real via Socket.io.
- Canvas colaborativo com desenho e apagador.
- Chat seguro baseado em mensagens rápidas predefinidas.
- Salas temporárias removidas após inatividade.

## Rodar o MVP Web

1. Instalar dependências:
   ```bash
   cd backend
   npm install
   ```
2. Iniciar o servidor:
   ```bash
   npm start
   ```
3. Abrir no navegador:
   - http://localhost:4000

## Estrutura de Pastas

- `backend/`
  - `server.js`: servidor HTTP + Socket.io.
  - `roomStore.js`: gerenciamento de salas temporárias.
  - `package.json`: dependências do Node.js.

- `mvp-web/`
  - `index.html`: interface do MVP.
  - `style.css`: estilo infantil e responsivo.
  - `app.js`: lógica de desenho, sala e Socket.io.

- `flutter_app/`
  - `pubspec.yaml`: dependências Flutter.
  - `lib/main.dart`: início do app e navegação.
  - `lib/screens/`: telas de entrada e sala.
  - `lib/widgets/`: canvas e interface de desenho.
  - `lib/models/`: modelos de sala e estado.

## Deploy sugerido

- Backend:
  - Vercel (Serverless / Node), Render, Railway, Heroku ou VPS.
  - Usar HTTPS e `PORT` dinâmico.
- Frontend Web:
  - Hospedar como site estático em Netlify, Vercel ou GitHub Pages.
  - Servir o MVP via backend ou CDN.
- Node.js + Redis:
  - Quando estiver pronto, conectar Redis para sessões temporárias e alta velocidade.
  - Use `REDIS_URL` para apontar ao servidor Redis.
  - Use `REDIS_TTL_SECONDS` para manter salas temporárias apenas enquanto ativas.

## Publicação para Play Store e App Store

1. Desenvolver o app completo em Flutter com testes de usabilidade.
2. Criar ícone infantil e capturas de tela coloridas.
3. Configurar `app.json` / `AndroidManifest` / `Info.plist` com políticas de privacidade.
4. Usar `flutter build apk` e `flutter build ios`.
5. Fornecer descrição focada em segurança familiar, sem login ou dados pessoais.
6. Testar em dispositivos reais e usar contas de testes da Apple.

> Nota: no app Flutter, o backend local usa `http://10.0.2.2:4000` para emuladores Android e `http://localhost:4000` para iOS/web.

## Estratégias de Escalabilidade Futura

- Separar `backend` e `frontend` por serviços.
- Usar Redis para estado de salas e TTL automático.
- Usar balanceador de carga e namespaces Socket.io.
- Adicionar servidor de mídia se necessário para voz ou vídeo familiar.
- Implementar auditoria de mensagens e filtros adicionais.
- Criar versões de sala por famílias, com QR Code para compartilhamento privado.
