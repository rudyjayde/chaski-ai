'use strict';

(function () {
  const _s = JSON.parse(localStorage.getItem('chaski_user') || '{}');
  let _departedRoute = null; // ruta detectada cuando position === 'departed'

  function _dateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function returnInfo(route) {
    if (route === 'juli-puno') return { route: 'puno-juli', label: 'Puno → Juli', city: 'Puno' };
    if (route === 'puno-juli') return { route: 'juli-puno', label: 'Juli → Puno', city: 'Juli' };
    return { route: null, label: '—', city: 'destino' };
  }

  // ── Inyectar dialog HTML si no existe ya ──────────────────────
  function _ensureDialog() {
    if (document.getElementById('returnDialog')) return;
    const div = document.createElement('div');
    div.id = 'returnDialog';
    div.className = 'rd-overlay';
    div.innerHTML = `
      <div class="rd-modal">
        <div class="rd-check-icon"><i class="fas fa-check-circle"></i></div>
        <h3 class="rd-title">&#xA1;Llegaste a <span id="rdArrivedCity">destino</span>!</h3>
        <p class="rd-text">&#xBF;Quieres inscribirte ahora para el viaje de regreso?</p>
        <div class="rd-route-pill">
          <i class="fas fa-route"></i>
          <span id="rdReturnLabel">—</span>
        </div>
        <div class="rd-actions">
          <button id="rdConfirmBtn" class="rd-btn rd-btn-primary" onclick="window.registerForReturn()">
            <i class="fas fa-check"></i> S&#xED;, inscribirme
          </button>
          <button class="rd-btn rd-btn-secondary" onclick="window.closeReturnDialog()">
            Ahora no
          </button>
        </div>
      </div>`;
    document.body.appendChild(div);
  }

  // ── Renderizar banner ─────────────────────────────────────────
  function _renderBanner(tripId, routeSlug, routeText, startedAt, revenue) {
    const banner = document.getElementById('activeTripBanner');
    if (!banner) return;

    const { city } = returnInfo(routeSlug);
    const started  = startedAt
      ? new Date(startedAt).toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })
      : null;

    const sub = started
      ? `Salida: ${started} &middot; S/ ${parseFloat(revenue || 0).toFixed(2)} recaudados`
      : 'Confirma tu llegada para inscribirte al viaje de regreso';

    const tripArg = tripId ? `'${tripId}'` : 'null';

    banner.innerHTML = `
      <div class="atb-icon"><i class="fas fa-truck-moving"></i></div>
      <div class="atb-info">
        <strong>Viaje en curso — ${routeText || routeSlug}</strong>
        <span>${sub}</span>
      </div>
      <button class="atb-btn" onclick="window.arriveAtDestination(${tripArg}, ${parseFloat(revenue || 0)})">
        <i class="fas fa-map-marker-alt"></i> Llegu&#xE9; a ${city}
      </button>`;
    banner.style.display = 'flex';
  }

  // ── Muestra banner desde objeto trip de la BD ─────────────────
  window._showBannerFromDB = function (trip) {
    const banner = document.getElementById('activeTripBanner');
    if (!banner || banner.style.display !== 'none') return;

    const name = (trip.route_name || '').toLowerCase();
    let slug = 'juli-puno';
    if (name.includes('puno') && name.indexOf('puno') < name.indexOf('juli')) slug = 'puno-juli';

    const tripId  = trip.id || trip.trip_id;
    const revenue = parseFloat(trip.revenue) || 0;

    _departedRoute = slug;
    localStorage.setItem('chaski_active_trip_' + _s.username, JSON.stringify({
      trip_id:   tripId,
      revenue,
      route:     slug,
      routeText: trip.route_name || slug,
      startedAt: trip.start_time,
    }));

    _renderBanner(tripId, slug, trip.route_name || slug, trip.start_time, revenue);
  };

  // ── Carga el banner: localStorage → cola → trips ──────────────
  window.loadActiveTripBanner = async function () {
    _ensureDialog();

    // 1. Fast path: localStorage
    const stored = localStorage.getItem('chaski_active_trip_' + _s.username);
    if (stored) {
      let info;
      try { info = JSON.parse(stored); } catch { /* ignore */ }
      if (info?.trip_id) {
        try {
          const r    = await authFetch(`/api/trips/${info.trip_id}`);
          const trip = await r.json();
          if (r.ok && trip.status === 'active') {
            // Verificar que el conductor no esté ya en la cola de retorno
            // (evita re-mostrar el banner si ya llegó y se inscribió)
            const today    = _dateStr(new Date());
            const retRoute = returnInfo(info.route).route;
            let alreadyBack = false;
            try {
              const rr = await authFetch(`/api/queue?date=${today}&route=${retRoute}`);
              if (rr.ok) {
                const rd = await rr.json();
                alreadyBack = (rd.entries || []).some(e => e.username === _s.username);
              }
            } catch { /* ignorar */ }

            if (!alreadyBack) {
              _departedRoute = info.route;
              _renderBanner(info.trip_id, info.route, info.routeText, info.startedAt, info.revenue);
              return;
            }
            // Si ya está en el retorno, limpiar y no mostrar el banner viejo
            localStorage.removeItem('chaski_active_trip_' + _s.username);
            return;
          }
        } catch { /* ignore */ }
        localStorage.removeItem('chaski_active_trip_' + _s.username);
      }
    }

    // 2. Fallback: buscar en la cola de hoy
    try {
      const today = _dateStr(new Date());
      let driverId = null, foundEntry = null, foundRoute = null;

      for (const route of ['juli-puno', 'puno-juli']) {
        const r = await authFetch(`/api/queue?date=${today}&route=${route}`);
        if (!r.ok) continue;
        const d = await r.json();
        const e = (d.entries || []).find(e => e.username === _s.username);
        if (e?.driver_id) {
          driverId  = e.driver_id;
          foundEntry = e;
          foundRoute = route;
          break;
        }
      }

      if (!driverId) return;

      // 3. Si el conductor ya salió (departed), verificar si ya se inscribió al retorno
      if (foundEntry?.position === 'departed') {
        _departedRoute = foundRoute;
        const retRoute  = returnInfo(foundRoute).route;

        // Si ya está en la cola de retorno → ya confirmó llegada, no mostrar banner
        try {
          const rr = await authFetch(`/api/queue?date=${today}&route=${retRoute}`);
          if (rr.ok) {
            const rd = await rr.json();
            const alreadyBack = (rd.entries || []).some(e => e.username === _s.username);
            if (alreadyBack) return;
          }
        } catch { /* ignorar */ }

        const routeText = foundRoute === 'juli-puno' ? 'Juli → Puno' : 'Puno → Juli';

        // Intentar obtener trip_id (puede fallar si hay mismatch de driver_id en BD)
        let tripId = null;
        try {
          const r2    = await authFetch(`/api/trips?driver_id=${driverId}&limit=5`);
          if (r2.ok) {
            const trips = await r2.json();
            const active = Array.isArray(trips) ? trips.find(t => t.status === 'active') : null;
            tripId = active?.id || null;
          }
        } catch { /* ignorar — mostrar banner igual */ }

        _renderBanner(tripId, foundRoute, routeText, null, 0);
        return;
      }

      // 4. No salió aún pero puede haber un trip activo en BD
      const r2    = await authFetch(`/api/trips?driver_id=${driverId}&limit=10`);
      if (!r2.ok) return;
      const trips  = await r2.json();
      const active = Array.isArray(trips) ? trips.find(t => t.status === 'active') : null;
      if (active) window._showBannerFromDB(active);

    } catch (e) {
      console.warn('[trip-banner] error:', e);
    }
  };

  // ── Confirmar llegada a destino ───────────────────────────────
  window.arriveAtDestination = async function (tripId, revenue) {
    const btn = document.querySelector('.atb-btn');
    if (btn) {
      btn.disabled    = true;
      btn.innerHTML   = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
    }

    const stored = localStorage.getItem('chaski_active_trip_' + _s.username);
    let tripInfo = {};
    try { tripInfo = JSON.parse(stored) || {}; } catch { /* ignore */ }

    // Si no hay ruta en tripInfo, usar la detectada desde la cola
    if (!tripInfo.route && _departedRoute) tripInfo.route = _departedRoute;

    // Intentar finalizar el trip en BD (ignorar fallo — el conductor ya llegó)
    if (tripId) {
      try {
        await authFetch(`/api/trips/${tripId}/end`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ revenue }),
        });
      } catch (e) {
        console.warn('[arriveAtDestination] no se pudo cerrar el viaje en BD:', e.message);
      }
    }

    // Limpiar siempre, independientemente de si el API tuvo éxito
    localStorage.removeItem('chaski_active_trip_' + _s.username);

    // Notificar llegada al admin
    try {
      await authFetch('/api/arrivals', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          route:       tripInfo.route || _departedRoute,
          driver_name: _s.name || _s.username,
        }),
      });
    } catch { /* no bloquear el flujo si falla */ }

    window.showReturnDialog(tripInfo);
    if (typeof window._afterTripArrival === 'function') window._afterTripArrival();
  };

  let _retRoute = '';
  let _retLabel = '';

  window.showReturnDialog = function (tripInfo) {
    const banner = document.getElementById('activeTripBanner');
    if (banner) banner.style.display = 'none';

    const info = returnInfo(tripInfo.route);
    _retRoute = info.route;
    _retLabel = info.label;

    const cityEl  = document.getElementById('rdArrivedCity');
    const labelEl = document.getElementById('rdReturnLabel');
    if (cityEl)  cityEl.textContent  = info.city;
    if (labelEl) labelEl.textContent = info.label;
    document.getElementById('returnDialog')?.classList.add('open');
  };

  window.closeReturnDialog = function () {
    document.getElementById('returnDialog')?.classList.remove('open');
    const banner = document.getElementById('activeTripBanner');
    if (!banner) return;
    banner.innerHTML = `
      <div class="atb-icon" style="color:#10B981"><i class="fas fa-check-circle"></i></div>
      <div class="atb-info">
        <strong>Viaje completado</strong>
        <span>Llegada registrada correctamente</span>
      </div>`;
    banner.style.display = 'flex';
    setTimeout(() => { banner.style.display = 'none'; }, 4000);
  };

  window.registerForReturn = async function () {
    if (!_retRoute) return;
    const btn = document.getElementById('rdConfirmBtn');
    if (btn) {
      btn.disabled  = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Inscribiendo...';
    }

    try {
      const res  = await authFetch('/api/queue/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          driver_id:  _s.id,
          route:      _retRoute,
          queue_date: _dateStr(new Date()),
        }),
      });
      const data = await res.json();
      // Solo cerrar el dialog (sin tocar el banner) para que _showReturnSuccess
      // pueda mostrar el mensaje de éxito sin que un timer previo lo oculte
      document.getElementById('returnDialog')?.classList.remove('open');
      if (res.ok && data.ok) {
        window._showReturnSuccess(data.entry?.turn_number, _retLabel);
      } else {
        window.closeReturnDialog();
        alert(data.error || 'No se pudo inscribir. Ve a Cola de Salida.');
      }
    } catch (e) {
      console.error('[registerForReturn]', e);
      window.closeReturnDialog();
      alert('Error de conexi\xF3n. Ve a Cola de Salida para inscribirte.');
    }
  };

  window._showReturnSuccess = function (turn, label) {
    const banner = document.getElementById('activeTripBanner');
    if (!banner) return;
    banner.innerHTML = `
      <div class="atb-icon" style="color:#6366F1"><i class="fas fa-list-ol"></i></div>
      <div class="atb-info">
        <strong>&#xA1;Inscrito para el regreso!</strong>
        <span>${label} &middot; Turno #${turn || '?'} asignado</span>
      </div>
      <a href="queue.html" class="atb-btn" style="background:#6366F1;text-decoration:none;color:#fff">
        <i class="fas fa-eye"></i> Ver mi turno
      </a>`;
    banner.style.display = 'flex';
    setTimeout(() => { banner.style.display = 'none'; }, 10000);
  };

})();
