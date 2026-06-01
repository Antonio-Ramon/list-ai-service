# Project Brief — ListAI 🧾✨

> **BMAD Method Input Document**
> Status: `draft` | Type: `greenfield` | Owner: Antonio Ramon

---

## 1. Project Overview

**Application Name:** `ListAI`
**Tagline:** *"Da nota fiscal para a sua lista, em segundos."*

ListAI é uma aplicação backend que recebe a foto de um cupom fiscal de supermercado e retorna uma lista de compras formatada e pronta para colar em qualquer ferramenta (Google Keep, WhatsApp, Notion, etc.).

O problema central é simples: após cada compra mensal, o usuário precisa recriar manualmente a lista de produtos para a próxima compra. ListAI automatiza esse processo usando visão computacional via LLM.

---

## 2. Problem Statement

Famílias que fazem compras mensais no mercado frequentemente:

- Precisam recriar listas de compras manualmente a partir de cupons fiscais anteriores
- Perdem tempo relendo itens de uma nota fiscal longa e às vezes ilegível
- Têm dificuldade em extrair apenas o nome do produto e a quantidade, ignorando códigos de barras, preços e outras informações irrelevantes para a lista

**Solução:** Uma API que aceita uma imagem de cupom fiscal e devolve uma lista limpa, formatada e pronta para uso.

---

## 3. Goals & Success Metrics

| Goal | Métrica de Sucesso |
|---|---|
| Extrair corretamente os itens do cupom | ≥ 95% de acurácia nos nomes e quantidades |
| Resposta rápida | Tempo de resposta < 10s por imagem |
| Custo operacional baixo | < $0,02 por requisição |
| Output utilizável sem edição | Usuário consegue colar diretamente no Keep/WhatsApp |

---

## 4. Target Users

**Usuário primário:** Indivíduos ou famílias que fazem compras mensais em supermercados brasileiros e querem reutilizar a lista de compras de meses anteriores.

**Perfil técnico do usuário final:** Não-técnico. O usuário apenas tira uma foto e recebe a lista — sem configuração.

---

## 5. Scope

### In Scope (MVP)
- Endpoint `POST /extract` que aceita upload de imagem (JPEG/PNG/WEBP)
- Extração de nome do produto e quantidade via Claude Vision API
- Retorno da lista em dois formatos: `text` (para colar) e `json` (para integrações futuras)
- Validação básica de entrada (tipo de arquivo, tamanho máximo)
- Suporte a cupons fiscais brasileiros (layout padrão ECF/SAT/NFC-e)

### Out of Scope (MVP)
- Interface web/mobile (frontend)
- Autenticação de usuários
- Persistência de histórico de listas
- Comparação de preços entre compras
- Integração direta com Google Keep ou outros apps

### Futuro (pós-MVP)
- Frontend web (upload + visualização da lista)
- App mobile (câmera nativa)
- Histórico de compras com comparativo de preços
- Exportação para XLSX

---

## 6. Technical Architecture

### Stack

| Camada | Tecnologia | Justificativa |
|---|---|---|
| Runtime | Node.js 22 + TypeScript | Domínio do dev, tipagem forte |
| Framework | Fastify 5 | Leve, rápido, ideal para file upload |
| Upload | `@fastify/multipart` | Multipart nativo sem overhead |
| Vision / IA | Anthropic SDK (`claude-sonnet-4-6`) | Vision + extração semântica, sem OCR manual |
| Validação | Zod | Schema validation TypeScript-first |
| Testes | Vitest | Compatível com ESM, rápido |
| Linting | ESLint + Prettier | Padronização de código |

### Estrutura de Pastas Proposta

```
listai/
├── src/
│   ├── routes/
│   │   └── extract.route.ts       # POST /extract
│   ├── services/
│   │   └── vision.service.ts      # Integração com Anthropic SDK
│   ├── parsers/
│   │   └── receipt.parser.ts      # Formata JSON → texto de lista
│   ├── schemas/
│   │   └── extract.schema.ts      # Validação Zod
│   ├── utils/
│   │   └── image.utils.ts         # Base64 conversion, mime check
│   └── server.ts                  # Bootstrap do Fastify
├── test/
│   ├── routes/
│   │   └── extract.test.ts
│   └── fixtures/
│       └── receipt-sample.jpg     # Imagem de cupom para testes
├── .env.example
├── package.json
└── tsconfig.json
```

