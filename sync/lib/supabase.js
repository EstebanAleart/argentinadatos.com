import { createClient } from '@supabase/supabase-js'
import 'dotenv/config'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('ERROR: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos.')
  console.error('Copiá sync/.env.example a .env y completá los valores.')
  process.exit(1)
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
})
