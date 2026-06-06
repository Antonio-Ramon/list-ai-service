-- Grava uma extração e seus itens numa única transação (atômico).
-- Retorna o id da extração criada. p_items é o array de Item em JSON.

create function public.save_extraction (
  p_raw_text text,
  p_format text,
  p_elapsed_seconds numeric,
  p_file_size_bytes int,
  p_input_tokens int,
  p_output_tokens int,
  p_items jsonb
) returns uuid
language plpgsql
as $$
declare
  v_extraction_id uuid;
begin
  insert into public.extractions (
    raw_text, total_items, format,
    elapsed_seconds, file_size_bytes, input_tokens, output_tokens
  )
  values (
    p_raw_text, jsonb_array_length(p_items), p_format,
    p_elapsed_seconds, p_file_size_bytes, p_input_tokens, p_output_tokens
  )
  returning id into v_extraction_id;

  insert into public.extraction_items (extraction_id, position, name, quantity, unit, price)
  select
    v_extraction_id,
    (item.ordinality - 1)::int,
    item.value ->> 'name',
    (item.value ->> 'quantity')::numeric,
    item.value ->> 'unit',
    nullif(item.value ->> 'price', '')::numeric
  from jsonb_array_elements(p_items) with ordinality as item (value, ordinality);

  return v_extraction_id;
end;
$$;
