-- Replit PostgreSQL invariants for immutable records and transactional booking confirmation.

-- Immutable financial / audit records
create or replace function public.prevent_mutation()
returns trigger language plpgsql as $$
begin
  raise exception '% records are immutable; create a reversing record instead', tg_table_name;
end;
$$;

create trigger ledger_journals_immutable before update or delete on ledger_journals
for each row execute function public.prevent_mutation();
create trigger ledger_entries_immutable before update or delete on ledger_entries
for each row execute function public.prevent_mutation();
create trigger payment_events_immutable before update or delete on payment_events
for each row execute function public.prevent_mutation();
create trigger audit_logs_immutable before update or delete on audit_logs
for each row execute function public.prevent_mutation();

create or replace function public.confirm_paid_booking(
  target_booking_id uuid,
  target_payment_id uuid,
  provider_event_id text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  current_status booking_status;
  current_hold_id uuid;
  hold_expiry timestamptz;
  item record;
begin
  if provider_event_id is null or length(provider_event_id) < 3 then
    raise exception 'A stable provider event ID is required';
  end if;

  select b.status, b.hold_id into current_status, current_hold_id
  from bookings b where b.id = target_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if current_status = 'CONFIRMED' then return; end if;
  if current_status <> 'PAYMENT_PROCESSING' then
    raise exception 'Booking is not awaiting verified payment';
  end if;

  perform 1 from payments p
  where p.id = target_payment_id and p.booking_id = target_booking_id and p.status = 'SUCCEEDED'
  for update;
  if not found then raise exception 'Payment has not been verified'; end if;
  if current_hold_id is null then raise exception 'Booking has no inventory hold'; end if;

  select expires_at into hold_expiry from inventory_holds
  where id = current_hold_id and status = 'ACTIVE' for update;
  if not found or hold_expiry <= now() then raise exception 'Inventory hold has expired'; end if;

  for item in
    select hi.pool_id, hi.inventory_date, hi.quantity
    from inventory_hold_items hi
    where hi.hold_id = current_hold_id
    order by hi.pool_id, hi.inventory_date
  loop
    perform 1 from unit_inventory_days d
    where d.pool_id = item.pool_id and d.inventory_date = item.inventory_date
      and not d.closed and d.held >= item.quantity
      and d.sold + item.quantity <= d.capacity
    for update;
    if not found then raise exception 'Inventory is no longer available for %', item.inventory_date; end if;

    update unit_inventory_days
    set held = held - item.quantity,
        sold = sold + item.quantity,
        version = version + 1,
        updated_at = now()
    where pool_id = item.pool_id and inventory_date = item.inventory_date;
  end loop;

  update inventory_holds set status = 'CONVERTED' where id = current_hold_id;
  update bookings set status = 'CONFIRMED', payment_status = 'SUCCEEDED', version = version + 1, updated_at = now()
  where id = target_booking_id;
  insert into booking_status_history (booking_id, from_status, to_status, reason)
  values (target_booking_id, 'PAYMENT_PROCESSING', 'CONFIRMED', 'Verified provider callback ' || provider_event_id);
  insert into outbox_events (queue_name, event_type, aggregate_type, aggregate_id, payload)
  values ('notifications', 'BOOKING_CONFIRMED', 'booking', target_booking_id, jsonb_build_object('bookingId', target_booking_id));
end;
$$;

revoke all on function public.confirm_paid_booking(uuid, uuid, text) from public;
