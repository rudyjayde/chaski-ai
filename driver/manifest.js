/* ============================================================
   driver/manifest.js — Manifiesto de Pasajeros
   Chaski AI v2.0
============================================================ */
'use strict';

/* ─── 1. AUTENTICACIÓN ─────────────────────────────────── */
const user = JSON.parse(localStorage.getItem('chaski_user') || 'null');
if (!user || !user.username) window.location.href = '../login.html';

/* Datos extendidos del conductor */
const DRIVER_DATA = {
  'eloy.mamani':     { name:'Eloy Mamani',    vehicle:'001', plate:'PUN-001', company:'Virgen de Fátima',       license:'AII-b',  licenseNum:'Q40123456', queuePos:5, model:'Toyota Hiace 2022', capacity:15 },
  'jose.quispe':     { name:'José Quispe',     vehicle:'002', plate:'PUN-002', company:'Surandino',              license:'AIII-b', licenseNum:'Q40234567', queuePos:2, model:'Toyota Hiace 2021', capacity:15 },
  'abraham.morales': { name:'Abraham Morales', vehicle:'003', plate:'PUN-003', company:'San Francisco de Borja', license:'AII-b',  licenseNum:'Q40345678', queuePos:3, model:'Toyota Hiace 2020', capacity:15 },
  'juan.perez':      { name:'Juan Pérez',      vehicle:'004', plate:'PUN-004', company:'Virgen de Fátima II',   license:'AIII-b', licenseNum:'Q40456789', queuePos:4, model:'Toyota Hiace 2022', capacity:15 },
  'carlos.ticona':   { name:'Carlos Ticona',   vehicle:'005', plate:'PUN-005', company:'San Miguel',             license:'AII-b',  licenseNum:'Q40567890', queuePos:6, model:'Toyota Hiace 2019', capacity:15 },
};

let driver = DRIVER_DATA[user.username] || { name: user.name||'Conductor', vehicle:'001', plate:'PUN-001', company:'—', license:'AII-b', licenseNum:'—', queuePos:1, model:'Toyota Hiace', capacity:15 };

/* Cargar perfil personalizado si existe */
const savedProfile = JSON.parse(localStorage.getItem('chaski_profile_' + user.username) || 'null');
if (savedProfile) driver = { ...driver, ...savedProfile };

/* ─── 2. POBLAR CABECERA ──────────────────────────────── */
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setAvatar(src) {
  ['sidebarAvatar','profileAvatarImg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.src = src;
  });
}

setText('sidebarDriverName', driver.name);
setText('sidebarVehicle',    `Cód. ${driver.vehicle} · ${driver.plate}`);
setText('sidebarCompany',    driver.company);
setText('mhcDriver',         driver.name);
setText('mhcCompany',        driver.company);
setText('mhcCode',           driver.vehicle);
setText('mhcPlate',          driver.plate);
setText('mhcLicense',        driver.license);

const savedAvatar = localStorage.getItem('chaski_avatar_' + user.username);
if (savedAvatar) setAvatar(savedAvatar);

/* ─── 3. NÚMERO DE MANIFIESTO ─────────────────────────── */
const now = new Date();
const manifestNum = `MAN-${now.getFullYear()}-` +
  `${String(now.getMonth()+1).padStart(2,'0')}` +
  `${String(now.getDate()).padStart(2,'0')}-` +
  `${String(Math.floor(Math.random()*999)+1).padStart(3,'0')}`;
setText('manifestNum', manifestNum);

const dtInput  = document.getElementById('departureDT');
const localISO = new Date(now.getTime() - now.getTimezoneOffset()*60000).toISOString().slice(0,16);
if (dtInput) dtInput.value = localISO;

/* ─── 4. RELOJ ──────────────────────────────────────────── */
setInterval(() => {
  const el = document.getElementById('clock');
  if (el) el.textContent = new Date().toLocaleTimeString('es-PE',{hour:'2-digit',minute:'2-digit'});
}, 1000);

