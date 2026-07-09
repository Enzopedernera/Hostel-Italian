// ============================================================
// HOSTEL ITALIAN — storage.js
// Capa de persistencia. Las reservas viven en Supabase (base
// compartida entre todos los visitantes); la configuración
// (precios/capacidad/contacto) sigue siendo local, no sensible.
// ============================================================

import { supabase } from './supabaseClient.js';

const KEYS = {
  CONFIG: 'hi_config',
};

// Configuración por defecto (editable desde el código)
const DEFAULT_CONFIG = {
  prices: {
    dorm:    25000,
    private: 65000,
  },
  capacity: {
    dorm:    8,
    private: 1,
  },
  minNights:    1,
  checkInTime:  '15:00',
  checkOutTime: '11:00',
  waNumber:     '5492944000000',       // Reemplazar con número real sin + ni espacios
  contactEmail: 'hola@hostelitalian.com', // Reemplazar con email real
};

// ── Helpers internos ─────────────────────────────────────

function parseDate(str) {
  // Evitar problemas de timezone: parsear como fecha local
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  const a1 = parseDate(aFrom), a2 = parseDate(aTo);
  const b1 = parseDate(bFrom), b2 = parseDate(bTo);
  // Overlap si a1 < b2 && b1 < a2
  return a1 < b2 && b1 < a2;
}

// ── Config ───────────────────────────────────────────────

export function getConfig() {
  try {
    const stored = localStorage.getItem(KEYS.CONFIG);
    return stored ? { ...DEFAULT_CONFIG, ...JSON.parse(stored) } : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

// ── Reservas ─────────────────────────────────────────────
// Backend: tabla `reservations` en Supabase (ver
// supabase/migrations/0001_reservations.sql). El frontend público
// solo puede insertar; para disponibilidad lee la vista
// `public_availability`, que no expone datos personales.

/**
 * Reservas activas (no canceladas), solo campos necesarios para
 * calcular disponibilidad. Devuelve [] si falla la consulta.
 */
async function getAvailabilityRows() {
  const { data, error } = await supabase
    .from('public_availability')
    .select('room_type, check_in, check_out, guests, status');

  if (error) {
    console.error('Error consultando disponibilidad:', error.message);
    return [];
  }

  return data.map(r => ({
    roomType: r.room_type,
    checkIn:  r.check_in,
    checkOut: r.check_out,
    guests:   r.guests,
    status:   r.status,
  }));
}

/**
 * Guarda una reserva nueva en Supabase. `data` usa las mismas
 * claves que armaba el wizard (roomType, checkIn, checkOut, nights,
 * guests, pricePerNight, totalPrice, guestName, guestEmail,
 * guestPhone, notes). Devuelve la reserva creada o null si falla.
 */
export async function saveReservation(data) {
  const code = 'HI-' + Date.now().toString(36).toUpperCase().slice(-6);

  const { data: row, error } = await supabase
    .from('reservations')
    .insert({
      code,
      room_type:       data.roomType,
      check_in:        data.checkIn,
      check_out:       data.checkOut,
      nights:          data.nights,
      guests:          data.guests,
      price_per_night: data.pricePerNight,
      total_price:     data.totalPrice,
      guest_name:      data.guestName,
      guest_email:     data.guestEmail || null,
      guest_phone:     data.guestPhone || null,
      notes:           data.notes || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Error guardando la reserva:', error.message);
    return null;
  }

  return { id: row.id, code: row.code, ...data };
}

// ── Disponibilidad ────────────────────────────────────────

/**
 * Devuelve true si el tipo de habitación está disponible
 * para el rango checkIn → checkOut (fechas en formato YYYY-MM-DD).
 *
 * Para habitaciones privadas (capacidad 1), cualquier reserva solapada
 * bloquea el rango completo.
 * Para el dormitorio compartido (capacidad > 1, por camas), se suman
 * los huéspedes ya reservados que se solapan y se compara contra la
 * capacidad total — así varias reservas distintas pueden convivir en
 * las mismas fechas mientras queden camas libres.
 */
export async function isAvailable(checkIn, checkOut, roomType, guests = 1) {
  const config      = getConfig();
  const capacity     = config.capacity[roomType] ?? 1;
  const reservations = (await getAvailabilityRows()).filter(
    r => r.roomType === roomType
  );

  const overlapping = reservations.filter(r =>
    rangesOverlap(checkIn, checkOut, r.checkIn, r.checkOut)
  );

  if (capacity <= 1) {
    // Unidad única (ej. habitación privada): cualquier solape bloquea
    return overlapping.length === 0;
  }

  // Dormitorio: sumar huéspedes ya ocupados en ese rango y comparar con la capacidad
  const occupied = overlapping.reduce((sum, r) => sum + (r.guests || 1), 0);
  return (occupied + guests) <= capacity;
}

/**
 * Devuelve un Set de strings 'YYYY-MM-DD' con todas las fechas
 * bloqueadas para un tipo de habitación dado.
 *
 * Para unidades de capacidad 1 (habitación privada), cualquier reserva
 * bloquea el día completo. Para el dormitorio, un día solo se bloquea
 * cuando la suma de huéspedes ya reservados ese día alcanza la
 * capacidad total de camas.
 */
export async function getBlockedDates(roomType) {
  const config   = getConfig();
  const capacity = config.capacity[roomType] ?? 1;
  const blocked  = new Set();
  const reservations = (await getAvailabilityRows()).filter(
    r => r.roomType === roomType
  );

  if (capacity <= 1) {
    for (const r of reservations) {
      const current = parseDate(r.checkIn);
      const end     = parseDate(r.checkOut);
      while (current < end) {
        blocked.add(toISODate(current));
        current.setDate(current.getDate() + 1);
      }
    }
    return blocked;
  }

  // Dormitorio: acumular huéspedes ocupados por día
  const occupancyByDate = new Map();

  for (const r of reservations) {
    const guests  = r.guests || 1;
    const current = parseDate(r.checkIn);
    const end     = parseDate(r.checkOut);
    while (current < end) {
      const key = toISODate(current);
      occupancyByDate.set(key, (occupancyByDate.get(key) || 0) + guests);
      current.setDate(current.getDate() + 1);
    }
  }

  for (const [date, occupied] of occupancyByDate) {
    if (occupied >= capacity) blocked.add(date);
  }

  return blocked;
}

/**
 * Cuenta cuántas noches hay entre dos fechas.
 */
export function calcNights(checkIn, checkOut) {
  const diff = parseDate(checkOut) - parseDate(checkIn);
  return Math.round(diff / 86400000);
}

/**
 * Calcula el precio total de una reserva.
 */
export function calcTotal(roomType, checkIn, checkOut, guests) {
  const config  = getConfig();
  const price   = config.prices[roomType] ?? 0;
  const nights  = calcNights(checkIn, checkOut);
  const qty     = roomType === 'dorm' ? (guests || 1) : 1;
  return { nights, pricePerNight: price, qty, total: nights * price * qty };
}
