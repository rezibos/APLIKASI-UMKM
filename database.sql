-- Jalankan di SQL Editor Supabase
-- Schema admin POS tanpa data dummy

create extension if not exists pgcrypto;

create table if not exists categories (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	description text,
	created_at timestamptz not null default now()
);

create table if not exists products (
	id uuid primary key default gen_random_uuid(),
	category_id uuid not null references categories(id) on delete restrict,
	name text not null,
	price numeric(12, 0) not null default 0,
	stock integer not null default 0,
	image_url text,
	created_at timestamptz not null default now()
);

create table if not exists transactions (
	id uuid primary key default gen_random_uuid(),
	code text not null unique,
	status text not null default 'completed',
	customer_name text,
	notes text,
	total numeric(12, 0) not null default 0,
	payment numeric(12, 0) not null default 0,
	change numeric(12, 0) not null default 0,
	processed_at timestamptz,
	created_at timestamptz not null default now()
);

create table if not exists transaction_items (
	id bigserial primary key,
	transaction_id uuid not null references transactions(id) on delete cascade,
	product_id uuid not null references products(id) on delete restrict,
	name text not null,
	price numeric(12, 0) not null default 0,
	qty integer not null default 0,
	subtotal numeric(12, 0) not null default 0
);

create index if not exists idx_products_category_id on products(category_id);
create index if not exists idx_transaction_items_transaction_id on transaction_items(transaction_id);
create index if not exists idx_transaction_items_product_id on transaction_items(product_id);

alter table transactions add column if not exists status text not null default 'completed';
alter table transactions add column if not exists customer_name text;
alter table transactions add column if not exists notes text;
alter table transactions add column if not exists processed_at timestamptz;

alter table categories enable row level security;
alter table products enable row level security;
alter table transactions enable row level security;
alter table transaction_items enable row level security;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'categories_all') THEN
		CREATE POLICY categories_all ON categories
			FOR ALL
			USING (true)
			WITH CHECK (true);
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'products_all') THEN
		CREATE POLICY products_all ON products
			FOR ALL
			USING (true)
			WITH CHECK (true);
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'transactions_all') THEN
		CREATE POLICY transactions_all ON transactions
			FOR ALL
			USING (true)
			WITH CHECK (true);
	END IF;
END
$$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_policy WHERE polname = 'transaction_items_all') THEN
		CREATE POLICY transaction_items_all ON transaction_items
			FOR ALL
			USING (true)
			WITH CHECK (true);
	END IF;
END
$$;