/* ─── 5. SIDEBAR TOGGLE ─────────────────────────────────── */
document.getElementById('sidebarToggle')?.addEventListener('click', () => {
  document.getElementById('sidebar')?.classList.toggle('open');
});

/* ─── 6. PASAJEROS ──────────────────────────────────────── */
let passengers  = [];
let selectedPay = 'cash';
let nextSeat    = 1;

function selectPay(btn) {
  document.querySelectorAll('.pmb').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPay = btn.dataset.pay;
}
window.selectPay = selectPay;

function registerPassenger() {
  const dni    = document.getElementById('pfDni')?.value.trim();
  const name   = document.getElementById('pfName')?.value.trim();
  const origin = document.getElementById('pfOrigin')?.value;
  const dest   = document.getElementById('pfDest')?.value;
  const seat   = parseInt(document.getElementById('pfSeat')?.value) || nextSeat;
  const fare   = parseFloat(document.getElementById('pfFare')?.value) || 7.00;

  if (!dni || dni.length < 8) { shakeField('pfDni');  showToast('⚠️ DNI debe tener 8 dígitos', 'error'); return; }
  if (!name)                  { shakeField('pfName'); showToast('⚠️ Ingresa el nombre del pasajero', 'error'); return; }

  const pax = { id:Date.now(), num:passengers.length+1, dni, name, origin, dest, seat, pay:selectedPay, fare };
  passengers.push(pax);
  renderPassengerRow(pax);
  updateSummary();

  document.getElementById('pfDni').value  = '';
  document.getElementById('pfName').value = '';
  nextSeat = seat + 1;
  document.getElementById('pfSeat').value = nextSeat;
  setText('nextSeatNum', nextSeat);
  document.getElementById('pfDni').focus();
  document.getElementById('pfDniCheck').textContent = '';

  showToast(`✅ Pasajero #${pax.num} registrado`);
}
window.registerPassenger = registerPassenger;

function renderPassengerRow(pax) {
  const listEl  = document.getElementById('passengerList');
  const emptyEl = document.getElementById('plcEmpty');
  if (!listEl) return;
  if (emptyEl) emptyEl.style.display = 'none';

  const payLabels = { cash:'Efectivo', yape:'Yape', plin:'Plin', digital:'Digital' };
  const div = document.createElement('div');
  div.className = 'pax-row new-entry';
  div.id = `pax-${pax.id}`;
  div.innerHTML = `
    <span class="pax-num">${pax.num}</span>
    <span class="pax-dni">${pax.dni}</span>
    <span class="pax-name">${pax.name}</span>
    <span class="pax-route"><i class="fas fa-arrow-right"></i> ${pax.origin} → ${pax.dest}</span>
    <span class="pax-seat">Asiento ${pax.seat}</span>
    <span class="pax-pay ${pax.pay}">${payLabels[pax.pay]||pax.pay}</span>
    <span class="pax-fare">S/${pax.fare.toFixed(2)}</span>
    <button class="pax-del" onclick="deletePassenger(${pax.id})" title="Eliminar">
      <i class="fas fa-times"></i>
    </button>`;
  listEl.appendChild(div);
  div.scrollIntoView({ behavior:'smooth', block:'nearest' });
}

function deletePassenger(id) {
  passengers = passengers.filter(p => p.id !== id);
  document.getElementById(`pax-${id}`)?.remove();
  passengers.forEach((p, i) => {
    p.num = i + 1;
    const numEl = document.querySelector(`#pax-${p.id} .pax-num`);
    if (numEl) numEl.textContent = i + 1;
  });
  updateSummary();
  if (passengers.length === 0) document.getElementById('plcEmpty').style.display = '';
}
window.deletePassenger = deletePassenger;

function clearAllPassengers() {
  if (!passengers.length) return;
  if (!confirm(`¿Eliminar los ${passengers.length} pasajeros?`)) return;
  passengers = [];
  document.getElementById('passengerList').innerHTML = '';
  document.getElementById('plcEmpty').style.display = '';
  nextSeat = 1;
  document.getElementById('pfSeat').value = 1;
  setText('nextSeatNum', 1);
  updateSummary();
}
window.clearAllPassengers = clearAllPassengers;

