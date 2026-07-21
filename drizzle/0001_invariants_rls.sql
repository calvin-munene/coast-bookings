-- Coast Bookings database invariants and Supabase row-level security.
-- This migration intentionally keeps financial/audit records append-only and
-- performs booking confirmation under row locks inside PostgreSQL.

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

alter table profiles
  add constraint profiles_auth_user_fk foreign key (id) references auth.users(id) on delete cascade;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into profiles (id, email, full_name)
  values (new.id, new.email, coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(new.email, '@', 1)));

  insert into user_roles (user_id, role_id)
  select new.id, r.id from roles r where r.code = 'GUEST'
  on conflict do nothing;
  if new.raw_user_meta_data->>'account_type' = 'host' then
    insert into user_roles (user_id, role_id)
    select new.id, r.id from roles r where r.code = 'HOST'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.has_role(required_role text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid() and r.code = required_role
  );
$$;

revoke all on function public.has_role(text) from public;
grant execute on function public.has_role(text) to authenticated;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from user_roles ur
    join roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.code in (
        'SUPER_ADMIN','OPERATIONS_MANAGER','RESERVATIONS_OFFICER',
        'HOST_VERIFICATION_OFFICER','FINANCE_OFFICER','CUSTOMER_SUPPORT_OFFICER',
        'CONTENT_MODERATOR','READ_ONLY_AUDITOR'
      )
  );
$$;

revoke all on function public.is_staff() from public;
grant execute on function public.is_staff() to authenticated;

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

