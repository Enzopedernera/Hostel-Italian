// ============================================================
// HOSTEL ITALIAN — send-reminders (Supabase Edge Function)
// Corre una vez por día (ver cron en README). Busca reservas cuyo
// check-in es "mañana" (hora Argentina) y les manda un recordatorio
// por email vía Resend, marcando reminder_sent para no duplicar.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY      = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY        = Deno.env.get('RESEND_API_KEY')!;
const FROM_EMAIL             = Deno.env.get('REMINDER_FROM_EMAIL') || 'El Italian Hostel <onboarding@resend.dev>';

const ARGENTINA_UTC_OFFSET_HOURS = -3;

function tomorrowInArgentina() {
  const now = new Date();
  const argentinaNow = new Date(now.getTime() + ARGENTINA_UTC_OFFSET_HOURS * 3600_000);
  argentinaNow.setUTCDate(argentinaNow.getUTCDate() + 1);
  return argentinaNow.toISOString().slice(0, 10); // YYYY-MM-DD
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function buildEmailHtml(r: {
  code: string; room_type: string; check_in: string; check_out: string;
  guest_name: string; guests: number;
}) {
  const roomLabel = r.room_type === 'dorm' ? 'Dormitorio Compartido' : 'Habitación Privada';
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>¡Te esperamos mañana, ${r.guest_name}!</h2>
      <p>Este es un recordatorio de tu reserva en <strong>El Italian Hostel</strong>:</p>
      <ul>
        <li><strong>Código:</strong> ${r.code}</li>
        <li><strong>Habitación:</strong> ${roomLabel}</li>
        <li><strong>Llegada:</strong> ${fmtDate(r.check_in)}</li>
        <li><strong>Salida:</strong> ${fmtDate(r.check_out)}</li>
        <li><strong>Huéspedes:</strong> ${r.guests}</li>
      </ul>
      <p>Check-in a partir de las 15:00. ¡Nos vemos pronto!</p>
    </div>
  `;
}

Deno.serve(async () => {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const checkInDate = tomorrowInArgentina();

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, code, room_type, check_in, check_out, guest_name, guest_email, guests')
    .eq('check_in', checkInDate)
    .neq('status', 'cancelled')
    .eq('reminder_sent', false)
    .not('guest_email', 'is', null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  let sent = 0;
  const failures: string[] = [];

  for (const r of reservations ?? []) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: r.guest_email,
        subject: `Tu reserva es mañana — ${r.code}`,
        html: buildEmailHtml(r),
      }),
    });

    if (res.ok) {
      sent++;
      await supabase.from('reservations').update({ reminder_sent: true }).eq('id', r.id);
    } else {
      failures.push(`${r.code}: ${await res.text()}`);
    }
  }

  return new Response(JSON.stringify({ checkInDate, sent, failures }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
