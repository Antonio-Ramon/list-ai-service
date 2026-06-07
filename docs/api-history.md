# API — `GET /history`

Retorna o histórico de extrações (mais recentes primeiro), com os itens de cada uma embutidos e paginação.

## Endpoint

```
GET /history?limit=20&offset=0
```

Base URL (produção): `https://list-ai-service-production.up.railway.app`

## Query params

| Param    | Tipo | Default | Limites      | Descrição                          |
|----------|------|---------|--------------|------------------------------------|
| `limit`  | int  | `20`    | 1 – 100      | Quantos registros retornar         |
| `offset` | int  | `0`     | ≥ 0          | Quantos pular (paginação)          |

> Valores fora dos limites retornam **400** (validação automática).

## Resposta `200`

```json
{
  "success": true,
  "count": 20,
  "total": 137,
  "limit": 20,
  "offset": 0,
  "history": [
    {
      "id": "uuid",
      "created_at": "2026-06-06T23:22:02.000Z",
      "raw_text": "lista formatada retornada na extração",
      "total_items": 3,
      "format": "asterisk",
      "elapsed_seconds": 4.2,
      "file_size_bytes": 123456,
      "input_tokens": 1500,
      "output_tokens": 320,
      "user_id": null,
      "extraction_items": [
        { "id": "uuid", "position": 0, "name": "Arroz", "quantity": 1, "unit": "kg", "price": 5.99 },
        { "id": "uuid", "position": 1, "name": "Feijão", "quantity": 2, "unit": "pct", "price": null }
      ]
    }
  ]
}
```

### Campos da resposta

| Campo     | Descrição                                              |
|-----------|--------------------------------------------------------|
| `count`   | Registros **nesta página** (`history.length`)          |
| `total`   | Total de extrações na tabela (ignora paginação)        |
| `limit`   | Limite aplicado                                        |
| `offset`  | Offset aplicado                                        |
| `history` | Array de extrações, ordenado por `created_at desc`     |

`extraction_items` vem ordenado por `position` (mesma ordem da extração). `price` é `null` quando não foi identificado.

## Paginação no frontend

```
totalPaginas  = Math.ceil(total / limit)
paginaAtual   = offset / limit + 1
offsetDaPagina(p) = (p - 1) * limit
```

- **Infinite scroll**: incremente `offset += limit` até `history.length < limit` ou `offset >= total`.
- **Páginas numeradas**: use `total` para montar os botões.

## Exemplo (fetch)

```ts
async function fetchHistory(limit = 20, offset = 0) {
  const res = await fetch(`${BASE_URL}/history?limit=${limit}&offset=${offset}`);
  if (!res.ok) throw new Error(`history failed: ${res.status}`);
  return res.json();
}
```

## Erros

| Status | Body                                                         | Quando                       |
|--------|-------------------------------------------------------------|------------------------------|
| `400`  | `{ success:false, error, message }`                          | `limit`/`offset` inválidos   |
| `500`  | `{ success:false, error:"PERSISTENCE_ERROR", message }`      | Falha ao consultar o banco   |

---

# API — `DELETE /history/:id`

Deleta uma extração pelo `id`. Os itens associados são removidos automaticamente (cascade).

## Endpoint

```
DELETE /history/:id
```

`:id` deve ser um UUID válido.

## Resposta `200`

```json
{
  "success": true,
  "id": "123e4567-e89b-12d3-a456-426614174000"
}
```

## Exemplo (fetch)

```ts
async function deleteExtraction(id: string) {
  const res = await fetch(`${BASE_URL}/history/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
  return res.json();
}
```

## Erros

| Status | Body                                                    | Quando                         |
|--------|--------------------------------------------------------|--------------------------------|
| `400`  | `{ success:false, error, message }`                     | `id` não é um UUID válido      |
| `404`  | `{ success:false, error:"NOT_FOUND", message }`         | Não existe extração com esse id|
| `500`  | `{ success:false, error:"PERSISTENCE_ERROR", message }` | Falha ao deletar no banco      |