function updateSummary() {
  const total   = passengers.length;
  const cash    = passengers.filter(p => p.pay === 'cash').length;
  const digital = passengers.filter(p => p.pay !== 'cash').length;
  const revenue = passengers.reduce((s,p) => s + p.fare, 0);
  setText('passengerCount', total);
  setText('sumTotal',    total);
  setText('sumCash',     cash);
  setText('sumDigital',  digital);
  setText('sumRevenue',  `S/ ${revenue.toFixed(2)}`);
}

/* ─── 7. YAPE QR ─────────────────────────────────────────── */
function toggleYapePanel() {
  const body    = document.getElementById('yapeBody');
  const chevron = document.getElementById('yapeChevron');
  const open    = body.style.display === 'none';
  body.style.display = open ? '' : 'none';
  chevron.classList.toggle('open', open);
}
window.toggleYapePanel = toggleYapePanel;

function loadQrImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('yapeQrBox').innerHTML = `<img src="${e.target.result}" alt="QR Yape">`;
    updateYapeStatus(true);
    localStorage.setItem('chaski_yape_qr_' + user.username, e.target.result);
  };
  reader.readAsDataURL(file);
}
window.loadQrImage = loadQrImage;

function generateYapeQr() {
  const phone = document.getElementById('yapePhone')?.value.replace(/\s+/g,'') || '';
  if (!phone || phone.replace(/\D/g,'').length < 9) {
    showToast('⚠️ Ingresa tu número de celular', 'error');
    document.getElementById('yapePhone')?.focus();
    return;
  }
  const box   = document.getElementById('yapeQrBox');
  box.innerHTML = '';
  const clean = phone.replace('+51','').replace(/\D/g,'');
  try {
    new QRCode(box, { text:`https://www.yape.com.pe/${clean}`, width:130, height:130,
      colorDark:'#000000', colorLight:'#ffffff', correctLevel:QRCode.CorrectLevel.M });
    updateYapeStatus(true);
    showToast('✅ QR generado exitosamente');
    saveYapePhone();
  } catch(e) {
    box.innerHTML = '<i class="fas fa-exclamation-triangle" style="color:var(--danger)"></i><span>Error</span>';
  }
}
window.generateYapeQr = generateYapeQr;

function saveYapePhone() {
  const phone = document.getElementById('yapePhone')?.value.trim();
  const name  = document.getElementById('yapeName')?.value.trim();
  if (phone) localStorage.setItem('chaski_yape_phone_' + user.username, phone);
  if (name)  localStorage.setItem('chaski_yape_name_'  + user.username, name);
}
window.saveYapePhone = saveYapePhone;

function updateYapeStatus(ok) {
  const st = document.getElementById('yapeStatus');
  if (!st) return;
  st.textContent = ok ? 'Configurado' : 'No configurado';
  st.classList.toggle('configured', ok);
}

/* Cargar Yape guardado */
(function() {
  const phone = localStorage.getItem('chaski_yape_phone_' + user.username);
  const name  = localStorage.getItem('chaski_yape_name_'  + user.username);
  const qrImg = localStorage.getItem('chaski_yape_qr_'    + user.username);
  if (phone) document.getElementById('yapePhone').value = phone;
  if (name)  document.getElementById('yapeName').value  = name;
  if (qrImg) { document.getElementById('yapeQrBox').innerHTML = `<img src="${qrImg}" alt="QR">`; updateYapeStatus(true); }
})();

