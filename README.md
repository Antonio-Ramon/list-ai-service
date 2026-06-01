# list-ai-service

API REST para extração inteligente de itens de recibos e notas fiscais utilizando IA (Claude da Anthropic).

## O que faz

Recebe a imagem de um recibo via upload, envia para o modelo Claude e retorna a lista de itens extraídos em formato JSON estruturado — nome, quantidade, unidade e total de itens.

## Stack

- **Runtime:** Node.js 24 LTS
- **Framework:** Fastify 5
- **IA:** Anthropic Claude API (`@anthropic-ai/sdk`)
- **Linguagem:** TypeScript (strict mode, CommonJS)
- **Deploy:** Railway

## Pré-requisitos

- Node.js >= 24
- Chave de API da Anthropic (`ANTHROPIC_API_KEY`)

## Instalação

```bash
npm install
```

## Configuração

Crie um arquivo `.env` na raiz do projeto (use `.env.example` como base):

```bash
cp .env.example .env
```

Preencha as variáveis:

```env
ANTHROPIC_API_KEY=sua-chave-aqui
PORT=3000
MAX_FILE_SIZE_MB=10
NODE_ENV=development
```

## Uso

```bash
# Desenvolvimento (hot reload)
npm run dev

# Build de produção
npm run build

# Iniciar servidor compilado
npm start
```

O servidor sobe em `http://localhost:3000`.  
Documentação interativa (Swagger UI): `http://localhost:3000/documentation`

## Endpoint principal

```
POST /extract
Content-Type: multipart/form-data

file: <imagem do recibo>
```

**Resposta (sucesso):**
```json
{
  "success": true,
  "text": "texto extraído do recibo",
  "items": [
    { "name": "Arroz", "quantity": 2, "unit": "kg" }
  ],
  "total_items": 1
}
```

**Resposta (erro):**
```json
{
  "success": false,
  "error": "FILE_TOO_LARGE",
  "message": "Arquivo excede o tamanho máximo permitido"
}
```

## Limites

- Tamanho máximo de arquivo: 10 MB (configurável via `MAX_FILE_SIZE_MB`)
- Rate limit: 10 requisições por minuto por IP

## CI/CD

- **GitHub Actions:** valida build TypeScript em todo push e PR (Node.js 24)
- **Railway:** deploy automático no push para `main`

## Estrutura do projeto

```
src/
  index.ts          # Servidor Fastify (entry point)
  config.ts         # Configuração via variáveis de ambiente
  errors.ts         # Construtores de erro tipados
  types/
    index.ts        # Contratos de tipos da API
  routes/
    extract.ts      # Rota POST /extract
```
