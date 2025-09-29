// supabase-client.js
// Create the global supabase client. In deployment make sure to inject these values as env vars.
const SUPABASE_URL = window.SUPABASE_URL || 'https://kmjgyqqbqcxwpavwgnsu.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imttamd5cXFicWN4d3BhdndnbnN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNTIzNjMsImV4cCI6MjA3NDcyODM2M30.uHWMB_DeQn4nQ-MWcwEKVhnskA_K1AlGoAacmxVu3b0';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase keys not set. Create a supabase-client.js file with keys or inject via env.');
}

const supabase = supabaseJs.createClient
  ? supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
