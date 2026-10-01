/*
# Create deliveries table for Transcendia delivery tracking

1. New Tables
- `deliveries`
  - `id` (uuid, primary key)
  - `invoice` (text, invoice/reference number, 'N/A' for pickups)
  - `customer` (text, shop/customer name)
  - `zone` (text, delivery zone 1-10)
  - `store` (text, dealership store name)
  - `status` (text, 'am' or 'pm' shift)
  - `entry_type` (text, 'delivery' or 'pickup')
  - `image_url` (text, base64 data URL for invoice/completion photo, nullable)
  - `signature_url` (text, base64 data URL for receiver signature, nullable)
  - `completion_timestamp` (text, human-readable completion time, nullable)
  - `completion_epoch` (bigint, epoch ms of completion, nullable)
  - `canceled_epoch` (bigint, epoch ms of cancellation, nullable)
  - `status_type` (text, 'active', 'late', or 'canceled', defaults to 'active')
  - `force_archive` (boolean, forces immediate archive when true, defaults to false)
  - `created_at` (bigint, epoch ms of creation)

2. Security
- Enable RLS on `deliveries`.
- Allow anon + authenticated full CRUD — this is a shared operational dashboard with no user sign-in.
- All data is intentionally shared/public across all dashboard users.
*/

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice text NOT NULL DEFAULT 'N/A',
  customer text NOT NULL,
  zone text NOT NULL,
  store text NOT NULL DEFAULT 'General',
  status text NOT NULL DEFAULT 'am',
  entry_type text NOT NULL DEFAULT 'delivery',
  image_url text,
  signature_url text,
  completion_timestamp text,
  completion_epoch bigint,
  canceled_epoch bigint,
  status_type text NOT NULL DEFAULT 'active',
  force_archive boolean NOT NULL DEFAULT false,
  created_at bigint NOT NULL DEFAULT (EXTRACT(EPOCH FROM now()) * 1000)::bigint
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_deliveries" ON deliveries;
CREATE POLICY "anon_select_deliveries" ON deliveries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deliveries" ON deliveries;
CREATE POLICY "anon_insert_deliveries" ON deliveries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deliveries" ON deliveries;
CREATE POLICY "anon_update_deliveries" ON deliveries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deliveries" ON deliveries;
CREATE POLICY "anon_delete_deliveries" ON deliveries FOR DELETE
  TO anon, authenticated USING (true);