### Fluxo de Dados

```
[Cliente envia imagem via multipart]
          ↓
POST /extract
          ↓
image.utils.ts → valida tipo/tamanho → converte para base64
          ↓
vision.service.ts → monta payload Claude API (image + prompt)
          ↓
Claude Vision API → retorna JSON estruturado
          ↓
receipt.parser.ts → formata para texto e JSON
          ↓
Resposta HTTP 200
{
  "text": "* FEIJ VERM ANA T1 1kg   1un\n* OVO BCO GRANDE C/30  2un\n...",
  "items": [
    { "name": "Feijão Vermelho Ana T1 1kg", "quantity": 1, "unit": "un" },
    ...
  ]
}
```

---

## 7. AI Integration Details

### Modelo
`claude-sonnet-4-20250514` (ou string atualizada do Sonnet 4.6)

### Prompt Strategy

```
System:
Você é um extrator especializado em cupons fiscais brasileiros.
Sua tarefa é identificar cada produto listado no cupom e retornar
APENAS um JSON válido, sem markdown, sem explicações.

User:
[imagem do cupom]

Extraia todos os produtos desta nota fiscal. Para cada item retorne:
- name: nome do produto em português, limpo e legível (sem códigos de barras)
- quantity: quantidade numérica
- unit: unidade de medida (un, kg, L, Fr, Cx, PC, etc.)

Responda APENAS com o seguinte formato JSON:
{
  "items": [
    { "name": "string", "quantity": number, "unit": "string" }
  ]
}
```

### Estimativa de Custo por Chamada

| Token type | Estimativa | Custo (USD) |
|---|---|---|
| Input (imagem + prompt) | ~1.800 tokens | ~$0,0054 |
| Output (JSON ~60 itens) | ~600 tokens | ~$0,0090 |
| **Total** | **~2.400 tokens** | **~$0,014** |

---

## 8. API Contract

### `POST /extract`

**Request:**
```
Content-Type: multipart/form-data
Body: image (file) — JPEG, PNG, WEBP — max 10MB
```

**Response 200:**
```json
{
  "success": true,
  "text": "* Detergente Limpol 5L Neutro   1un\n* Água Sanitária Brilux 1L   1un\n...",
  "items": [
    { "name": "Detergente Limpol 5L Neutro", "quantity": 1, "unit": "un" },
    { "name": "Água Sanitária Brilux 1L", "quantity": 1, "unit": "un" }
  ],
  "total_items": 57
}
```

**Response 400:**
```json
{
  "success": false,
  "error": "INVALID_FILE_TYPE",
  "message": "Apenas imagens JPEG, PNG ou WEBP são aceitas."
}
```

**Response 422:**
```json
{
  "success": false,
  "error": "NO_ITEMS_FOUND",
  "message": "Não foi possível identificar itens no cupom enviado."
}
```

---

## 9. Environment Variables

```env
# .env.example
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
MAX_FILE_SIZE_MB=10
NODE_ENV=development
```

---

## 10. Non-Functional Requirements

| Requisito | Detalhe |
|---|---|
| Segurança | API Key via env, nunca exposta no código |
| Resiliência | Retry automático em falhas da API Anthropic (max 2x) |
| Observabilidade | Logs estruturados (pino, já built-in no Fastify) |
| Portabilidade | Docker-ready (Dockerfile no escopo do MVP) |
| Limites | Rate limit básico: 10 req/min por IP |

---

## 11. Risks & Mitigations

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Foto com baixa qualidade/desfocada | Média | Retornar erro claro com orientação ao usuário |
| Cupom com layout incomum | Baixa | Prompt robusto com exemplos de variações brasileiras |
| Alucinação de produtos inexistentes | Baixa | Validar que os nomes extraídos têm mínimo de 3 chars |
| Custo inesperado na API | Baixa | Rate limit + alerta de billing no Anthropic Console |

---

## 12. Hosting & Deployment Strategy

### Plataforma Recomendada: Railway

