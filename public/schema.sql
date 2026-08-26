-- ============================================================================
-- Arvicon Operations & Inventory Management System — Schema
-- Run this ONCE in Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------- MASTER DATA -------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  category text,           -- Sandstone / Limestone / Granite / Marble / Slate / Porcelain / Stone Veneer
  material text,
  colour text,
  finish text,             -- Honed / Polished / Flamed / Natural / Bush-hammered / Tumbled
  size text,               -- e.g. 600x400x25mm
  thickness_mm numeric,
  grade text,
  unit text not null default 'SQM',
  standard_cost numeric(14,2) default 0,
  standard_selling_price numeric(14,2) default 0,
  min_stock_level numeric(14,3) default 0,
  active boolean not null default true,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  company_name text not null,
  contact_person text,
  email text,
  phone text,
  country text,
  address jsonb not null default '{}'::jsonb,
  payment_terms text default 'Net 30',
  credit_limit numeric(14,2) default 0,
  currency text default 'GBP',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  contact_person text,
  email text,
  phone text,
  country text,
  address jsonb not null default '{}'::jsonb,
  payment_terms text default 'Net 45',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  country text,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------- INVENTORY -------------------------
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  stock_id text unique not null,
  date_added date not null default current_date,
  product_id uuid not null references public.products(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id),
  batch_lot text,
  quantity_sqm numeric(14,3) not null default 0,
  quantity_pieces integer default 0,
  pallets integer default 0,
  crates integer default 0,
  weight_mt numeric(14,3) default 0,
  warehouse_location text,
  source text not null default 'own_production' check (source in ('own_production','outsourced')),
  supplier_id uuid references public.suppliers(id),
  supplier_batch text,
  supplier_cost numeric(14,2) default 0,
  supplier_invoice_number text,
  production_cost numeric(14,2) default 0,
  freight_cost numeric(14,2) default 0,
  duty_tax numeric(14,2) default 0,
  handling_cost numeric(14,2) default 0,
  storage_cost numeric(14,2) default 0,
  other_costs numeric(14,2) default 0,
  total_landed_cost numeric(14,2) generated always as (
    coalesce(production_cost,0) + coalesce(supplier_cost,0) + coalesce(freight_cost,0)
    + coalesce(duty_tax,0) + coalesce(handling_cost,0) + coalesce(storage_cost,0) + coalesce(other_costs,0)
  ) stored,
  cost_per_sqm numeric(14,4) generated always as (
    case when quantity_sqm > 0 then
      (coalesce(production_cost,0) + coalesce(supplier_cost,0) + coalesce(freight_cost,0)
      + coalesce(duty_tax,0) + coalesce(handling_cost,0) + coalesce(storage_cost,0) + coalesce(other_costs,0)) / quantity_sqm
    else 0 end
  ) stored,
  selling_price_sqm numeric(14,2) default 0,
  reserved_sqm numeric(14,3) not null default 0,
  status text not null default 'available' check (status in ('available','reserved','sold','delivered','damaged','in_transit','outsourced','on_hold')),
  customer_id uuid references public.customers(id),
  sales_order_id uuid,
  shipment_id uuid,
  invoice_number text,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (quantity_sqm >= 0),
  check (reserved_sqm >= 0),
  check (reserved_sqm <= quantity_sqm)
);

create index if not exists inventory_product_idx on public.inventory(product_id);
create index if not exists inventory_warehouse_idx on public.inventory(warehouse_id);
create index if not exists inventory_status_idx on public.inventory(status);
create index if not exists inventory_source_idx on public.inventory(source);
create index if not exists inventory_supplier_idx on public.inventory(supplier_id);
create index if not exists inventory_customer_idx on public.inventory(customer_id);
create index if not exists inventory_created_idx on public.inventory(created_at desc);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid references public.inventory(id) on delete set null,
  product_id uuid references public.products(id),
  movement_type text not null,   -- Stock Added / Adjusted / Reserved / Sold / Delivered / Returned / Damaged / Transferred / Consumed / Released
  quantity_sqm numeric(14,3) not null,
  reference_type text,
  reference_id uuid,
  notes text,
  actor text default 'system',
  created_at timestamptz not null default now()
);
create index if not exists movements_inv_idx on public.inventory_movements(inventory_id, created_at desc);

