---
title: PRD — ListAI
status: final
created: 2026-05-31
updated: 2026-05-31
---

## 1. Visão Geral

**ListAI** é uma API backend que recebe a foto de um cupom fiscal de supermercado brasileiro e devolve uma lista de compras formatada, pronta para colar em ferramentas como Google Keep, WhatsApp ou Notion.

O produto elimina o trabalho manual de recriar listas a partir de notas fiscais anteriores — uma tarefa repetitiva que famílias enfrentam todo mês.

---

## 2. Problema

Famílias que fazem compras mensais precisam recriar manualmente a lista de produtos a cada ciclo. O cupom fiscal contém as informações necessárias, mas seu formato — códigos de barras, preços, dados fiscais — dificulta extrair o que importa: nome do produto e quantidade.

**Consequência:** tempo perdido, erros de transcrição e listas incompletas mês após mês.

---

## 3. Usuários-Alvo

**Usuário primário:** Indivíduos ou responsáveis por compras de famílias brasileiras que fazem compras mensais em supermercados e querem reaproveitar a lista do mês anterior.

**Perfil:** Não-técnico. O acesso no MVP é via Postman, curl ou integração direta — o usuário final tira a foto e recebe a lista, sem nenhuma configuração.

---

## 4. Métricas de Sucesso

| Métrica | Alvo |
|---|---|
| Acurácia de extração (nome + quantidade) | ≥ 95% dos itens corretamente identificados |
| Tempo de resposta | < 10 segundos por requisição |
| Custo por chamada à API de IA | < US$ 0,02 por imagem processada |
| Output utilizável sem edição | Usuário consegue colar diretamente no destino final |

---

## 5. Requisitos Funcionais

### 5.1 Upload e Validação de Imagem

**FR-001** — O sistema deve aceitar upload de imagem via `multipart/form-data` no campo `image`.

**FR-002** — Formatos aceitos: JPEG, PNG e WEBP. Qualquer outro formato deve ser rejeitado com erro `INVALID_FILE_TYPE`.

**FR-003** — Tamanho máximo: 10 MB. Arquivos maiores devem ser rejeitados com erro `FILE_TOO_LARGE`.

**FR-004** — Respostas de erro devem retornar HTTP 400 com `success: false`, código de erro e mensagem orientativa em português.

### 5.2 Extração de Itens via IA

**FR-005** — O sistema deve enviar a imagem à API de visão computacional acompanhada de um prompt estruturado para extração dos itens do cupom.

**FR-006** — O prompt deve instruir o modelo a retornar exclusivamente um JSON válido — sem markdown, sem explicações adicionais.

**FR-007** — Para cada item do cupom, o sistema deve extrair:
- `name`: nome do produto em português, limpo e legível; resolução de abreviações delegada ao modelo
- `quantity`: quantidade numérica
- `unit`: unidade de medida (ex: `un`, `kg`, `L`, `Fr`, `Cx`, `PC`)

**FR-008** — Se nenhum item for identificado, o sistema deve retornar HTTP 422 com erro `NO_ITEMS_FOUND`.

**FR-009** — O sistema deve descartar itens cujo `name` tenha menos de 3 caracteres para eliminar entradas inválidas ou alucinadas pelo modelo.

**FR-010** — Em caso de falha na API de IA (timeout ou erro 5xx), o sistema deve realizar até 2 tentativas automáticas antes de retornar erro ao cliente.

### 5.3 Formatação do Output

**FR-011** — Respostas de sucesso devem seguir o contrato:

```json
{
  "success": true,
  "text": "* Feijão Vermelho 1kg   1un\n* Ovos Brancos C/30   2un\n...",
  "items": [
    { "name": "Feijão Vermelho 1kg", "quantity": 1, "unit": "un" },
    { "name": "Ovos Brancos C/30", "quantity": 2, "unit": "un" }
  ],
  "total_items": 57
}
```

