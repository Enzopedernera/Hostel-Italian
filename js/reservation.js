// ============================================================
// HOSTEL ITALIAN — reservation.js
// Sistema de reservas: wizard de 3 pasos.
// Paso 1: Tipo de habitación + fechas (calendario)
// Paso 2: Datos del huésped
// Paso 3: Resumen + confirmación (WhatsApp / email)
// ============================================================

import { createCalendar }                        from './calendar.js';
import { getBlockedDates, isAvailable, calcTotal,
         saveReservation, getConfig }             from './storage.js';

export function initReservation() {
  const wizard = document.getElementById('reservation-wizard');
  if (!wizard) return;

  const config     = getConfig();
  let currentStep  = 1;
  let cal          = null;

  // Datos del wizard (se van completando por paso)
  const booking = {
    roomType:  'dorm',
    checkIn:   null,
    checkOut:  null,
    guests:    1,
    name:      '',
    email:     '',
    phone:     '',
    notes:     '',
  };

  // ── Elementos del DOM ───────────────────────────────────

  const steps    = wizard.querySelectorAll('.wizard__step');
  const panels   = wizard.querySelectorAll('.wizard__panel');
  const btnBack  = wizard.querySelector('#wiz-back');
  const btnNext  = wizard.querySelector('#wiz-next');
  const errBox   = wizard.querySelector('#wiz-error');
  const success  = document.getElementById('booking-success');

  // Paso 1
  const roomOptions  = wizard.querySelectorAll('.room-option');
  const guestsSelect = wizard.querySelector('#wiz-guests');
  const guestsWrap   = wizard.querySelector('#wiz-guests-wrap');
  const calContainer = wizard.querySelector('#cal-container');
  const dsCheckIn      = wizard.querySelector('#ds-checkin');
  const dsCheckOut     = wizard.querySelector('#ds-checkout');
  const dsNights       = wizard.querySelector('#ds-nights');
  const calHint        = wizard.querySelector('#cal-hint');
  const dsEstimateWrap = wizard.querySelector('#ds-estimate-wrap');
  const dsEstimate     = wizard.querySelector('#ds-estimate');

  // Paso 2
  const fName  = wizard.querySelector('#wiz-name');
  const fEmail = wizard.querySelector('#wiz-email');
  const fPhone = wizard.querySelector('#wiz-phone');
  const fNotes = wizard.querySelector('#wiz-notes');

  // Paso 3
  const sumRoom    = wizard.querySelector('#sum-room');
  const sumDates   = wizard.querySelector('#sum-dates');
  const sumGuests  = wizard.querySelector('#sum-guests');
  const sumNights  = wizard.querySelector('#sum-nights');
  const sumPrice   = wizard.querySelector('#sum-price');
  const sumTotal   = wizard.querySelector('#sum-total');
  const sumName    = wizard.querySelector('#sum-name');
  const sumContact = wizard.querySelector('#sum-contact');
  const btnConfirm = wizard.querySelector('#btn-confirm');
  const btnWa      = wizard.querySelector('#btn-whatsapp');
  const btnWaSuccess = wizard.parentElement?.querySelector('#btn-whatsapp-success');

  // ── Inicializar calendario ──────────────────────────────

  if (calContainer) {
    const blocked = getBlockedDates(booking.roomType);
    cal = createCalendar(calContainer, {
      blockedDates: blocked,
      onChange({ checkIn, checkOut }) {
        booking.checkIn  = checkIn;
        booking.checkOut = checkOut;
        updateDateSummary();
        hideError();
      },
    });
  }

  // ── Tipo de habitación ──────────────────────────────────

  function applyRoomSelection(opt) {
    roomOptions.forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    booking.roomType = opt.dataset.type;

    if (booking.roomType === 'private') {
      booking.guests = 1;
      if (guestsWrap) guestsWrap.style.display = 'none';
    } else {
      if (guestsWrap) guestsWrap.style.display = '';
    }

    booking.checkIn  = null;
    booking.checkOut = null;
    cal?.reset();
    if (cal) {
      const newBlocked = getBlockedDates(booking.roomType);
      cal.setBlockedDates(newBlocked);
    }
    updateDateSummary();
  }

  roomOptions.forEach(opt => {
    opt.addEventListener('click', () => applyRoomSelection(opt));

    // Accesibilidad de teclado: el input radio oculto recibe foco y dispara change
    const radio = opt.querySelector('.room-option__input');
    if (radio) {
      radio.addEventListener('change', () => applyRoomSelection(opt));
    }
  });

  if (guestsSelect) {
    guestsSelect.addEventListener('change', () => {
      booking.guests = parseInt(guestsSelect.value);
      updateDateSummary();
    });
  }

  // ── Resumen de fechas ───────────────────────────────────

  function updateDateSummary() {
    const fmt = (str) => { const [y, m, d] = str.split('-'); return `${d}/${m}/${y}`; };
    const hasRange = !!(booking.checkIn && booking.checkOut);

    if (!booking.checkIn) {
      if (dsCheckIn)  dsCheckIn.textContent  = '—';
      if (dsCheckOut) dsCheckOut.textContent = '—';
      if (dsNights)   dsNights.textContent   = '0';
      if (calHint)    calHint.textContent    = 'Hacé clic en el calendario para elegir tu fecha de llegada.';
    } else if (!booking.checkOut) {
      if (dsCheckIn)  dsCheckIn.textContent  = fmt(booking.checkIn);
      if (dsCheckOut) dsCheckOut.textContent = '—';
      if (dsNights)   dsNights.textContent   = '0';
      if (calHint)    calHint.textContent    = 'Ahora seleccioná tu fecha de salida.';
    } else {
      if (dsCheckIn)  dsCheckIn.textContent  = fmt(booking.checkIn);
      if (dsCheckOut) dsCheckOut.textContent = fmt(booking.checkOut);
      if (calHint)    calHint.textContent    = '';
      const { nights, pricePerNight, total } = calcTotal(
        booking.roomType, booking.checkIn, booking.checkOut, booking.guests
      );
      if (dsNights) dsNights.textContent = nights;
      if (dsEstimate) {
        const fmtNum = n => n.toLocaleString('es-AR');
        const qty = booking.roomType === 'dorm' ? booking.guests : 1;
        dsEstimate.textContent = qty > 1
          ? `${nights} noche/s × $${fmtNum(pricePerNight)} × ${qty} personas = $${fmtNum(total)} ARS`
          : `${nights} noche/s × $${fmtNum(pricePerNight)} = $${fmtNum(total)} ARS`;
      }
    }

    if (dsEstimateWrap) dsEstimateWrap.classList.toggle('visible', hasRange);
    if (currentStep === 1 && btnNext) btnNext.disabled = !hasRange;
  }

  // ── Navegación de pasos ─────────────────────────────────

  function goToStep(n) {
    currentStep = n;
    panels.forEach((p, i) => p.classList.toggle('active', i + 1 === n));
    steps.forEach((s, i) => {
      s.classList.remove('wizard__step--active', 'wizard__step--done');
      if (i + 1 === n) s.classList.add('wizard__step--active');
      if (i + 1 < n)   s.classList.add('wizard__step--done');
    });

    if (btnBack) btnBack.disabled = (n === 1);
    if (btnNext) {
      if (n === 3) {
        btnNext.style.display = 'none';
      } else {
        btnNext.style.display = '';
        btnNext.textContent   = n === 2 ? 'Ver resumen' : 'Continuar';
        btnNext.disabled      = (n === 1) && !(booking.checkIn && booking.checkOut);
      }
    }

    if (n === 3) populateSummary();
    hideError();
  }

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (!validateStep(currentStep)) return;
      goToStep(currentStep + 1);
    });
  }

  if (btnBack) {
    btnBack.addEventListener('click', () => {
      if (currentStep > 1) goToStep(currentStep - 1);
    });
  }

  // ── Validación por paso ─────────────────────────────────

  function validateStep(step) {
    hideError();

    if (step === 1) {
      if (!booking.checkIn || !booking.checkOut) {
        showError('Seleccioná las fechas de llegada y salida en el calendario.');
        return false;
      }
      const { nights } = calcTotal(booking.roomType, booking.checkIn, booking.checkOut, 1);
      if (nights < (config.minNights || 1)) {
        showError(`La estadía mínima es de ${config.minNights || 1} noche/s.`);
        return false;
      }
      if (!isAvailable(booking.checkIn, booking.checkOut, booking.roomType, booking.guests)) {
        showError('Lo sentimos, esas fechas no están disponibles para ese tipo de habitación.');
        return false;
      }
    }

    if (step === 2) {
      let valid = true;
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const phoneRegex = /^[\d+\s()-]{8,}$/;

      clearFieldErrors();

      if (!fName?.value.trim()) {
        setFieldError(fName, 'El nombre es obligatorio.');
        valid = false;
      } else {
        booking.name = fName.value.trim();
      }

      const emailVal = fEmail?.value.trim() || '';
      const phoneVal = fPhone?.value.trim() || '';

      if (!emailVal && !phoneVal) {
        setFieldError(fEmail, 'Ingresá un email o número de WhatsApp.');
        valid = false;
      } else {
        if (emailVal && !emailRegex.test(emailVal)) {
          setFieldError(fEmail, 'Ingresá un email válido.');
          valid = false;
        }
        if (phoneVal && !phoneRegex.test(phoneVal)) {
          setFieldError(fPhone, 'Ingresá un teléfono válido.');
          valid = false;
        }
        if (valid) {
          booking.email = emailVal;
          booking.phone = phoneVal;
        }
      }

      booking.notes = fNotes?.value.trim() || '';

      if (!valid) {
        showError('Por favor completá los campos obligatorios.');
        return false;
      }
    }

    return true;
  }

  function setFieldError(input, msg) {
    if (!input) return;
    const field = input.closest('.guest-form__field');
    if (!field) return;
    field.classList.add('has-error');
    const errEl = field.querySelector('.field-error');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
  }

  function clearFieldErrors() {
    wizard.querySelectorAll('.guest-form__field').forEach(f => {
      f.classList.remove('has-error');
      const e = f.querySelector('.field-error');
      if (e) e.classList.remove('visible');
    });
  }

  function showError(msg) {
    if (!errBox) return;
    errBox.textContent = msg;
    errBox.classList.add('visible');
  }

  function hideError() {
    errBox?.classList.remove('visible');
  }

  // ── Resumen paso 3 ──────────────────────────────────────

  function populateSummary() {
    const { nights, pricePerNight, total } = calcTotal(
      booking.roomType, booking.checkIn, booking.checkOut, booking.guests
    );

    const roomLabel = booking.roomType === 'dorm' ? 'Dormitorio Compartido' : 'Habitación Privada';
    const fmt = n => n.toLocaleString('es-AR');
    const fmtDate = str => {
      const [y, m, d] = str.split('-');
      return `${d}/${m}/${y}`;
    };

    if (sumRoom)    sumRoom.textContent    = roomLabel;
    if (sumDates)   sumDates.textContent   = `${fmtDate(booking.checkIn)} → ${fmtDate(booking.checkOut)}`;
    if (sumNights)  sumNights.textContent  = nights;
    if (sumGuests)  sumGuests.textContent  = booking.roomType === 'dorm' ? `${booking.guests} persona/s` : '2 personas máx.';
    if (sumPrice)   sumPrice.textContent   = `$${fmt(pricePerNight)} ARS`;
    if (sumTotal)   sumTotal.textContent   = `$${fmt(total)}`;
    if (sumName)    sumName.textContent    = booking.name;
    if (sumContact) sumContact.textContent = booking.email || booking.phone;

    // Armar link de WhatsApp
    if (btnWa) {
      const waConfig = getConfig();
      const waNumber = waConfig.waNumber || '5492944000000'; // Reemplazar con número real
      const msg = encodeURIComponent(
        `Hola! Quiero reservar:\n` +
        `• Habitación: ${roomLabel}\n` +
        `• Llegada: ${fmtDate(booking.checkIn)}\n` +
        `• Salida: ${fmtDate(booking.checkOut)}\n` +
        `• Noches: ${nights}\n` +
        `• Huéspedes: ${booking.roomType === 'dorm' ? booking.guests : 1}\n` +
        `• Total estimado: $${fmt(total)} ARS\n` +
        `• Nombre: ${booking.name}\n` +
        `• Contacto: ${booking.email || booking.phone}`
      );
      btnWa.href = `https://wa.me/${waNumber}?text=${msg}`;
      if (btnWaSuccess) btnWaSuccess.href = btnWa.href;
    }
  }

  // ── Confirmar reserva ───────────────────────────────────
  // Importante: "Confirmar" ahora también dispara el envío por WhatsApp
  // como parte de la misma acción. Antes, confirmar solo guardaba la
  // reserva en este navegador y el mensaje de éxito hacía creer que el
  // hostel ya había sido notificado — en realidad nadie se entera salvo
  // que además se haga clic en un botón separado. Unificamos ambos pasos
  // para que la notificación real (WhatsApp) siempre se dispare.

  if (btnConfirm) {
    btnConfirm.addEventListener('click', () => {
      btnConfirm.disabled     = true;
      btnConfirm.textContent  = 'Guardando…';

      const { nights, pricePerNight, total } = calcTotal(
        booking.roomType, booking.checkIn, booking.checkOut, booking.guests
      );

      const saved = saveReservation({
        roomType:      booking.roomType,
        checkIn:       booking.checkIn,
        checkOut:      booking.checkOut,
        nights,
        guests:        booking.roomType === 'dorm' ? booking.guests : 1,
        pricePerNight,
        totalPrice:    total,
        guestName:     booking.name,
        guestEmail:    booking.email,
        guestPhone:    booking.phone,
        notes:         booking.notes,
      });

      setTimeout(() => {
        if (saved && success) {
          const codeEl = success.querySelector('.booking-success__code');
          if (codeEl) codeEl.textContent = saved.code;

          // Disparar el envío por WhatsApp como parte de "confirmar".
          // Si el navegador bloquea el popup, el botón de respaldo
          // dentro de la pantalla de éxito sigue disponible.
          if (btnWa?.href) {
            const waWindow = window.open(btnWa.href, '_blank', 'noopener,noreferrer');
            if (!waWindow) {
              showError('Guardamos tu reserva, pero no pudimos abrir WhatsApp automáticamente. Usá el botón de abajo para enviarla.');
            }
          }

          wizard.style.display = 'none';
          success.classList.add('visible');
        } else if (!saved) {
          btnConfirm.disabled    = false;
          btnConfirm.textContent = 'Confirmar y enviar por WhatsApp';
          showError('No se pudo guardar la reserva. Por favor intentá de nuevo o usá el botón de WhatsApp.');
        }
      }, 800);
    });
  }


  // ── Nueva reserva (reset) ───────────────────────────────

  const resetBtn = wizard.parentElement?.querySelector('#booking-new');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      booking.roomType = 'dorm';
      booking.checkIn  = null;
      booking.checkOut = null;
      booking.guests   = 1;
      booking.name     = '';
      booking.email    = '';
      booking.phone    = '';
      booking.notes    = '';

      fName && (fName.value = '');
      fEmail && (fEmail.value = '');
      fPhone && (fPhone.value = '');
      fNotes && (fNotes.value = '');

      roomOptions.forEach((o, i) => o.classList.toggle('selected', i === 0));

      cal?.reset();
      updateDateSummary();

      success?.classList.remove('visible');
      wizard.style.display = '';
      goToStep(1);
    });
  }

  // ── Arrancar en paso 1 ──────────────────────────────────

  goToStep(1);
}
