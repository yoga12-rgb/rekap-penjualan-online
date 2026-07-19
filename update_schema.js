const fs = require('fs');

const schemaPath = 'supabase/schema.sql';
let schema = fs.readFileSync(schemaPath, 'utf8');

// 1. Update product_variants
schema = schema.replace(
  /create table if not exists public\.product_variants \([\s\S]*?\);/,
  `create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_price numeric(12,2) not null check (base_price >= 0),
  hpp numeric(12,2) not null default 0 check (hpp >= 0),
  created_at timestamptz not null default now()
);`
);

// 2. Update transactions
schema = schema.replace(
  /create table if not exists public\.transactions \([\s\S]*?\);/,
  `create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null default gen_random_uuid(),
  order_number text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  outlet_id uuid not null references public.outlets(id) on delete restrict,
  food_merchant_id uuid not null references public.food_merchants(id) on delete restrict,
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  transaction_date timestamptz not null default now(),
  qty integer not null check (qty > 0),
  initial_price numeric(12,2) not null check (initial_price >= 0), -- HARGA STATIS saat transaksi
  deduction_fee numeric(12,2) not null default 0 check (deduction_fee >= 0),
  is_fake boolean not null default false,
  company_expense numeric(12,2) not null default 0 check (company_expense >= 0),
  total_hpp numeric(14,2) not null default 0 check (total_hpp >= 0),
  net_profit numeric(14,2) generated always as ((qty * initial_price) - deduction_fee) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);`
);

// 3. Update get_dashboard_summary
const dashSql = fs.readFileSync('supabase/migrations/018_fix_dashboard_summary.sql', 'utf8');
schema = schema.replace(
  /create or replace function public\.get_dashboard_summary\([\s\S]*?\$\$;/,
  dashSql.trim()
);

// 4. Update get_transactions_summary
const sumSql = fs.readFileSync('supabase/migrations/019_add_hpp_transactions_summary.sql', 'utf8');
schema = schema.replace(
  /create or replace function public\.get_transactions_summary\([\s\S]*?\$\$;/,
  sumSql.trim()
);

// 5. Update get_transaction_order_page
const pageSql = fs.readFileSync('supabase/migrations/020_add_hpp_transaction_orders.sql', 'utf8');
schema = schema.replace(
  /create or replace function public\.get_transaction_order_page\([\s\S]*?\$\$;/,
  pageSql.trim()
);

// 6. Update grants
schema = schema.replace(
  /grant execute on function public\.get_transactions_summary\(date, date, uuid, uuid, uuid, text\) to authenticated;/,
  `grant execute on function public.get_transactions_summary(date, date, uuid, uuid, uuid, text, text) to authenticated;`
);

schema = schema.replace(
  /grant execute on function public\.get_transaction_order_page\(date, date, uuid, uuid, uuid, text, integer, integer\) to authenticated;/,
  `grant execute on function public.get_transaction_order_page(date, date, uuid, uuid, uuid, text, integer, integer, text) to authenticated;`
);

fs.writeFileSync(schemaPath, schema, 'utf8');
console.log('Schema updated successfully.');
