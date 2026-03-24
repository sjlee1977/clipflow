import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, key);

export type RenderRecord = {
  id: string;
  session_id: string;
  render_id: string;
  bucket_name: string;
  status: 'rendering' | 'done' | 'error';
  output_url: string | null;
  created_at: string;
};
