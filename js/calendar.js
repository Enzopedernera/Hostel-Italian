// ============================================================
// HOSTEL ITALIAN — calendar.js
// Componente de calendario visual para selección de rango.
// Sin dependencias externas.
// ============================================================

const DAYS_ES  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTHS_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

/**
 * Crea y gestiona un selector de rango de fechas.
 *
 * @param {HTMLElement} container  - Elemento donde se renderiza el calendario
 * @param {Object}      opts
 * @param {Set<string>} opts.blockedDates - Set de 'YYYY-MM-DD' bloqueadas
 * @param {string}      opts.minDate      - Fecha mínima 'YYYY-MM-DD' (default: hoy)
 * @param {Function}    opts.onChange     - Callback({ checkIn, checkOut })
 */
export function createCalendar(container, opts = {}) {
  const blockedDates = opts.blockedDates || new Set();
  const onChange     = opts.onChange     || (() => {});

  // Fecha mínima = hoy
  const today    = new Date();
  const minDate  = opts.minDate
    ? parseLocalDate(opts.minDate)
    : new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let viewYear  = minDate.getFullYear();
  let viewMonth = minDate.getMonth();

  let checkIn  = null; // string YYYY-MM-DD
  let checkOut = null;
  let hoverDate = null;

  // ── Render ───────────────────────────────────────────────

  function render() {
    container.innerHTML = '';
    container.appendChild(buildMonth(viewYear, viewMonth));
  }

  function buildMonth(year, month) {
    const wrap = document.createElement('div');
    wrap.className = 'cal';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Calendario de selección de fechas');

    // Header
    const header = document.createElement('div');
    header.className = 'cal__header';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'cal__nav';
    btnPrev.type      = 'button';
    btnPrev.innerHTML = '&#8249;';
    btnPrev.setAttribute('aria-label', 'Mes anterior');
    btnPrev.disabled  = (year === minDate.getFullYear() && month <= minDate.getMonth());
    btnPrev.addEventListener('click', () => { shiftMonth(-1); render(); });

    const title = document.createElement('span');
    title.className   = 'cal__month-title';
    title.textContent = `${MONTHS_ES[month]} ${year}`;

    const btnNext = document.createElement('button');
    btnNext.className = 'cal__nav';
    btnNext.type      = 'button';
    btnNext.innerHTML = '&#8250;';
    btnNext.setAttribute('aria-label', 'Mes siguiente');
    btnNext.addEventListener('click', () => { shiftMonth(1); render(); });

    header.append(btnPrev, title, btnNext);

    // Grid
    const grid = document.createElement('div');
    grid.className = 'cal__grid';

    // Day-of-week headers
    DAYS_ES.forEach(d => {
      const dEl = document.createElement('div');
      dEl.className   = 'cal__dow';
      dEl.textContent = d;
      grid.appendChild(dEl);
    });

    // Empty cells before first day
    const firstDow = new Date(year, month, 1).getDay();
    for (let i = 0; i < firstDow; i++) {
      const empty = document.createElement('div');
      empty.className = 'cal__day cal__day--empty';
      grid.appendChild(empty);
    }

    // Days
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = toISO(year, month, day);
      const dateObj = new Date(year, month, day);

      const el = document.createElement('div');
      el.className   = 'cal__day';
      el.textContent = day;
      el.dataset.date = dateStr;

      const isPast    = dateObj < minDate;
      const isBlocked = blockedDates.has(dateStr);
      const isToday   = isSameDay(dateObj, today);

      if (isPast)    el.classList.add('cal__day--past');
      if (isBlocked) el.classList.add('cal__day--blocked');
      if (isToday)   el.classList.add('cal__day--today');

      // Range highlighting
      if (checkIn && checkOut) {
        if (dateStr === checkIn)  el.classList.add('cal__day--check-in');
        if (dateStr === checkOut) el.classList.add('cal__day--check-out');
        if (dateStr > checkIn && dateStr < checkOut) el.classList.add('cal__day--in-range');
      } else if (checkIn && !checkOut) {
        if (dateStr === checkIn) el.classList.add('cal__day--check-in');
        // Hover preview
        if (hoverDate && dateStr > checkIn && dateStr <= hoverDate) {
          el.classList.add('cal__day--in-range');
        }
      }

      if (!isPast && !isBlocked) {
        el.setAttribute('role', 'button');
        el.setAttribute('tabindex', '0');
        el.setAttribute('aria-label', `${day} de ${MONTHS_ES[month]}${isToday ? ', hoy' : ''}`);
        el.addEventListener('click',      () => handleClick(dateStr));
        el.addEventListener('mouseenter', () => handleHover(dateStr));
        el.addEventListener('mouseleave', () => { hoverDate = null; });
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick(dateStr);
          }
        });
      } else {
        el.setAttribute('aria-disabled', 'true');
      }

      grid.appendChild(el);
    }

    // Legend
    const legend = document.createElement('div');
    legend.className = 'cal__legend';
    legend.innerHTML = `
      <span class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--selected"></span> Check-in / Check-out
      </span>
      <span class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--range"></span> Rango seleccionado
      </span>
      <span class="cal__legend-item">
        <span class="cal__legend-dot cal__legend-dot--blocked"></span> No disponible
      </span>
    `;

    wrap.append(header, grid, legend);
    return wrap;
  }

  // ── Interacción ───────────────────────────────────────────

  function handleClick(dateStr) {
    if (!checkIn || (checkIn && checkOut)) {
      // Iniciar nueva selección
      checkIn  = dateStr;
      checkOut = null;
      onChange({ checkIn, checkOut });
    } else {
      // Segundo click = checkOut (debe ser posterior a checkIn)
      if (dateStr <= checkIn) {
        checkIn  = dateStr;
        checkOut = null;
        onChange({ checkIn, checkOut });
      } else {
        // Verificar que no haya días bloqueados en el rango
        if (rangeHasBlocked(checkIn, dateStr)) {
          checkIn  = dateStr;
          checkOut = null;
          onChange({ checkIn, checkOut });
        } else {
          checkOut = dateStr;
          onChange({ checkIn, checkOut });
        }
      }
    }
    render();
  }

  function handleHover(dateStr) {
    if (checkIn && !checkOut) {
      hoverDate = dateStr;
      render();
    }
  }

  function rangeHasBlocked(from, to) {
    const current = parseLocalDate(from);
    const end     = parseLocalDate(to);
    current.setDate(current.getDate() + 1); // no incluir checkIn
    while (current < end) {
      if (blockedDates.has(toISOFromDate(current))) return true;
      current.setDate(current.getDate() + 1);
    }
    return false;
  }

  function shiftMonth(delta) {
    viewMonth += delta;
    if (viewMonth > 11) { viewMonth = 0;  viewYear++; }
    if (viewMonth < 0)  { viewMonth = 11; viewYear--; }
  }

  // ── API pública ───────────────────────────────────────────

  render();

  return {
    getSelection: () => ({ checkIn, checkOut }),
    reset() {
      checkIn  = null;
      checkOut = null;
      render();
    },
    setBlockedDates(newBlocked) {
      blockedDates.clear?.();
      // Reconstituir el Set
      const entries = [...newBlocked];
      entries.forEach(d => blockedDates.add(d));
      render();
    },
  };
}

// ── Utilidades de fecha ──────────────────────────────────

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
}

function toISOFromDate(date) {
  return toISO(date.getFullYear(), date.getMonth(), date.getDate());
}

function parseLocalDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
