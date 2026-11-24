alter table public.shopping_transactions add column checkout_attempt_id uuid;

-- Serialize confirmations for the same list. RLS remains in force for every write.
create function public.finalize_shopping_checkout(
  checkout_attempt uuid, target_household uuid, target_list uuid, target_cycle integer, writes jsonb
) returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  list_row public.shopping_lists;
  existing public.shopping_transactions;
  entry jsonb;
  head jsonb;
  body jsonb;
  table_name text;
  row_key text;
  operation text;
  columns_sql text;
  values_sql text;
  update_sql text;
  affected integer;
  list_advanced boolean := false;
begin
  if checkout_attempt is null or target_cycle is null or not coalesce(public.is_member(target_household), false) then
    raise exception 'Checkout is not available' using errcode = '42501';
  end if;

  select * into list_row from public.shopping_lists
  where id = target_list and household_id = target_household for update;
  if not found then
    raise exception 'Checkout list is not available' using errcode = '42501';
  end if;

  select * into existing from public.shopping_transactions
  where list_id = target_list and list_cycle = target_cycle and household_id = target_household;
  if found then
    return coalesce(existing.checkout_attempt_id = checkout_attempt, false);
  end if;

  if list_row.deleted_at is not null or list_row.archived_at is not null or list_row.cycle <> target_cycle then
    raise exception 'Checkout cycle is no longer active' using errcode = '22023';
  end if;
  if jsonb_typeof(writes) is distinct from 'array' or jsonb_array_length(writes) = 0 then
    raise exception 'Missing checkout writes' using errcode = '22023';
  end if;
  head := writes->0->'payload';
  if writes->0->>'table' is distinct from 'shopping_transactions'
     or writes->0->>'op' is distinct from 'insert'
     or (head->>'list_id')::uuid is distinct from target_list
     or (head->>'list_cycle')::integer is distinct from target_cycle
     or head->>'completed_at' is null then
    raise exception 'Invalid checkout header' using errcode = '22023';
  end if;

  for entry in select value from jsonb_array_elements(writes) loop
    table_name := entry->>'table';
    row_key := entry->>'row_id';
    operation := entry->>'op';
    body := entry->'payload';
    if table_name is null or table_name not in (
      'shopping_transactions', 'shopping_transaction_items', 'shopping_lists',
      'shopping_list_items', 'products', 'product_prices', 'pantry_items'
    ) or row_key is null or operation is null or operation not in ('insert', 'update')
      or jsonb_typeof(body) is distinct from 'object' or body = '{}'::jsonb
      or body ?| array['created_at', 'updated_at', 'checkout_attempt_id'] then
      raise exception 'Invalid checkout write' using errcode = '22023';
    end if;

    if table_name = 'shopping_transactions' then
      if entry is distinct from writes->0 or body->>'id' is distinct from row_key then
        raise exception 'Only the checkout transaction can be recorded' using errcode = '22023';
      end if;
      body := body || jsonb_build_object('checkout_attempt_id', checkout_attempt);
    elsif table_name = 'shopping_lists' then
      if operation <> 'update' or row_key <> target_list::text or list_advanced
         or (body->>'cycle')::integer is distinct from target_cycle + 1 then
        raise exception 'Invalid checkout list update' using errcode = '22023';
      end if;
      list_advanced := true;
    elsif table_name = 'shopping_list_items' then
      if operation <> 'update' or not exists (
        select 1 from public.shopping_list_items
        where id = row_key::uuid and list_id = target_list and household_id = target_household
      ) then
        raise exception 'Checkout item does not belong to the list' using errcode = '22023';
      end if;
    elsif table_name = 'shopping_transaction_items' then
      if operation <> 'insert' or body->>'transaction_id' is distinct from head->>'id' or not exists (
        select 1 from public.shopping_list_items
        where id = (body->>'list_item_id')::uuid and list_id = target_list and household_id = target_household
      ) then
        raise exception 'Invalid checkout transaction item' using errcode = '22023';
      end if;
    end if;

    if operation = 'insert' then
      if body->>'id' is distinct from row_key or (body->>'household_id')::uuid is distinct from target_household then
        raise exception 'Invalid checkout row owner' using errcode = '22023';
      end if;
    elsif body ?| array['id', 'household_id', 'list_id'] then
      raise exception 'Checkout cannot relocate a row' using errcode = '22023';
    end if;

    select string_agg(format('%I', key), ', ' order by key),
           string_agg(format('v.%I', key), ', ' order by key),
           string_agg(format('%I = excluded.%I', key, key), ', ' order by key)
             filter (where key not in ('id', 'household_id'))
      into columns_sql, values_sql, update_sql
    from jsonb_object_keys(body) as keys(key);

    if operation = 'insert' then
      execute format(
        'insert into public.%1$I as t (%2$s)
         select %3$s from jsonb_populate_record(null::public.%1$I, $1) v
         %4$s',
        table_name, columns_sql, values_sql,
        case when table_name = 'shopping_transactions' then ''
             else format('on conflict (id) do update set %s where t.household_id = $2', update_sql) end
      ) using body, target_household;
    else
      execute format(
        'update public.%1$I t set (%2$s) = (select %3$s from jsonb_populate_record(null::public.%1$I, $1) v)
         where t.id = (jsonb_populate_record(null::public.%1$I, jsonb_build_object(''id'', $2))).id
         and t.household_id = $3',
        table_name, columns_sql, values_sql
      ) using body, row_key, target_household;
    end if;
    get diagnostics affected = row_count;
    if affected <> 1 then
      raise exception 'Checkout row is not available' using errcode = '22023';
    end if;
  end loop;
  if not list_advanced then
    raise exception 'Checkout did not advance the list' using errcode = '22023';
  end if;
  return true;
end;
$$;

revoke all on function public.finalize_shopping_checkout(uuid, uuid, uuid, integer, jsonb) from public, anon;
grant execute on function public.finalize_shopping_checkout(uuid, uuid, uuid, integer, jsonb) to authenticated;