/* ─── 8. GUARDAR MANIFIESTO ─────────────────────────────── */
function saveManifest() {
  if (!passengers.length) { showToast('⚠️ Registra al menos un pasajero', 'error'); return; }
  const routeEl  = document.getElementById('routeField');
  const routeTxt = routeEl.selectedOptions[0].text;
  const dep      = document.getElementById('departureDT').value;
  const revenue  = passengers.reduce((s,p) => s+p.fare, 0);

  const manifest = {
    id:manifestNum, driver:driver.name, company:driver.company,
    vehicle:driver.vehicle, plate:driver.plate, license:driver.license,
    route:routeEl.value, routeText:routeTxt, departure:dep,
    passengers, passengerCount:passengers.length,
    cashCount:passengers.filter(p=>p.pay==='cash').length,
    digitalCount:passengers.filter(p=>p.pay!=='cash').length,
    revenue, status:'saved', createdAt:new Date().toISOString(),
  };

  const manifests = JSON.parse(localStorage.getItem('chaski_manifests') || '[]');
  manifests.unshift(manifest);
  localStorage.setItem('chaski_manifests', JSON.stringify(manifests));

  /* Notificar admin */
  const notifs = JSON.parse(localStorage.getItem('chaski_admin_notifs') || '[]');
  notifs.unshift({
    id:Date.now(), type:'manifest', icon:'fa-file-invoice',
    msg:`Nuevo manifiesto de ${driver.name} · ${routeTxt} · ${passengers.length} pasajeros`,
    sub:`${driver.company} · Unidad ${driver.vehicle} · ${new Date().toLocaleString('es-PE')}`,
    read:false, at:new Date().toISOString(),
  });
  localStorage.setItem('chaski_admin_notifs', JSON.stringify(notifs));

  showToast(`✅ Manifiesto ${manifestNum} guardado y notificado al admin`);
}
window.saveManifest = saveManifest;

