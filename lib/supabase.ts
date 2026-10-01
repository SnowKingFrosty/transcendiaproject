import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Delivery = {
  id: string;
  invoice: string;
  customer: string;
  zone: string;
  store: string;
  status: string;
  entry_type: string;
  image_url: string | null;
  signature_url: string | null;
  completion_timestamp: string | null;
  completion_epoch: number | null;
  canceled_epoch: number | null;
  status_type: string;
  force_archive: boolean;
  created_at: number;
};