-- ------------------------- SALES / ORDERS -------------------------
create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  customer_id uuid references public.customers(id),
  order_date date not null default current_date,
  currency text default 'GBP',
  customer_po text,
  status text not null default 'enquiry' check (status in ('enquiry','quotation','confirmed','processing','partially_delivered','delivered','cancelled')),
  total_sqm numeric(14,3) default 0,
  total_value numeric(14,2) default 0,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid references public.products(id),
  inventory_id uuid references public.inventory(id),
  quantity_sqm numeric(14,3) not null,
  pallets integer default 0,
  price_per_sqm numeric(14,2) not null,
  total numeric(14,2) generated always as (quantity_sqm * price_per_sqm) stored,
  allocated_sqm numeric(14,3) default 0
);

-- ------------------------- INVOICES / PAYMENTS -------------------------
create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text unique not null,
  sales_order_id uuid references public.sales_orders(id),
  customer_id uuid references public.customers(id),
  invoice_date date not null default current_date,
  due_date date,
  currency text default 'GBP',
  amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  status text not null default 'unpaid' check (status in ('unpaid','partially_paid','paid','overdue','cancelled')),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  payment_date date not null default current_date,
  amount numeric(14,2) not null,
  method text,
  reference text,
  created_at timestamptz not null default now()
);

-- ------------------------- SHIPMENTS -------------------------
create table if not exists public.shipments (
  id uuid primary key default gen_random_uuid(),
  shipment_id text unique not null,
  container_number text,
  booking_number text,
  invoice_number text,
  customer_id uuid references public.customers(id),
  supplier_id uuid references public.suppliers(id),
  vessel text,
  shipping_line text,
  etd date,
  eta date,
  actual_departure date,
  actual_arrival date,
  origin text,
  destination text,
  port_loading text,
  port_discharge text,
  current_location text,
  tracking_ref text,
  status text not null default 'planned' check (status in ('planned','production','ready','booked','loaded','departed','in_transit','arrived','customs','delivered','delayed','cancelled')),
  freight numeric(14,2) default 0,
  port_charges numeric(14,2) default 0,
  customs numeric(14,2) default 0,
  handling numeric(14,2) default 0,
  other_costs numeric(14,2) default 0,
  total_shipping_cost numeric(14,2) generated always as (
    coalesce(freight,0)+coalesce(port_charges,0)+coalesce(customs,0)+coalesce(handling,0)+coalesce(other_costs,0)
  ) stored,
  total_sqm numeric(14,3) default 0,
  pallets integer default 0,
  weight_mt numeric(14,3) default 0,
  notes text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists shipments_status_idx on public.shipments(status);
create index if not exists shipments_eta_idx on public.shipments(eta);

create table if not exists public.shipment_items (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete cascade,
  product_id uuid references public.products(id),
  inventory_id uuid references public.inventory(id),
  quantity_sqm numeric(14,3) not null,
  pallets integer default 0
);

-- ------------------------- OUTSOURCE -------------------------
create table if not exists public.outsource_purchases (
  id uuid primary key default gen_random_uuid(),
  purchase_id text unique not null,
  supplier_id uuid references public.suppliers(id),
  purchase_date date not null default current_date,
  product_id uuid references public.products(id),
  quantity_sqm numeric(14,3) not null,
  pallets integer default 0,
  cost_per_sqm numeric(14,2) default 0,
  total_cost numeric(14,2) generated always as (quantity_sqm * cost_per_sqm) stored,
  supplier_invoice_number text,
  invoice_date date,
  payment_due_date date,
  payment_status text default 'unpaid',
  delivery_date date,
  received_qty numeric(14,3) default 0,
  pending_qty numeric(14,3) default 0,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------- DOCUMENTS / ALERTS / AUDIT -------------------------
create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  bucket text not null default 'documents',
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  unique(bucket, object_path)
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity text not null default 'info',
  message text not null,
  entity_type text,
  entity_id uuid,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text,
  action text not null,
  table_name text,
  record_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  uploaded_by text,
  batch_type text,
  status text not null default 'pending',
  total_rows integer default 0,
  success_rows integer default 0,
  failed_rows integer default 0,
  duplicate_rows integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.import_batches(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null,
  status text not null default 'pending',
  error_message text
);

-- ------------------------- STORAGE BUCKET -------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do nothing;

-- ------------------------- RLS (defense-in-depth; service key bypasses) ---
do $$ declare t text; begin
  foreach t in array array['products','customers','suppliers','warehouses','inventory','inventory_movements',
    'sales_orders','sales_order_items','invoices','payments','shipments','shipment_items',
    'outsource_purchases','documents','alerts','audit_logs','import_batches','import_rows'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Seed one warehouse (idempotent)
insert into public.warehouses (code, name, country)
values ('WH-UK-01', 'Arvicon UK Main Warehouse', 'United Kingdom')
on conflict (code) do nothing;