revoke all on function public.confirm_paid_booking(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_paid_booking(uuid, uuid, text) to service_role;

-- All browser-accessible data is denied until a policy grants the exact access.
alter table profiles enable row level security;
alter table roles enable row level security;
alter table user_roles enable row level security;
alter table host_profiles enable row level security;
alter table host_documents enable row level security;
alter table properties enable row level security;
alter table property_staff enable row level security;
alter table property_documents enable row level security;
alter table property_images enable row level security;
alter table amenities enable row level security;
alter table property_amenities enable row level security;
alter table units enable row level security;
alter table unit_beds enable row level security;
alter table inventory_pools enable row level security;
alter table inventory_pool_members enable row level security;
alter table unit_inventory_days enable row level security;
alter table rate_plans enable row level security;
alter table promotions enable row level security;
alter table inventory_holds enable row level security;
alter table inventory_hold_items enable row level security;
alter table bookings enable row level security;
alter table booking_items enable row level security;
alter table booking_guests enable row level security;
alter table pricing_snapshots enable row level security;
alter table booking_price_items enable row level security;
alter table booking_status_history enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table refunds enable row level security;
alter table ledger_journals enable row level security;
alter table ledger_entries enable row level security;
alter table payout_accounts enable row level security;
alter table payouts enable row level security;
alter table conversations enable row level security;
alter table conversation_members enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table reviews enable row level security;
alter table group_enquiries enable row level security;
alter table group_quotes enable row level security;
alter table group_quote_options enable row level security;
alter table support_tickets enable row level security;
alter table ticket_messages enable row level security;
alter table favourites enable row level security;
alter table audit_logs enable row level security;
alter table webhook_events enable row level security;
alter table idempotency_keys enable row level security;
alter table outbox_events enable row level security;
alter table ical_connections enable row level security;
alter table system_settings enable row level security;

create policy profiles_self_or_staff_read on profiles for select to authenticated
using (id = auth.uid() or public.is_staff());
create policy profiles_self_update on profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

create policy public_published_properties on properties for select to anon, authenticated
using (status = 'PUBLISHED');
create policy property_manager_read on properties for select to authenticated
using (exists (select 1 from property_staff ps where ps.property_id = id and ps.user_id = auth.uid()) or public.is_staff());
create policy property_manager_update on properties for update to authenticated
using (exists (select 1 from property_staff ps where ps.property_id = id and ps.user_id = auth.uid()) or public.has_role('SUPER_ADMIN'));

create policy public_property_images on property_images for select to anon, authenticated
using (exists (select 1 from properties p where p.id = property_id and p.status = 'PUBLISHED'));
create policy public_amenities on amenities for select to anon, authenticated using (true);
create policy public_property_amenities on property_amenities for select to anon, authenticated
using (exists (select 1 from properties p where p.id = property_id and p.status = 'PUBLISHED'));
create policy public_units on units for select to anon, authenticated
using (active and exists (select 1 from properties p where p.id = property_id and p.status = 'PUBLISHED'));

create policy property_staff_self_or_staff on property_staff for select to authenticated
using (user_id = auth.uid() or public.is_staff());
create policy private_property_documents on property_documents for select to authenticated
using (
  exists (select 1 from property_staff ps where ps.property_id = property_id and ps.user_id = auth.uid())
  or public.has_role('HOST_VERIFICATION_OFFICER') or public.has_role('SUPER_ADMIN')
);

create policy inventory_property_manager_read on unit_inventory_days for select to authenticated
using (exists (
  select 1 from inventory_pools ip join property_staff ps on ps.property_id = ip.property_id
  where ip.id = pool_id and ps.user_id = auth.uid()
) or public.is_staff());

create policy booking_participant_read on bookings for select to authenticated
using (
  guest_id = auth.uid()
  or exists (select 1 from property_staff ps where ps.property_id = property_id and ps.user_id = auth.uid())
  or public.is_staff()
);
create policy booking_guest_create on bookings for insert to authenticated
with check (guest_id = auth.uid() and status = 'DRAFT');

create policy booking_items_participant_read on booking_items for select to authenticated
using (exists (select 1 from bookings b where b.id = booking_id));
create policy booking_guests_participant_read on booking_guests for select to authenticated
using (exists (select 1 from bookings b where b.id = booking_id));
create policy pricing_participant_read on pricing_snapshots for select to authenticated
using (exists (select 1 from bookings b where b.id = booking_id));
create policy pricing_items_participant_read on booking_price_items for select to authenticated
using (exists (select 1 from pricing_snapshots s join bookings b on b.id = s.booking_id where s.id = snapshot_id));

create policy payment_guest_or_finance_read on payments for select to authenticated
using (
  exists (select 1 from bookings b where b.id = booking_id and b.guest_id = auth.uid())
  or public.has_role('FINANCE_OFFICER') or public.has_role('SUPER_ADMIN')
);
create policy payout_host_or_finance_read on payouts for select to authenticated
using (
  exists (select 1 from host_profiles hp where hp.id = host_id and hp.user_id = auth.uid())
  or public.has_role('FINANCE_OFFICER') or public.has_role('SUPER_ADMIN')
);
create policy payout_accounts_owner_or_finance on payout_accounts for select to authenticated
using (
  exists (select 1 from host_profiles hp where hp.id = host_id and hp.user_id = auth.uid())
  or public.has_role('FINANCE_OFFICER') or public.has_role('SUPER_ADMIN')
);

create policy conversation_members_read on conversations for select to authenticated
using (exists (select 1 from conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid()) or public.is_staff());
create policy own_conversation_membership on conversation_members for select to authenticated
using (user_id = auth.uid() or public.is_staff());
create policy conversation_messages_read on messages for select to authenticated
using (exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()) or public.is_staff());
create policy conversation_messages_create on messages for insert to authenticated
with check (sender_id = auth.uid() and exists (select 1 from conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()));

create policy own_notifications on notifications for select to authenticated using (user_id = auth.uid());
create policy public_reviews on reviews for select to anon, authenticated using (status = 'PUBLISHED');
create policy own_group_enquiries on group_enquiries for select to authenticated using (coordinator_id = auth.uid() or public.is_staff());
create policy own_group_quotes on group_quotes for select to authenticated
using (exists (select 1 from group_enquiries ge where ge.id = enquiry_id and (ge.coordinator_id = auth.uid() or public.is_staff())));
create policy own_group_quote_options on group_quote_options for select to authenticated
using (exists (select 1 from group_quotes gq join group_enquiries ge on ge.id = gq.enquiry_id where gq.id = quote_id and (ge.coordinator_id = auth.uid() or public.is_staff())));
create policy own_support_tickets on support_tickets for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy own_ticket_messages on ticket_messages for select to authenticated
using (exists (select 1 from support_tickets st where st.id = ticket_id and (st.user_id = auth.uid() or public.is_staff())));
create policy own_favourites on favourites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
