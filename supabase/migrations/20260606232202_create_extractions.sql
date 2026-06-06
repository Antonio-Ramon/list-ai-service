-- Histórico de extrações do /extract + itens normalizados (1-N).
-- Auth: user_id nullable, sem policies por usuário ainda. Backend acessa via service role.

-- Uma linha por chamada ao /extract
create table public.extractions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- resultado
  raw_text        text,
  total_items     int not null default 0,

  -- telemetria (vem do extractContext)
  format          text not null default 'asterisk',
  elapsed_seconds numeric(6, 1),
  file_size_bytes int,
  input_tokens    int,
  output_tokens   int,

  -- multi-tenant / futuro: quem disparou
  user_id         uuid references auth.users (id) on delete set null
);

-- Itens de cada extração (1-N)
create table public.extraction_items (
  id            uuid primary key default gen_random_uuid(),
  extraction_id uuid not null references public.extractions (id) on delete cascade,
  position      int not null, -- preserva a ordem da lista retornada pela IA
  name          text not null,
  quantity      numeric(10, 3) not null,
  unit          text not null,
  price         numeric(10, 2) -- nullable: o campo é opcional no tipo Item
);

create index extraction_items_extraction_id_idx
  on public.extraction_items (extraction_id);

-- RLS ativo: nenhuma policy => só a service role (backend) acessa.
alter table public.extractions enable row level security;
alter table public.extraction_items enable row level security;