**FR-012** — O endpoint deve aceitar o parâmetro opcional `format` (query string) para controlar o campo `text`:
- `asterisk` (padrão): `* {name}   {quantity}{unit}`
- `checklist`: `[ ] {name}   {quantity}{unit}`

Itens são separados por `\n` em ambos os formatos.

**FR-013** — O campo `items` deve conter o array estruturado independentemente do `format` escolhido.

### 5.4 Rate Limiting

**FR-014** — Requisições devem ser limitadas a 10 por minuto por IP. Excedentes retornam HTTP 429 com erro `RATE_LIMIT_EXCEEDED`.

### 5.5 Observabilidade

**FR-015** — O sistema deve emitir logs estruturados por requisição: timestamp, IP, tamanho do arquivo, tempo de processamento, total de itens extraídos e status da resposta.

**FR-016** — Falhas na integração com a API de IA devem ser logadas com código de erro, número da tentativa e latência.

---

## 6. Requisitos Não-Funcionais

### 6.1 Custo e Eficiência de Tokens *(crítico)*

**NFR-001** — O custo por requisição não deve ultrapassar US$ 0,02. O prompt deve ser conciso e sem redundâncias. O consumo de tokens deve ser monitorado ativamente via logs para identificar desvios.

**NFR-002** — O sistema não deve pré-processar ou redimensionar imagens por padrão; o limite de 10 MB é suficiente para controlar o volume de tokens de entrada.

### 6.2 Performance

**NFR-003** — O tempo total de resposta deve ser inferior a 10 segundos em condições normais de rede.

### 6.3 Segurança

**NFR-004** — A chave de API deve ser carregada exclusivamente via variável de ambiente `ANTHROPIC_API_KEY` — nunca hardcoded ou exposta em logs.

**NFR-005** — Imagens recebidas não devem ser persistidas em disco ou memória além do ciclo de vida da requisição.

### 6.4 Confiabilidade

**NFR-006** — O sistema deve tolerar falhas transitórias da API de IA com retry automático (máx. 2 tentativas), conforme FR-010.

### 6.5 Deploy

**NFR-007** — O serviço deve ser inicializável via `npm start` e deployável no Railway diretamente do repositório Git, sem necessidade de Dockerfile no MVP.

---

## 7. Contrato de API

### `POST /extract`

| Campo | Detalhe |
|---|---|
| Content-Type | `multipart/form-data` |
| Campo da imagem | `image` |
| Formatos aceitos | JPEG, PNG, WEBP |
| Tamanho máximo | 10 MB |
| Parâmetro opcional | `format=asterisk` (padrão) \| `format=checklist` |

**Tabela de respostas:**

| HTTP | Condição | Código de Erro |
|---|---|---|
| 200 | Itens extraídos com sucesso | — |
| 400 | Tipo de arquivo inválido | `INVALID_FILE_TYPE` |
| 400 | Arquivo excede o limite | `FILE_TOO_LARGE` |
| 400 | Nenhum arquivo enviado | `MISSING_FILE` |
| 422 | Nenhum item identificado no cupom | `NO_ITEMS_FOUND` |
| 429 | Rate limit excedido | `RATE_LIMIT_EXCEEDED` |
| 500 | Falha interna após retries | `INTERNAL_ERROR` |

---

## 8. Fora do Escopo (MVP)

- Interface web ou mobile
- Autenticação de usuários
- Persistência de histórico de listas
- Comparação de preços entre compras
- Integração direta com Google Keep, Notion ou similares
- Dockerfile e containerização

---

## 9. Variáveis de Ambiente

| Variável | Descrição | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | Chave de acesso à API de IA | obrigatório |
| `PORT` | Porta do servidor HTTP | `3000` |
| `MAX_FILE_SIZE_MB` | Tamanho máximo de upload em MB | `10` |
| `NODE_ENV` | Ambiente de execução | `development` |

---