**Railway** é a escolha para o MVP por ser a opção com melhor custo-benefício para um backend Node.js/Fastify com upload de imagem.

| Critério | Detalhe |
|---|---|
| Free tier | $5 de crédito/mês — suficiente para uso pessoal/familiar |
| Deploy | Direto do repositório Git (suporta Azure DevOps) |
| Uptime | Serviço permanece up, sem sleep automático |
| Config | Variáveis de ambiente via painel (ideal para `ANTHROPIC_API_KEY`) |
| Logs | Tempo real, sem configuração extra |
| URL | Subdomínio `.railway.app` gratuito com HTTPS |

### Comparativo de Opções Avaliadas

| Plataforma | Free Tier | Sleep em Inatividade | Deploy via Git | Custo Estimado/mês |
|---|---|---|---|---|
| **Railway** ✅ | $5 crédito/mês | Não (fica up) | ✅ | ~$0 (uso leve) |
| Render | 750h/mês | ✅ Sim (após 15min) | ✅ | ~$0 / $7 sem sleep |
| Fly.io | 3 VMs pequenas | Configurável | ✅ via CLI | ~$0 |
| Vercel | Generoso | Serverless | ✅ | ⚠️ Limitado (ver abaixo) |
| Azure App Service | F1 (fraco) | ✅ Sim | ✅ via DevOps | ~$0 / $13+ |

### ⚠️ Por que Vercel não é indicado para este projeto

O free tier da Vercel impõe **timeout de 10 segundos** em funções serverless. Como o processamento de imagem pelo Claude pode levar 5–10s dependendo do tamanho e qualidade da foto, o risco de timeout é alto. Só seria viável no plano Pro ($20/mês).

### ☁️ Azure: quando faz sentido

O Azure App Service free (F1) é muito limitado (60 min CPU/dia, sem SSL próprio). O plano B1 viável custa ~$13/mês — caro para uso pessoal quando o Railway entrega o equivalente gratuitamente. O Azure passa a fazer sentido se o ListAI crescer e precisar de integração com infraestrutura corporativa já existente no ambiente do dev.

### Estratégia de Evolução de Hospedagem

```
MVP / uso pessoal   →   Railway (free tier)
Crescimento         →   Railway pago (~$5–20/mês) ou Render
Produto corporativo →   Azure App Service + pipeline Azure DevOps
```

### Arquivos de Deploy Necessários (In Scope do MVP)

- `Dockerfile` — imagem Node.js 22 Alpine
- `railway.toml` — configuração de build e start command
- `.env.example` — template de variáveis de ambiente

---

## 13. Open Questions

- [ ] O output precisa de um formato de checklist (`[ ] PRODUTO`) além do formato com asterisco?
- [ ] Deve haver alguma limpeza/padronização nos nomes (ex: expandir abreviações como `FEIJ` → `Feijão`)?
- [ ] O MVP precisa de Docker ou apenas de instruções de `npm start`?
- [ ] Haverá alguma interface mínima para upload, ou é 100% API para uso via Postman/curl inicialmente?
- [ ] Confirmar uso do Railway como plataforma de hospedagem do MVP?

---

## 14. Name Rationale

**`ListAI`** foi escolhido por ser:
- Curto e memorável
- Descritivo sem ser genérico
- Fácil de pronunciar em PT-BR e EN
- Domínio `.ai` disponível na maioria dos registradores
- Extensível para versões futuras (`ListAI Pro`, `ListAI Family`)

**Alternativas consideradas:**

| Nome | Conceito | Por que não foi o escolhido |
|---|---|---|
| `NotaLista` | Nota Fiscal → Lista | Muito literal, sem apelo |
| `MercadoScan` | Scanner de mercado | Muito genérico |
| `CupomAI` | Cupom + IA | Cupom tem conotação de desconto no BR |
| `FotoLista` | Foto → Lista | Simples mas sem personalidade |
| **`ListAI`** ✅ | Lista + AI | Direto, moderno, escalável |

---

*Documento gerado em: 31/05/2026 | Atualizado em: 31/05/2026*
*Próximo passo: BMAD Architect Agent → gerar tasks de implementação + arquivos de deploy (Dockerfile, railway.toml)*