/* ─── 9. EXPORTAR PDF ───────────────────────────────────── */
function exportPDF() {
  if (!passengers.length) { showToast('⚠️ No hay pasajeros registrados', 'error'); return; }

  const route    = document.getElementById('routeField').selectedOptions[0].text;
  const dep      = document.getElementById('departureDT').value;
  const fecha    = dep ? new Date(dep).toLocaleDateString('es-PE', {day:'2-digit', month:'2-digit', year:'numeric'}) : '—';
  const routeDisplay = route.replace(' → ', ' - ').toUpperCase();

  const totalEfectivo = passengers.filter(p => p.pay === 'cash').reduce((s,p) => s + p.fare, 0);
  const totalYape     = passengers.filter(p => p.pay === 'yape').reduce((s,p) => s + p.fare, 0);
  const totalPlin     = passengers.filter(p => p.pay === 'plin').reduce((s,p) => s + p.fare, 0);
  const totalGeneral  = passengers.reduce((s,p) => s + p.fare, 0);

  const payLabel = { cash:'Efectivo', yape:'Yape', plin:'Plin', digital:'Otro' };

  const passengerRows = passengers.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${p.name}</td>
      <td>${p.dni}</td>
      <td>—</td>
      <td style="color:#1b96d0">${p.origin.toUpperCase()} - ${p.dest.toUpperCase()}</td>
      <td>${payLabel[p.pay] || p.pay}</td>
      <td>S/ ${p.fare.toFixed(2)}</td>
    </tr>`).join('');

  const driverModel    = driver.model    || 'Toyota Hiace';
  const driverCapacity = driver.capacity || 15;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Manifiesto de pasajeros</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:Arial,Helvetica,sans-serif; font-size:11px; color:#222; padding:24px 30px; }
  .header { text-align:center; margin-bottom:18px; padding-bottom:10px; border-bottom:2px solid #1b96d0; }
  .header h1 { font-size:26px; font-weight:900; letter-spacing:2px; margin-bottom:2px; }
  .header h2 { font-size:14px; font-weight:700; margin-bottom:3px; }
  .header h3 { font-size:11px; font-weight:600; color:#555; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:5px 40px; margin:14px 0 18px; }
  .info-row { display:flex; gap:6px; align-items:baseline; margin-bottom:4px; }
  .info-label { color:#444; min-width:130px; font-size:10.5px; }
  .info-value { font-weight:bold; color:#1b96d0; font-size:10.5px; }
  table { width:100%; border-collapse:collapse; margin:14px 0 10px; font-size:10px; }
  thead tr { border-bottom:2px solid #333; }
  th { padding:6px 4px; text-align:left; font-size:10px; font-weight:bold; color:#333; }
  td { padding:5px 4px; border-bottom:1px solid #e0e0e0; }
  tbody tr:nth-child(even) { background:#f9f9f9; }
  .totales { margin:12px 0 24px; }
  .totales p { margin:3px 0; font-size:11px; }
  .total-general { font-size:12px; font-weight:bold; border-top:1px solid #aaa; padding-top:4px; margin-top:4px !important; }
  .signatures { display:flex; justify-content:space-around; margin-top:50px; margin-bottom:20px; }
  .sig-box { text-align:center; width:180px; }
  .sig-line { border-top:1px solid #333; margin-bottom:8px; }
  .sig-label { font-size:11px; color:#1b96d0; }
  .sunat { text-align:center; font-size:10px; color:#555; font-style:italic; border-top:1px solid #ddd; padding-top:10px; margin-top:8px; }
  @media print { body { padding:10px 15px; } @page { margin:10mm; } }
</style>
</head>
<body>
<div class="header">
  <h1>CHASKI AI</h1>
  <h2>Manifiesto de Pasajeros</h2>
  <h3>Asociacion ATIPCAR</h3>
</div>
<div class="info-grid">
  <div>
    <div class="info-row"><span class="info-label">Empresa:</span><span class="info-value">${driver.company}</span></div>
    <div class="info-row"><span class="info-label">Licencia:</span><span class="info-value">${driver.license}</span></div>
    <div class="info-row"><span class="info-label">Placa:</span><span class="info-value">${driver.plate}</span></div>
    <div class="info-row"><span class="info-label">Capacidad:</span><span class="info-value">${driverCapacity} pasajeros</span></div>
    <div class="info-row"><span class="info-label">Fecha:</span><span class="info-value">${fecha}</span></div>
  </div>
  <div>
    <div class="info-row"><span class="info-label">Conductor:</span><span class="info-value">${driver.name}</span></div>
    <div class="info-row"><span class="info-label">Codigo de vehiculo:</span><span class="info-value">${driver.vehicle}</span></div>
    <div class="info-row"><span class="info-label">Modelo:</span><span class="info-value">${driverModel}</span></div>
    <div class="info-row"><span class="info-label">Ruta:</span><span class="info-value">${routeDisplay}</span></div>
    <div class="info-row"><span class="info-label">Pasajeros registrados:</span><span class="info-value">${passengers.length}</span></div>
  </div>
</div>
<table>
  <thead>
    <tr><th>No.</th><th>Pasajero</th><th>DNI</th><th>Edad</th><th>Ruta</th><th>Pago</th><th>Monto</th></tr>
  </thead>
  <tbody>${passengerRows}</tbody>
</table>
<div class="totales">
  <p><strong>Total Efectivo:</strong> S/ ${totalEfectivo.toFixed(2)}</p>
  <p><strong>Total Yape:</strong> S/ ${totalYape.toFixed(2)}</p>
  <p><strong>Total Plin:</strong> S/ ${totalPlin.toFixed(2)}</p>
  <p class="total-general"><strong>Total General:</strong> S/ ${totalGeneral.toFixed(2)}</p>
</div>
<div class="signatures">
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">Firma del conductor</div>
  </div>
  <div class="sig-box">
    <div class="sig-line"></div>
    <div class="sig-label">Control / Supervisor</div>
  </div>
</div>
<div class="sunat">
  Manifiesto listo para la supervisión de SUNAT y SUTRAN
</div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) { showToast('⚠️ Permite ventanas emergentes para generar el PDF', 'error'); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
  showToast('✅ Manifiesto listo para imprimir');
}
window.exportPDF = exportPDF;

/* ─── 10. WHATSAPP ──────────────────────────────────────── */
function shareWhatsApp() {
  const route   = document.getElementById('routeField').selectedOptions[0].text;
  const dep     = document.getElementById('departureDT').value;
  const revenue = passengers.reduce((s,p) => s+p.fare, 0);
  const cash    = passengers.filter(p=>p.pay==='cash').length;
  const digital = passengers.filter(p=>p.pay!=='cash').length;

  let msg = `🚌 *CHASKI AI — MANIFIESTO*\n🏢 ATIPCAR · ${driver.company}\n`;
  msg += `━━━━━━━━━━━━━━━━\n📋 ${manifestNum}\n`;
  msg += `👤 ${driver.name} · Unidad ${driver.vehicle}\n`;
  msg += `🛣️ ${route}\n⏰ ${dep ? new Date(dep).toLocaleString('es-PE') : '—'}\n`;
  msg += `━━━━━━━━━━━━━━━━\n`;
  passengers.forEach((p,i) => {
    const ic = {cash:'💵',yape:'📲',plin:'📱',digital:'💳'}[p.pay]||'💳';
    msg += `${i+1}. ${p.name} · DNI ${p.dni} · Asiento ${p.seat} · ${ic} S/${p.fare.toFixed(2)}\n`;
  });
  msg += `━━━━━━━━━━━━━━━━\n💵 Efectivo: ${cash}  📲 Digital: ${digital}\n`;
  msg += `💰 *Total: S/ ${revenue.toFixed(2)}*\n_CHASKI AI_`;
  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}
window.shareWhatsApp = shareWhatsApp;

/* ─── 11. PERFIL ─────────────────────────────────────────── */
function openProfileModal() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  document.getElementById('prfName').value       = driver.name;
  document.getElementById('prfPhone').value      = localStorage.getItem('chaski_yape_phone_' + user.username) || '';
  document.getElementById('prfLicense').value    = driver.license;
  document.getElementById('prfLicenseNum').value = driver.licenseNum || '';
  const av = localStorage.getItem('chaski_avatar_' + user.username);
  if (av) document.getElementById('profileAvatarImg').src = av;
  modal.classList.add('open');
}
window.openProfileModal = openProfileModal;

function closeProfileModal(event) {
  if (event && event.target !== document.getElementById('profileModal')) return;
  document.getElementById('profileModal')?.classList.remove('open');
}
window.closeProfileModal = closeProfileModal;

function saveProfile() {
  const name    = document.getElementById('prfName')?.value.trim();
  const license = document.getElementById('prfLicense')?.value;
  const licNum  = document.getElementById('prfLicenseNum')?.value.trim();
  if (!name) { showToast('⚠️ Ingresa tu nombre', 'error'); return; }
  driver.name = name; driver.license = license; driver.licenseNum = licNum;
  localStorage.setItem('chaski_profile_' + user.username, JSON.stringify({name, license, licenseNum:licNum}));
  setText('sidebarDriverName', name);
  setText('mhcDriver',  name);
  setText('mhcLicense', license);
  document.getElementById('profileModal')?.classList.remove('open');
  showToast('✅ Perfil actualizado');
}
window.saveProfile = saveProfile;

function changeAvatar(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    setAvatar(e.target.result);
    localStorage.setItem('chaski_avatar_' + user.username, e.target.result);
  };
  reader.readAsDataURL(file);
}
window.changeAvatar = changeAvatar;

/* ─── 12. HELPERS ─────────────────────────────────────────── */
function showToast(msg, type='success') {
  const t = document.getElementById('toastSuccess');
  const m = document.getElementById('toastMsg');
  if (!t || !m) return;
  m.textContent = msg;
  t.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--danger)';
  el.style.animation   = 'none';
  void el.offsetHeight;
  el.style.animation   = 'shake 0.35s ease';
  setTimeout(() => { el.style.animation = ''; el.style.borderColor = ''; }, 400);
}

function logout() {
  if (confirm('¿Cerrar sesión?')) {
    localStorage.removeItem('chaski_user');
    window.location.href = '../login.html';
  }
}
window.logout = logout;
