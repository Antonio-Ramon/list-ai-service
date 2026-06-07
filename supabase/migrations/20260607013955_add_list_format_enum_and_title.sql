-- Enum para o tipo de lista + coluna title (default = nome do arquivo, preenchida na extração).

create type list_format as enum ('asterisk', 'checklist', 'simple', 'excel');

alter table public.extractions
  alter column format drop default;

alter table public.extractions
  alter column format type list_format using format::list_format;

alter table public.extractions
  alter column format set default 'asterisk'::list_format;

alter table public.extractions
  add column title text;

-- Filtro por nome (title) usa ilike; índice para busca case-insensitive.
create index extractions_title_idx on public.extractions (lower(title));
