// ============================================================
// HOSTEL ITALIAN — supabaseClient.js
// Cliente Supabase compartido por todo el frontend.
//
// La URL y la anon key son públicas por diseño: la seguridad la
// da Row Level Security en la base (ver
// supabase/migrations/0001_reservations.sql), no el secreto de
// estas credenciales. Reemplazar los placeholders con los datos
// reales del proyecto (Supabase → Project Settings → API).
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL      = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
