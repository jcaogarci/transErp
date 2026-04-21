// ============================================================
// TransERP — Frontend Application JS
// ============================================================

// Auto-detect API URL: same origin in production, localhost in dev
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : '/api';

let TOKEN = localStorage.getItem('erp_token') || '';
let USER = JSON.parse(localStorage.getItem('erp_user') || 'null');
let currentPage = 'dashboard';

// Cache
let _vehiculos = [], _conductores = [], _clientes = [], _expediciones = [], _facturas = [], _sustancias = [];

// ============================================================
// HTTP
// ============================================================
async function api(method, path, body) {
  try {
    const res = await fetch(API + path, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error del servidor');
    return data.data !== undefined ? data.data : data;
  } catch (e) {
    if (e.message.includes('Token')) { logout(); return null; }
    toast(e.message, 'err');
    throw e;
  }
}

const GET = (p) => api('GET', p);
const POST = (p, b) => api('POST', p, b);
const PUT = (p, b) => api('PUT', p, b);
const PATCH = (p, b) => api('PATCH', p, b);
const DEL = (p) => api('DELETE', p);

// ============================================================
// AUTH
// ============================================================
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass = document.getElementById('l-pass').value;
  const errEl = document.getElementById('login-err');
  const btn = document.getElementById('login-btn');
  errEl.style.display = 'none';
  if (!email || !pass) { errEl.textContent = 'Rellena email y contraseña'; errEl.style.display = ''; return; }
  btn.textContent = 'Entrando...'; btn.disabled = true;
  try {
    const data = await fetch(API + '/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: pass })
    });
    const json = await data.json();
    if (!data.ok) { errEl.textContent = json.error || 'Error al iniciar sesión'; errEl.style.display = ''; return; }
    TOKEN = json.data.token; USER = json.data.user;
    localStorage.setItem('erp_token', TOKEN);
    localStorage.setItem('erp_user', JSON.stringify(USER));
    showApp();
  } catch (e) {
    errEl.textContent = 'No se pudo conectar al servidor. Verifica la URL de la API.'; errEl.style.display = '';
  } finally { btn.textContent = 'Entrar'; btn.disabled = false; }
}

function logout() {
  TOKEN = ''; USER = null;
  localStorage.removeItem('erp_token'); localStorage.removeItem('erp_user');
  document.getElementById('app').classList.remove('show');
  document.getElementById('login-screen').style.display = 'flex';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('show');
  if (USER) {
    document.getElementById('sb-av').textContent = USER.nombre.slice(0,2).toUpperCase();
    document.getElementById('sb-name').textContent = USER.nombre;
    document.getElementById('sb-role').textContent = USER.rol;
  }
  init();
}

// ============================================================
// INIT
// ============================================================
async function init() {
  await loadConfig();
  await loadDashboard();
  await loadAlertaBadge();
}

// ============================================================
// NAVIGATION
// ============================================================
const pageTitles = {
  dashboard:'Dashboard', expediciones:'Expediciones', flota:'Gestión de flota',
  conductores:'Conductores', adr:'Sustancias ADR', rutas:'Rutas',
  clientes:'Clientes', facturacion:'Facturación', alertas:'Alertas',
  informes:'Informes', config:'Configuración'
};
const mainBtns = {
  dashboard:'+ Nueva expedición', expediciones:'+ Nueva expedición', flota:'+ Añadir vehículo',
  conductores:'+ Añadir conductor', clientes:'+ Nuevo cliente', facturacion:'+ Emitir factura',
  adr:'+ Nueva sustancia ADR', informes:'📊 Actualizar'
};
const mainActs = {
  dashboard: () => openExpModal(), expediciones: () => openExpModal(),
  flota: () => openVehModal(), conductores: () => openCondModal(),
  clientes: () => openCliModal(), facturacion: () => openFacModal(),
  adr: () => openSustModal(), informes: () => loadInformes()
};

function goTo(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if (el) el.classList.add('active');
  else document.querySelectorAll('.nb').forEach(b => { if(b.getAttribute('data-page')===id) b.classList.add('active'); });
  document.getElementById('page-title').textContent = pageTitles[id] || id;
  const btn = document.getElementById('main-btn');
  if (mainBtns[id]) { btn.textContent = mainBtns[id]; btn.style.display = ''; }
  else btn.style.display = 'none';
  currentPage = id;
  loadPageContent(id);
}

function mainAction() { if (mainActs[currentPage]) mainActs[currentPage](); }

async function loadPageContent(id) {
  if (id === 'dashboard') await loadDashboard();
  else if (id === 'expediciones') await loadExp();
  else if (id === 'flota') await loadFlota();
  else if (id === 'conductores') await loadCond();
  else if (id === 'adr') await loadADR();
  else if (id === 'rutas') await loadRutas();
  else if (id === 'clientes') await loadCli();
  else if (id === 'facturacion') await loadFac();
  else if (id === 'alertas') await loadAlertas();
  else if (id === 'informes') await loadInformes();
  else if (id === 'config') await loadConfig();
}

