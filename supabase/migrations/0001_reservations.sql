-- ============================================================
-- HOSTEL ITALIAN — 0001_reservations.sql
-- Tabla de reservas compartida (reemplaza el localStorage por
-- navegador), con RLS: el frontend público solo puede crear
-- reservas, nunca leer datos personales de otros huéspedes.
-- ============================================================

create extension if not exists pgcrypto;

create table reservations (
  id               uuid primary key default gen_random_uuid(),
  code             text unique not null,
  room_type        text not null check (room_type in ('dorm', 'private')),
  check_in         date not null,
  check_out        date not null,
  nights           int not null,
  guests           int not null default 1,
  price_per_night  numeric not null,
  total_price      numeric not null,
  guest_name       text not null,
  guest_email      text,
  guest_phone      text,
  notes            text,
  status           text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled')),
  reminder_sent    boolean not null default false,
  created_at       timestamptz not null default now()
);

create index reservations_check_in_idx on reservations (check_in);

-- ── RLS ────────────────────────────────────────────────────

alter table reservations enable row level security;

-- El frontend público (rol anon) puede crear reservas...
create policy "anon can insert reservations"
  on reservations for insert
  to anon
  with check (true);

-- ...pero no puede leer, editar ni borrar la tabla completa
-- (sin policy de select/update/delete para anon → acceso denegado).

-- ── Vista de disponibilidad ─────────────────────────────────
-- Expone solo lo necesario para calcular disponibilidad en el
-- calendario (isAvailable/getBlockedDates en storage.js), sin
-- exponer nombre/email/teléfono de los huéspedes. Las vistas
-- corren con los privilegios del owner por default, así que
-- puede leer la tabla aunque `anon` no tenga acceso directo.

create view public_availability as
  select room_type, check_in, check_out, guests, status
  from reservations
  where status != 'cancelled';

grant select on public_availability to anon;