// ============================================================
// UTILS
// ============================================================
function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.background = type === 'err' ? '#a32d2d' : type === 'warn' ? '#854f0b' : '#1c1c1a';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3200);
}
function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('es-ES', {day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmt(n) { return new Intl.NumberFormat('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2}).format(+n||0); }
function today() { return new Date().toISOString().split('T')[0]; }
function diffDays(d) { if (!d) return 9999; return Math.round((new Date(d) - new Date()) / 86400000); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openModal(id) { document.getElementById(id).classList.add('open'); }

function estadoBadge(e) {
  const map = { 'En ruta':'b-blue','Cargando':'b-amber','Planificada':'b-purple','Entregada':'b-green',
    'Incidencia':'b-red','Cancelada':'b-gray','Disponible':'b-green','Mantenimiento':'b-amber',
    'Bloqueado':'b-red','Activo':'b-green','Inactivo':'b-gray','Riesgo moroso':'b-amber',
    'Pendiente':'b-amber','Enviada':'b-blue','Cobrada':'b-green','Vencida':'b-red','Baja':'b-gray','Vacaciones':'b-purple' };
  return `<span class="badge ${map[e]||'b-gray'}">${e||'—'}</span>`;
}
function tipoBadge(t) {
  const map = {'ADR':'b-red','Frigorífico':'b-amber','General':'b-gray','Granel sólido':'b-green','Granel líquido':'b-purple','Sobredimensionada':'b-blue'};
  return t ? `<span class="badge ${map[t]||'b-gray'}">${t}</span>` : '—';
}

function itvBadge(date, dias = 30) {
  if (!date) return '<span class="badge b-gray">Sin fecha</span>';
  const d = diffDays(date);
  if (d < 0) return `<span class="badge b-red">VENCIDA</span>`;
  if (d <= dias) return `<span class="badge b-amber">${fmtDate(date)}</span>`;
  return `<span class="badge b-green">${fmtDate(date)}</span>`;
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const d = await GET('/dashboard');
    if (!d) return;
    document.getElementById('dash-kpis').innerHTML = `
      <div class="kpi"><div class="kpi-lbl">Expediciones activas</div><div class="kpi-val">${d.kpis.expedicionesActivas}</div><div class="kpi-delta">En ruta + cargando</div></div>
      <div class="kpi"><div class="kpi-lbl">Vehículos en ruta</div><div class="kpi-val">${d.kpis.vehiculosEnRuta}</div></div>
      <div class="kpi"><div class="kpi-lbl">Facturación del mes</div><div class="kpi-val">€ ${(d.kpis.facturacionMes/1000).toFixed(1)}K</div></div>
      <div class="kpi"><div class="kpi-lbl">Alertas activas</div><div class="kpi-val" style="${d.kpis.alertasPendientes>0?'color:var(--red)':''}">${d.kpis.alertasPendientes}</div></div>`;

    const tbody = document.getElementById('dash-exp-tbody');
    tbody.innerHTML = d.expedicionesRecientes.length
      ? d.expedicionesRecientes.map(x => `<tr onclick="showExpDetalle('${x.id}')" style="cursor:pointer">
          <td><strong>${x.referencia}</strong></td><td>${x.origen}→${x.destino}</td>
          <td>${tipoBadge(x.tipo_carga)}</td><td>${estadoBadge(x.estado)}</td></tr>`).join('')
      : `<tr><td colspan="4" class="tbl-empty">Sin expediciones — <button class="btn btn-sm btn-primary" onclick="openExpModal()">Crear primera</button></td></tr>`;

    // Flota
    const colors = {'Tráiler estándar':'#185FA5','Cisterna ADR':'#a32d2d','Frigorífico':'#3b6d11','Furgón':'#854f0b'};
    document.getElementById('dash-flota').innerHTML = d.flota.map(f => `
      <div class="pbar-row"><div class="pbar-row-hdr"><span>${f.tipo}</span><span style="color:var(--t2)">${f.en_ruta}/${f.total} en ruta</span></div>
      <div class="pbar"><div class="pbar-fill" style="width:${f.total?Math.round(f.en_ruta/f.total*100):0}%;background:${colors[f.tipo]||'#888'}"></div></div></div>`).join('') ||
      '<p style="color:var(--t3);font-size:13px">No hay vehículos registrados</p>';

    // Chart
    const diasSemana = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const dias7 = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return{ds:d.toISOString().split('T')[0],lbl:diasSemana[d.getDay()],n:0};});
    d.semana.forEach(s=>{ const ds=s.dia?.split('T')[0]; const found=dias7.find(x=>x.ds===ds); if(found)found.n=parseInt(s.n); });
    const maxN = Math.max(...dias7.map(x=>x.n),1);
    document.getElementById('dash-chart').innerHTML = dias7.map((x,i)=>`<div class="bar-col" style="height:${Math.max(4,x.n/maxN*100)}%;background:${i===6?'var(--text)':'rgba(0,0,0,0.15)'}" title="${x.lbl}: ${x.n}"></div>`).join('');
    document.getElementById('dash-chart-lbl').innerHTML = dias7.map(x=>`<span>${x.lbl}</span>`).join('');
    document.getElementById('dash-stats').innerHTML = `<div class="stat-row"><span class="stat-lbl">Total semana</span><span class="stat-val">${dias7.reduce((s,x)=>s+x.n,0)} exp.</span></div>`;

    // Alertas en dashboard
    await loadAlertaBadge();
    await loadDashAlerts();
  } catch(e) {}
}

async function loadDashAlerts() {
  try {
    const alertas = await GET('/alertas');
    const div = document.getElementById('dash-alerts');
    if (!alertas?.length) { div.innerHTML = '<div class="alert a-green"><span>✅</span> Sin alertas activas.</div>'; return; }
    div.innerHTML = alertas.slice(0,5).map(a =>
      `<div class="alert ${a.nivel==='red'?'a-red':'a-amber'}"><span>${a.nivel==='red'?'🚨':'⚠️'}</span>
      <div><strong>${a.titulo}</strong><br><span style="font-size:11px">${a.descripcion}</span></div></div>`).join('') +
      (alertas.length>5?`<div style="font-size:12px;color:var(--t2);padding:5px 0">+${alertas.length-5} alertas más</div>`:'');
  } catch(e) {}
}

async function loadAlertaBadge() {
  try {
    const alertas = await GET('/alertas');
    const badge = document.getElementById('alert-badge');
    badge.textContent = alertas?.length || 0;
    badge.style.display = alertas?.length ? '' : 'none';
  } catch(e){}
}

// ============================================================
// EXPEDICIONES
// ============================================================
async function loadExp() {
  const q = document.getElementById('exp-q')?.value || '';
  const fe = document.getElementById('exp-fe')?.value || '';
  const ft = document.getElementById('exp-ft')?.value || '';
  let url = '/expediciones?limit=500';
  if (q) url += '&q=' + encodeURIComponent(q);
  if (fe) url += '&estado=' + encodeURIComponent(fe);
  if (ft) url += '&tipo=' + encodeURIComponent(ft);
  _expediciones = await GET(url) || [];
  document.getElementById('exp-cnt').textContent = `(${_expediciones.length})`;
  const tbody = document.getElementById('exp-tbody');
  tbody.innerHTML = _expediciones.length
    ? _expediciones.map(x => `<tr onclick="showExpDetalle('${x.id}')">
        <td><strong>${x.referencia}</strong></td>
        <td>${fmtDate(x.fecha_salida)}</td>
        <td>${x.cliente_nombre||'—'}</td>
        <td>${x.origen} → ${x.destino}</td>
        <td>${tipoBadge(x.tipo_carga)}${x.clase_adr?`<br><span style="font-size:10px;color:var(--red)">${x.clase_adr}</span>`:''}</td>
        <td>${x.vehiculo_matricula||'—'}</td>
        <td>${x.conductor_nombre||'—'}</td>
        <td>${estadoBadge(x.estado)}</td>
        <td>€ ${fmt(x.importe)}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="editExp('${x.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteExp('${x.id}','${x.referencia}')">🗑️</button>
        </td></tr>`).join('')
    : '<tr><td colspan="10" class="tbl-empty">No hay expediciones</td></tr>';
}

async function showExpDetalle(id) {
  const x = await GET('/expediciones/' + id);
  if (!x) return;
  document.getElementById('m-det-title').textContent = x.referencia;
  document.getElementById('m-det-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:13px;margin-bottom:16px">
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Cliente</div><strong>${x.cliente_nombre||'—'}</strong></div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Estado</div>${estadoBadge(x.estado)}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Fecha salida</div>${fmtDate(x.fecha_salida)}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Tipo de carga</div>${tipoBadge(x.tipo_carga)}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Trayecto</div>${x.origen} → ${x.destino}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Km estimados</div>${x.km_estimados ? x.km_estimados+' km' : '—'}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Vehículo</div>${x.vehiculo_matricula||'—'}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Conductor</div>${x.conductor_nombre||'—'}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Peso</div>${x.peso_kg ? Number(x.peso_kg).toLocaleString('es-ES')+' kg' : '—'}</div>
      <div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Importe</div><strong>€ ${fmt(x.importe)}</strong></div>
      ${x.clase_adr?`<div><div style="font-size:11px;color:var(--t2);margin-bottom:3px">Clase ADR</div><span class="badge b-red">${x.clase_adr}</span></div>`:''}
    </div>
    ${x.observaciones?`<div style="padding:11px;background:var(--s2);border-radius:var(--r);font-size:13px;margin-bottom:14px"><strong>Observaciones:</strong> ${x.observaciones}</div>`:''}
    <div style="padding-top:13px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:8px">CAMBIAR ESTADO</div>
      <div style="display:flex;gap:7px;flex-wrap:wrap">
        ${['Planificada','Cargando','En ruta','Entregada','Incidencia','Cancelada'].map(s=>
          `<button class="btn btn-sm ${s===x.estado?'btn-primary':''}" onclick="cambiarEstado('${x.id}','${s}')">${s}</button>`).join('')}
      </div>
    </div>`;
  document.getElementById('m-det-ftr').innerHTML = `
    <button class="btn" onclick="closeModal('m-det')">Cerrar</button>
    <button class="btn btn-primary" onclick="closeModal('m-det');editExp('${x.id}')">✏️ Editar</button>`;
  openModal('m-det');
}

async function cambiarEstado(id, estado) {
  await PATCH('/expediciones/' + id + '/estado', { estado });
  closeModal('m-det'); await loadExp(); await loadDashboard(); await loadAlertaBadge();
  toast('Estado actualizado: ' + estado);
}

async function openExpModal(fill) {
  _vehiculos = await GET('/vehiculos') || [];
  _conductores = await GET('/conductores') || [];
  _clientes = await GET('/clientes') || [];
  document.getElementById('exp-cli').innerHTML = '<option value="">Seleccionar cliente...</option>' + _clientes.filter(c=>c.estado==='Activo').map(c=>`<option value="${c.id}">${c.razon_social}</option>`).join('');
  document.getElementById('exp-veh').innerHTML = '<option value="">Seleccionar vehículo...</option>' + _vehiculos.map(v=>`<option value="${v.id}">${v.matricula} — ${v.marca||''} ${v.modelo||''} (${v.estado})</option>`).join('');
  document.getElementById('exp-cond').innerHTML = '<option value="">Seleccionar conductor...</option>' + _conductores.filter(c=>c.estado!=='Baja').map(c=>`<option value="${c.id}">${c.nombre}${c.vencimiento_adr?' ☢️':''}</option>`).join('');
  if (!fill) { clearExpForm(); document.getElementById('exp-fecha').value = today(); }
  openModal('m-exp');
}

function clearExpForm() {
  document.getElementById('m-exp-title').textContent = 'Nueva expedición';
  document.getElementById('exp-id').value = '';
  ['exp-origen','exp-destino','exp-peso','exp-km','exp-obs'].forEach(id=>document.getElementById(id).value='');
  ['exp-cli','exp-veh','exp-cond','exp-tipo','exp-adr'].forEach(id=>document.getElementById(id).selectedIndex=0);
  document.getElementById('exp-importe').value = '';
  document.getElementById('exp-estado').value = 'Planificada';
  document.getElementById('exp-adr-row').style.display = 'none';
}

async function editExp(id) {
  const x = await GET('/expediciones/' + id);
  if (!x) return;
  await openExpModal(true);
  document.getElementById('m-exp-title').textContent = 'Editar ' + x.referencia;
  document.getElementById('exp-id').value = x.id;
  document.getElementById('exp-fecha').value = x.fecha_salida?.split('T')[0] || '';
  document.getElementById('exp-origen').value = x.origen || '';
  document.getElementById('exp-destino').value = x.destino || '';
  document.getElementById('exp-tipo').value = x.tipo_carga || '';
  document.getElementById('exp-adr-row').style.display = x.tipo_carga === 'ADR' ? '' : 'none';
  document.getElementById('exp-adr').value = x.clase_adr || '';
  document.getElementById('exp-peso').value = x.peso_kg || '';
  document.getElementById('exp-km').value = x.km_estimados || '';
  document.getElementById('exp-importe').value = x.importe || '';
  document.getElementById('exp-estado').value = x.estado || 'Planificada';
  document.getElementById('exp-obs').value = x.observaciones || '';
  setTimeout(() => {
    document.getElementById('exp-cli').value = x.cliente_id || '';
    document.getElementById('exp-veh').value = x.vehiculo_id || '';
    document.getElementById('exp-cond').value = x.conductor_id || '';
  }, 50);
}

async function saveExp() {
  const id = document.getElementById('exp-id').value;
  const data = {
    cliente_id: document.getElementById('exp-cli').value || null,
    vehiculo_id: document.getElementById('exp-veh').value || null,
    conductor_id: document.getElementById('exp-cond').value || null,
    fecha_salida: document.getElementById('exp-fecha').value,
    origen: document.getElementById('exp-origen').value,
    destino: document.getElementById('exp-destino').value,
    tipo_carga: document.getElementById('exp-tipo').value,
    clase_adr: document.getElementById('exp-adr').value || null,
    peso_kg: +document.getElementById('exp-peso').value || null,
    km_estimados: +document.getElementById('exp-km').value || null,
    importe: +document.getElementById('exp-importe').value || 0,
    estado: document.getElementById('exp-estado').value,
    observaciones: document.getElementById('exp-obs').value || null,
  };
  try {
    if (id) await PUT('/expediciones/' + id, data);
    else await POST('/expediciones', data);
    closeModal('m-exp'); await loadExp(); await loadDashboard(); await loadAlertaBadge();
    toast(id ? 'Expedición actualizada' : 'Expedición creada');
  } catch(e) {}
}

async function deleteExp(id, ref) {
  if (!confirm(`¿Eliminar expedición ${ref}?`)) return;
  await DEL('/expediciones/' + id); await loadExp(); await loadDashboard();
  toast('Expedición eliminada');
}

// ============================================================
// FLOTA
// ============================================================
async function loadFlota() {
  _vehiculos = await GET('/vehiculos') || [];
  const total = _vehiculos.length;
  const enRuta = _vehiculos.filter(v=>v.estado==='En ruta').length;
  const disp = _vehiculos.filter(v=>v.estado==='Disponible').length;
  const bloq = _vehiculos.filter(v=>v.estado==='Bloqueado'||v.estado==='Mantenimiento').length;
  document.getElementById('flota-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Total vehículos</div><div class="kpi-val">${total}</div></div>
    <div class="kpi"><div class="kpi-lbl">En ruta</div><div class="kpi-val">${enRuta}</div></div>
    <div class="kpi"><div class="kpi-lbl">Disponibles</div><div class="kpi-val">${disp}</div></div>
    <div class="kpi"><div class="kpi-lbl">Bloqueados/Mantenimiento</div><div class="kpi-val" style="${bloq>0?'color:var(--red)':''}">${bloq}</div></div>`;
  renderFlota();
}

function renderFlota() {
  const q = (document.getElementById('veh-q')?.value||'').toLowerCase();
  const fe = document.getElementById('veh-fe')?.value||'';
  const list = _vehiculos.filter(v => (!q||(v.matricula+v.marca+v.modelo).toLowerCase().includes(q)) && (!fe||v.estado===fe));
  const tbody = document.getElementById('flota-tbody');
  tbody.innerHTML = list.length
    ? list.map(v => `<tr>
        <td><strong>${v.matricula}</strong></td><td>${v.tipo}</td><td>${v.marca||''} ${v.modelo||''}</td><td>${v.anio||'—'}</td>
        <td>${itvBadge(v.vencimiento_itv)}</td><td>${itvBadge(v.vencimiento_seguro)}</td>
        <td>${(+v.km||0).toLocaleString('es-ES')} km</td>
        <td>${v.certificado_adr ? itvBadge(v.certificado_adr) : '<span class="badge b-gray">No</span>'}</td>
        <td>${estadoBadge(v.estado)}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="editVeh('${v.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteVeh('${v.id}','${v.matricula}')">🗑️</button>
        </td></tr>`).join('')
    : '<tr><td colspan="10" class="tbl-empty">No hay vehículos</td></tr>';
}

function openVehModal() { document.getElementById('m-veh-title').textContent='Nuevo vehículo'; document.getElementById('veh-id').value=''; ['veh-mat','veh-marca','veh-modelo','veh-anio','veh-km','veh-itv','veh-seg','veh-adr','veh-cap','veh-obs'].forEach(id=>document.getElementById(id).value=''); document.getElementById('veh-estado').value='Disponible'; openModal('m-veh'); }

async function editVeh(id) {
  const v = _vehiculos.find(x=>x.id===id) || await GET('/vehiculos/'+id);
  if (!v) return;
  document.getElementById('m-veh-title').textContent = 'Editar ' + v.matricula;
  document.getElementById('veh-id').value = v.id;
  document.getElementById('veh-mat').value = v.matricula||'';
  document.getElementById('veh-tipo').value = v.tipo||'';
  document.getElementById('veh-marca').value = v.marca||'';
  document.getElementById('veh-modelo').value = v.modelo||'';
  document.getElementById('veh-anio').value = v.anio||'';
  document.getElementById('veh-km').value = v.km||'';
  document.getElementById('veh-itv').value = v.vencimiento_itv?.split('T')[0]||'';
  document.getElementById('veh-seg').value = v.vencimiento_seguro?.split('T')[0]||'';
  document.getElementById('veh-adr').value = v.certificado_adr?.split('T')[0]||'';
  document.getElementById('veh-cap').value = v.capacidad_kg||'';
  document.getElementById('veh-estado').value = v.estado||'Disponible';
  document.getElementById('veh-obs').value = v.observaciones||'';
  openModal('m-veh');
}

async function saveVeh() {
  const id = document.getElementById('veh-id').value;
  const data = { matricula:document.getElementById('veh-mat').value, tipo:document.getElementById('veh-tipo').value,
    marca:document.getElementById('veh-marca').value, modelo:document.getElementById('veh-modelo').value,
    anio:+document.getElementById('veh-anio').value||null, km:+document.getElementById('veh-km').value||0,
    vencimiento_itv:document.getElementById('veh-itv').value||null, vencimiento_seguro:document.getElementById('veh-seg').value||null,
    certificado_adr:document.getElementById('veh-adr').value||null, capacidad_kg:+document.getElementById('veh-cap').value||null,
    estado:document.getElementById('veh-estado').value, observaciones:document.getElementById('veh-obs').value||null };
  try {
    if (id) await PUT('/vehiculos/'+id, data); else await POST('/vehiculos', data);
    closeModal('m-veh'); await loadFlota(); await loadAlertaBadge();
    toast(id ? 'Vehículo actualizado' : 'Vehículo añadido');
  } catch(e) {}
}

async function deleteVeh(id, mat) {
  if (!confirm(`¿Eliminar vehículo ${mat}?`)) return;
  await DEL('/vehiculos/'+id); await loadFlota(); toast('Vehículo eliminado');
}

// ============================================================
// CONDUCTORES
// ============================================================
async function loadCond() {
  _conductores = await GET('/conductores') || [];
  renderCond();
}
function renderCond() {
  const q = (document.getElementById('cond-q')?.value||'').toLowerCase();
  const fe = document.getElementById('cond-fe')?.value||'';
  const list = _conductores.filter(c => (!q||(c.nombre+c.dni).toLowerCase().includes(q)) && (!fe||c.estado===fe));
  const tbody = document.getElementById('cond-tbody');
  tbody.innerHTML = list.length
    ? list.map(c => `<tr>
        <td><strong>${c.nombre}</strong></td><td>${c.dni||'—'}</td><td>${c.tipo_carne||'—'}</td>
        <td>${c.vencimiento_adr ? itvBadge(c.vencimiento_adr) : '<span class="badge b-gray">Sin ADR</span>'}</td>
        <td>${c.vencimiento_cap ? itvBadge(c.vencimiento_cap) : '—'}</td>
        <td>${c.telefono||'—'}</td><td>${estadoBadge(c.estado)}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="editCond('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCond('${c.id}','${c.nombre}')">🗑️</button>
        </td></tr>`).join('')
    : '<tr><td colspan="8" class="tbl-empty">No hay conductores</td></tr>';
}
function openCondModal() { document.getElementById('m-cond-title').textContent='Nuevo conductor'; document.getElementById('cond-id').value=''; ['cond-nombre','cond-dni','cond-cvenc','cond-adr','cond-cap','cond-tel','cond-email','cond-obs'].forEach(id=>document.getElementById(id).value=''); document.getElementById('cond-estado').value='Disponible'; openModal('m-cond'); }
async function editCond(id) {
  const c = _conductores.find(x=>x.id===id); if(!c)return;
  document.getElementById('m-cond-title').textContent='Editar '+c.nombre;
  document.getElementById('cond-id').value=c.id;
  document.getElementById('cond-nombre').value=c.nombre||'';document.getElementById('cond-dni').value=c.dni||'';
  document.getElementById('cond-carne').value=c.tipo_carne||'';document.getElementById('cond-cvenc').value=c.vencimiento_carne?.split('T')[0]||'';
  document.getElementById('cond-adr').value=c.vencimiento_adr?.split('T')[0]||'';document.getElementById('cond-cap').value=c.vencimiento_cap?.split('T')[0]||'';
  document.getElementById('cond-tel').value=c.telefono||'';document.getElementById('cond-email').value=c.email||'';
  document.getElementById('cond-estado').value=c.estado||'Disponible';document.getElementById('cond-obs').value=c.observaciones||'';
  openModal('m-cond');
}
async function saveCond() {
  const id = document.getElementById('cond-id').value;
  const data = { nombre:document.getElementById('cond-nombre').value, dni:document.getElementById('cond-dni').value||null,
    tipo_carne:document.getElementById('cond-carne').value||null, vencimiento_carne:document.getElementById('cond-cvenc').value||null,
    vencimiento_adr:document.getElementById('cond-adr').value||null, vencimiento_cap:document.getElementById('cond-cap').value||null,
    telefono:document.getElementById('cond-tel').value||null, email:document.getElementById('cond-email').value||null,
    estado:document.getElementById('cond-estado').value, observaciones:document.getElementById('cond-obs').value||null };
  try { if(id) await PUT('/conductores/'+id,data); else await POST('/conductores',data); closeModal('m-cond'); await loadCond(); await loadAlertaBadge(); toast(id?'Conductor actualizado':'Conductor añadido'); } catch(e){}
}
async function deleteCond(id,nom) { if(!confirm(`¿Eliminar ${nom}?`))return; await DEL('/conductores/'+id); await loadCond(); toast('Conductor eliminado'); }

// ============================================================
// CLIENTES
// ============================================================
async function loadCli() { _clientes = await GET('/clientes')||[]; renderCli(); }
function renderCli() {
  const q = (document.getElementById('cli-q')?.value||'').toLowerCase();
  const fe = document.getElementById('cli-fe')?.value||'';
  const list = _clientes.filter(c=>(!q||(c.razon_social+c.cif+c.sector).toLowerCase().includes(q))&&(!fe||c.estado===fe));
  const tbody = document.getElementById('cli-tbody');
  tbody.innerHTML = list.length
    ? list.map(c=>`<tr><td><strong>${c.razon_social}</strong></td><td>${c.cif||'—'}</td><td>${c.sector||'—'}</td>
        <td>${tipoBadge(c.carga_habitual)}</td><td>${c.contacto||'—'}</td><td>${c.telefono||'—'}</td>
        <td>${c.dias_pago||'—'}</td><td>${estadoBadge(c.estado)}</td>
        <td onclick="event.stopPropagation()">
          <button class="btn btn-sm" onclick="editCli('${c.id}')">✏️</button>
          <button class="btn btn-sm btn-danger" onclick="deleteCli('${c.id}','${c.razon_social}')">🗑️</button>
        </td></tr>`).join('')
    : '<tr><td colspan="9" class="tbl-empty">No hay clientes</td></tr>';
}
function openCliModal(){document.getElementById('m-cli-title').textContent='Nuevo cliente';document.getElementById('cli-id').value='';['cli-razon','cli-cif','cli-sector','cli-contacto','cli-tel','cli-email','cli-dir','cli-obs'].forEach(id=>document.getElementById(id).value='');document.getElementById('cli-estado').value='Activo';openModal('m-cli');}
async function editCli(id){const c=_clientes.find(x=>x.id===id);if(!c)return;document.getElementById('m-cli-title').textContent='Editar '+c.razon_social;document.getElementById('cli-id').value=c.id;document.getElementById('cli-razon').value=c.razon_social||'';document.getElementById('cli-cif').value=c.cif||'';document.getElementById('cli-sector').value=c.sector||'';document.getElementById('cli-carga').value=c.carga_habitual||'';document.getElementById('cli-contacto').value=c.contacto||'';document.getElementById('cli-tel').value=c.telefono||'';document.getElementById('cli-email').value=c.email||'';document.getElementById('cli-dir').value=c.direccion||'';document.getElementById('cli-pago').value=c.dias_pago||'30 días';document.getElementById('cli-estado').value=c.estado||'Activo';document.getElementById('cli-obs').value=c.observaciones||'';openModal('m-cli');}
async function saveCli(){const id=document.getElementById('cli-id').value;const data={razon_social:document.getElementById('cli-razon').value,cif:document.getElementById('cli-cif').value||null,sector:document.getElementById('cli-sector').value||null,carga_habitual:document.getElementById('cli-carga').value||null,contacto:document.getElementById('cli-contacto').value||null,telefono:document.getElementById('cli-tel').value||null,email:document.getElementById('cli-email').value||null,direccion:document.getElementById('cli-dir').value||null,dias_pago:document.getElementById('cli-pago').value,estado:document.getElementById('cli-estado').value,observaciones:document.getElementById('cli-obs').value||null};try{if(id)await PUT('/clientes/'+id,data);else await POST('/clientes',data);closeModal('m-cli');await loadCli();toast(id?'Cliente actualizado':'Cliente añadido');}catch(e){}}
async function deleteCli(id,nom){if(!confirm(`¿Eliminar cliente ${nom}?`))return;await DEL('/clientes/'+id);await loadCli();toast('Cliente eliminado');}

// ============================================================
// FACTURACIÓN
// ============================================================
async function loadFac() {
  _facturas = await GET('/facturas')||[];
  const mes = new Date().toISOString().slice(0,7);
  const facMes = _facturas.filter(f=>f.fecha_emision?.startsWith(mes));
  const total = facMes.reduce((s,f)=>s+parseFloat(f.total||0),0);
  const pend = _facturas.filter(f=>f.estado==='Pendiente'||f.estado==='Enviada').reduce((s,f)=>s+parseFloat(f.total||0),0);
  const venc = _facturas.filter(f=>f.estado==='Vencida').length;
  document.getElementById('fac-kpis').innerHTML = `
    <div class="kpi"><div class="kpi-lbl">Facturado este mes</div><div class="kpi-val">€ ${fmt(total)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Pendiente de cobro</div><div class="kpi-val">€ ${fmt(pend)}</div></div>
    <div class="kpi"><div class="kpi-lbl">Facturas emitidas</div><div class="kpi-val">${_facturas.length}</div></div>
    <div class="kpi"><div class="kpi-lbl">Vencidas impagadas</div><div class="kpi-val" style="${venc>0?'color:var(--red)':''}">${venc}</div></div>`;
  renderFac();
}
function renderFac(){const q=(document.getElementById('fac-q')?.value||'').toLowerCase();const fe=document.getElementById('fac-fe')?.value||'';const list=_facturas.filter(f=>(!q||(f.numero+(f.cliente_nombre||'')).toLowerCase().includes(q))&&(!fe||f.estado===fe));const tbody=document.getElementById('fac-tbody');tbody.innerHTML=list.length?list.map(f=>`<tr><td><strong>${f.numero}</strong></td><td>${fmtDate(f.fecha_emision)}</td><td>${f.cliente_nombre||'—'}</td><td>€ ${fmt(f.base_imponible)}</td><td>€ ${fmt(f.base_imponible*0.21)}</td><td><strong>€ ${fmt(f.total)}</strong></td><td>${fmtDate(f.fecha_vencimiento)}</td><td>${estadoBadge(f.estado)}</td><td onclick="event.stopPropagation()"><select class="btn btn-sm" style="padding:4px;font-size:11px" onchange="cambiarEstadoFac('${f.id}',this.value)"><option value="">Cambiar</option>${['Pendiente','Enviada','Cobrada','Vencida'].map(s=>`<option ${f.estado===s?'selected':''}>${s}</option>`).join('')}</select><button class="btn btn-sm btn-danger" onclick="deleteFac('${f.id}','${f.numero}')">🗑️</button></td></tr>`).join(''):'<tr><td colspan="9" class="tbl-empty">No hay facturas</td></tr>';}
async function openFacModal(){_clientes=await GET('/clientes')||[];document.getElementById('fac-cli').innerHTML='<option value="">Seleccionar cliente...</option>'+_clientes.filter(c=>c.estado==='Activo').map(c=>`<option value="${c.id}">${c.razon_social}</option>`).join('');document.getElementById('fac-fecha').value=today();document.getElementById('fac-base').value='';document.getElementById('fac-total').value='';document.getElementById('fac-vence').value='';document.getElementById('fac-concepto').value='';openModal('m-fac');}
async function saveFac(){const data={cliente_id:document.getElementById('fac-cli').value,fecha_emision:document.getElementById('fac-fecha').value,base_imponible:+document.getElementById('fac-base').value||0,fecha_vencimiento:document.getElementById('fac-vence').value||null,concepto:document.getElementById('fac-concepto').value||null,estado:document.getElementById('fac-estado').value};try{await POST('/facturas',data);closeModal('m-fac');await loadFac();toast('Factura emitida');}catch(e){}}
async function cambiarEstadoFac(id,estado){if(!estado)return;await PATCH('/facturas/'+id+'/estado',{estado});await loadFac();toast('Factura: '+estado);}
async function deleteFac(id,num){if(!confirm(`¿Eliminar factura ${num}?`))return;await DEL('/facturas/'+id);await loadFac();toast('Factura eliminada');}

// ============================================================
// ADR
// ============================================================
async function loadADR() {
  _sustancias = await GET('/sustancias')||[];
  _expediciones = await GET('/expediciones?limit=500')||[];
  const adrClases = [
    {c:'Clase 1',d:'Explosivos'},{c:'Clase 2',d:'Gases comprimidos'},{c:'Clase 3',d:'Líquidos inflamables'},
    {c:'Clase 4',d:'Sólidos inflamables'},{c:'Clase 5',d:'Comburentes'},{c:'Clase 6',d:'Tóxicos/Infecciosos'},
    {c:'Clase 7',d:'Radioactivos'},{c:'Clase 8',d:'Corrosivos'},{c:'Clase 9',d:'Varios peligrosos'},
  ];
  document.getElementById('adr-clases').innerHTML = adrClases.map(a=>{
    const n=_expediciones.filter(e=>e.clase_adr?.startsWith(a.c)&&(e.estado==='En ruta'||e.estado==='Cargando')).length;
    return `<tr><td><strong>${a.c}</strong></td><td>${a.d}</td><td style="text-align:center">${n||0}</td></tr>`;
  }).join('');
  document.getElementById('adr-tbody').innerHTML = _sustancias.length
    ? _sustancias.map(s=>`<tr><td><strong>${s.numero_onu}</strong></td><td>${s.denominacion}</td>
        <td><span class="badge b-red">${s.clase}</span></td><td>${s.grupo_embalaje||'—'}</td>
        <td>${s.punto_inflamacion||'—'}</td><td>${s.codigo_ems||'—'}</td>
        <td>${s.restriccion_tunel?`<span class="badge b-amber">${s.restriccion_tunel}</span>`:'—'}</td>
        <td onclick="event.stopPropagation()"><button class="btn btn-sm btn-danger" onclick="deleteSust('${s.id}')">🗑️</button></td></tr>`).join('')
    : '<tr><td colspan="8" class="tbl-empty">No hay sustancias registradas</td></tr>';
}
function openSustModal(){['sus-onu','sus-nombre','sus-inf','sus-ems','sus-inst'].forEach(id=>document.getElementById(id).value='');['sus-clase','sus-grupo','sus-tunel'].forEach(id=>document.getElementById(id).selectedIndex=0);openModal('m-sust');}
async function saveSust(){const data={numero_onu:document.getElementById('sus-onu').value,denominacion:document.getElementById('sus-nombre').value,clase:document.getElementById('sus-clase').value,grupo_embalaje:document.getElementById('sus-grupo').value||null,punto_inflamacion:document.getElementById('sus-inf').value||null,codigo_ems:document.getElementById('sus-ems').value||null,restriccion_tunel:document.getElementById('sus-tunel').value||null,instrucciones_emergencia:document.getElementById('sus-inst').value||null};try{await POST('/sustancias',data);closeModal('m-sust');await loadADR();toast('Sustancia registrada');}catch(e){}}
async function deleteSust(id){if(!confirm('¿Eliminar esta sustancia?'))return;await DEL('/sustancias/'+id);await loadADR();toast('Sustancia eliminada');}

// ============================================================
// RUTAS
// ============================================================
async function loadRutas(){
  _expediciones=await GET('/expediciones?limit=500')||[];
  const map={};
  _expediciones.forEach(e=>{if(e.origen&&e.destino){const k=e.origen+'|'+e.destino;if(!map[k])map[k]={o:e.origen,d:e.destino,tipos:new Set(),n:0};map[k].n++;if(e.tipo_carga)map[k].tipos.add(e.tipo_carga);}});
  const list=Object.values(map).sort((a,b)=>b.n-a.n);
  document.getElementById('rutas-tbody').innerHTML=list.length?list.slice(0,10).map(r=>`<tr><td>${r.o} → ${r.d}</td><td>${[...r.tipos].map(t=>tipoBadge(t)).join(' ')}</td><td>${r.n}</td></tr>`).join(''):'<tr><td colspan="3" class="tbl-empty">Sin rutas</td></tr>';
}

// ============================================================
// ALERTAS
// ============================================================
async function loadAlertas(){
  const alertas=await GET('/alertas')||[];
  const div=document.getElementById('alertas-container');
  if(!alertas.length){div.innerHTML='<div class="alert a-green"><span>✅</span> Sin alertas activas. Todo en orden.</div>';return;}
  const reds=alertas.filter(a=>a.nivel==='red');
  const ambers=alertas.filter(a=>a.nivel==='amber');
  let html='';
  if(reds.length){html+=`<div style="font-size:12px;font-weight:700;color:var(--red);margin-bottom:8px">CRÍTICAS (${reds.length})</div>`;reds.forEach(a=>{html+=`<div class="alert a-red"><span>🚨</span><div><strong>${a.titulo}</strong><br><span style="font-size:11px">${a.descripcion}</span></div></div>`;});}
  if(ambers.length){html+=`<div style="font-size:12px;font-weight:700;color:var(--amber);margin:${reds.length?14:0}px 0 8px">AVISOS (${ambers.length})</div>`;ambers.forEach(a=>{html+=`<div class="alert a-amber"><span>⚠️</span><div><strong>${a.titulo}</strong><br><span style="font-size:11px">${a.descripcion}</span></div></div>`;});}
  div.innerHTML=html;
}

// ============================================================
// INFORMES
// ============================================================
async function loadInformes(){
  const d=await GET('/informes');if(!d)return;
  document.getElementById('inf-cli').innerHTML=d.topClientes.length?d.topClientes.map(c=>`<div class="stat-row"><span class="stat-lbl">${c.razon_social||'Sin nombre'}</span><span class="stat-val">${c.num_exp} exp · € ${fmt(c.total)}</span></div>`).join(''):'<p style="color:var(--t3);font-size:13px">Sin datos</p>';
  document.getElementById('inf-tipo').innerHTML=d.porTipo.length?d.porTipo.map(t=>`<div class="stat-row"><span class="stat-lbl">${t.tipo_carga}</span><span class="stat-val">${t.n} exp · € ${fmt(t.ingresos)}</span></div>`).join(''):'<p style="color:var(--t3);font-size:13px">Sin datos</p>';
  document.getElementById('inf-mes').innerHTML=`<div class="stat-row"><span class="stat-lbl">Km recorridos mes</span><span class="stat-val">${Math.round(d.kmMes).toLocaleString('es-ES')} km</span></div>`;
  const facList=d.facturacionMensual;
  document.getElementById('inf-fac').innerHTML=facList.length?`<div class="bar-chart" style="height:100px">${facList.map((m,i)=>`<div class="bar-col" style="height:${m.total/Math.max(...facList.map(x=>x.total))*100}%;background:${i===facList.length-1?'var(--text)':'rgba(0,0,0,0.15)'}" title="${new Date(m.mes).toLocaleDateString('es-ES',{month:'short',year:'numeric'})}: € ${fmt(m.total)}"></div>`).join('')}</div><div class="bar-lbl">${facList.map(m=>`<span>${new Date(m.mes).toLocaleDateString('es-ES',{month:'short'})}</span>`).join('')}</div>`:'<p style="color:var(--t3);font-size:13px">Sin datos de facturación</p>';
}

// ============================================================
// CONFIG
// ============================================================
async function loadConfig(){
  const cfg=await GET('/config');if(!cfg)return;
  document.getElementById('cfg-razon').value=cfg.razon_social||'';
  document.getElementById('cfg-cif').value=cfg.cif||'';
  document.getElementById('cfg-aut').value=cfg.autorizacion_mte||'';
  document.getElementById('cfg-dpam').value=cfg.consejero_dpam||'';
  document.getElementById('cfg-dir').value=cfg.direccion||'';
  document.getElementById('cfg-tel').value=cfg.telefono||'';
  document.getElementById('cfg-email').value=cfg.email||'';
  document.getElementById('cfg-itv').value=cfg.dias_alerta_itv||30;
  document.getElementById('cfg-adr').value=cfg.dias_alerta_adr_conductor||30;
  document.getElementById('cfg-seg').value=cfg.dias_alerta_seguro||30;
  document.getElementById('cfg-fac').value=cfg.dias_alerta_factura||3;
  if(cfg.razon_social){document.getElementById('top-company').textContent=cfg.razon_social;}
}
async function saveConfig(){
  const data={razon_social:document.getElementById('cfg-razon').value,cif:document.getElementById('cfg-cif').value,autorizacion_mte:document.getElementById('cfg-aut').value,consejero_dpam:document.getElementById('cfg-dpam').value,direccion:document.getElementById('cfg-dir').value,telefono:document.getElementById('cfg-tel').value,email:document.getElementById('cfg-email').value,dias_alerta_itv:+document.getElementById('cfg-itv').value||30,dias_alerta_adr_conductor:+document.getElementById('cfg-adr').value||30,dias_alerta_seguro:+document.getElementById('cfg-seg').value||30,dias_alerta_factura:+document.getElementById('cfg-fac').value||3};
  try{await PUT('/config',data);toast('Configuración guardada');if(data.razon_social)document.getElementById('top-company').textContent=data.razon_social;}catch(e){}
}
async function changePassword(){
  const current=document.getElementById('pw-current').value;const nueva=document.getElementById('pw-new').value;
  if(!current||!nueva){toast('Rellena ambos campos','err');return;}
  try{await PUT('/auth/password',{current,nueva});document.getElementById('pw-current').value='';document.getElementById('pw-new').value='';toast('Contraseña actualizada');}catch(e){}
}

// ============================================================
// BOOT
// ============================================================
if (TOKEN && USER) showApp();
