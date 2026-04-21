require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// DATABASE
// ============================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.connect((err) => {
  if (err) console.error('❌ Error de conexión DB:', err.message);
  else console.log('✅ Conectado a PostgreSQL');
});

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL, /\.onrender\.com$/, /\.railway\.app$/]
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true });
app.use('/api', limiter);

// ============================================================
// AUTH MIDDLEWARE
// ============================================================
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function authAdmin(req, res, next) {
  auth(req, res, () => {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Se requiere rol administrador' });
    next();
  });
}

// Helper
const q = (text, params) => pool.query(text, params);
const ok = (res, data) => res.json({ ok: true, data });
const err = (res, e, code = 500) => { console.error(e); res.status(code).json({ error: e.message || e }); };

// ============================================================
// AUTH ROUTES
// ============================================================
// Ruta temporal para resetear contraseña de admin (solo en producción inicial)
app.post('/api/auth/reset-admin', async (req, res) => {
  try {
    const { secret, nueva_password } = req.body;
    if (secret !== 'RESET_TRANSERP_2025') return res.status(403).json({ error: 'No autorizado' });
    const hash = await bcrypt.hash(nueva_password, 10);
    await q("UPDATE usuarios SET password_hash=$1 WHERE email='admin@transErp.es'", [hash]);
    res.json({ ok: true, message: 'Contraseña reseteada. Hash: ' + hash });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });
    const { rows } = await q('SELECT * FROM usuarios WHERE email=$1 AND activo=true', [email.toLowerCase().trim()]);
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado' });
    console.log('Login intento:', email, '| Hash en DB:', rows[0].password_hash.substring(0,20));
    const valid = await bcrypt.compare(password, rows[0].password_hash);
    console.log('Contraseña válida:', valid);
    if (!valid) return res.status(401).json({ error: 'Credenciales incorrectas' });
    const token = jwt.sign({ id: rows[0].id, nombre: rows[0].nombre, email: rows[0].email, rol: rows[0].rol }, JWT_SECRET, { expiresIn: '8h' });
    ok(res, { token, user: { id: rows[0].id, nombre: rows[0].nombre, email: rows[0].email, rol: rows[0].rol } });
  } catch (e) { err(res, e); }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT id,nombre,email,rol FROM usuarios WHERE id=$1', [req.user.id]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.put('/api/auth/password', auth, async (req, res) => {
  try {
    const { current, nueva } = req.body;
    const { rows } = await q('SELECT password_hash FROM usuarios WHERE id=$1', [req.user.id]);
    if (!await bcrypt.compare(current, rows[0].password_hash)) return res.status(400).json({ error: 'Contraseña actual incorrecta' });
    if (nueva.length < 8) return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    const hash = await bcrypt.hash(nueva, 10);
    await q('UPDATE usuarios SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    ok(res, { message: 'Contraseña actualizada' });
  } catch (e) { err(res, e); }
});

// ============================================================
// CONFIGURACIÓN
// ============================================================
app.get('/api/config', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM configuracion WHERE id=1');
    ok(res, rows[0] || {});
  } catch (e) { err(res, e); }
});

app.put('/api/config', auth, async (req, res) => {
  try {
    const { razon_social, cif, autorizacion_mte, consejero_dpam, direccion, telefono, email,
      dias_alerta_itv, dias_alerta_adr_conductor, dias_alerta_seguro, dias_alerta_factura } = req.body;
    await q(`INSERT INTO configuracion (id, razon_social, cif, autorizacion_mte, consejero_dpam, direccion, telefono, email,
      dias_alerta_itv, dias_alerta_adr_conductor, dias_alerta_seguro, dias_alerta_factura)
      VALUES (1,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      ON CONFLICT (id) DO UPDATE SET razon_social=$1,cif=$2,autorizacion_mte=$3,consejero_dpam=$4,
      direccion=$5,telefono=$6,email=$7,dias_alerta_itv=$8,dias_alerta_adr_conductor=$9,
      dias_alerta_seguro=$10,dias_alerta_factura=$11,updated_at=NOW()`,
      [razon_social, cif, autorizacion_mte, consejero_dpam, direccion, telefono, email,
        dias_alerta_itv||30, dias_alerta_adr_conductor||30, dias_alerta_seguro||30, dias_alerta_factura||3]);
    ok(res, { message: 'Configuración guardada' });
  } catch (e) { err(res, e); }
});

// ============================================================
// EXPEDICIONES
// ============================================================
app.get('/api/expediciones', auth, async (req, res) => {
  try {
    const { estado, tipo, q: busca, limit = 200, offset = 0 } = req.query;
    let sql = `SELECT e.*, c.razon_social as cliente_nombre, v.matricula as vehiculo_matricula,
      co.nombre as conductor_nombre
      FROM expediciones e
      LEFT JOIN clientes c ON e.cliente_id=c.id
      LEFT JOIN vehiculos v ON e.vehiculo_id=v.id
      LEFT JOIN conductores co ON e.conductor_id=co.id
      WHERE 1=1`;
    const params = [];
    if (estado) { params.push(estado); sql += ` AND e.estado=$${params.length}`; }
    if (tipo) { params.push(tipo); sql += ` AND e.tipo_carga=$${params.length}`; }
    if (busca) { params.push(`%${busca}%`); sql += ` AND (e.referencia ILIKE $${params.length} OR c.razon_social ILIKE $${params.length} OR e.origen ILIKE $${params.length} OR e.destino ILIKE $${params.length})`; }
    sql += ` ORDER BY e.created_at DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`;
    params.push(limit, offset);
    const { rows } = await pool.query(sql, params);
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.get('/api/expediciones/:id', auth, async (req, res) => {
  try {
    const { rows } = await q(`SELECT e.*, c.razon_social as cliente_nombre, v.matricula as vehiculo_matricula,
      co.nombre as conductor_nombre FROM expediciones e
      LEFT JOIN clientes c ON e.cliente_id=c.id
      LEFT JOIN vehiculos v ON e.vehiculo_id=v.id
      LEFT JOIN conductores co ON e.conductor_id=co.id
      WHERE e.id=$1`, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.post('/api/expediciones', auth, async (req, res) => {
  try {
    const { rows: last } = await q("SELECT referencia FROM expediciones ORDER BY referencia DESC LIMIT 1");
    const num = last[0] ? parseInt(last[0].referencia.replace('EXP-','')) + 1 : 1;
    const ref = 'EXP-' + String(num).padStart(4, '0');
    const { cliente_id, vehiculo_id, conductor_id, fecha_salida, fecha_entrega, origen, destino,
      tipo_carga, clase_adr, peso_kg, km_estimados, importe, estado, observaciones } = req.body;
    if (!origen || !destino || !tipo_carga || !fecha_salida) return res.status(400).json({ error: 'Campos obligatorios: origen, destino, tipo de carga, fecha' });
    const { rows } = await q(`INSERT INTO expediciones (referencia,cliente_id,vehiculo_id,conductor_id,fecha_salida,fecha_entrega,origen,destino,tipo_carga,clase_adr,peso_kg,km_estimados,importe,estado,observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [ref, cliente_id||null, vehiculo_id||null, conductor_id||null, fecha_salida, fecha_entrega||null,
       origen, destino, tipo_carga, clase_adr||null, peso_kg||null, km_estimados||null, importe||0, estado||'Planificada', observaciones||null]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.put('/api/expediciones/:id', auth, async (req, res) => {
  try {
    const { cliente_id, vehiculo_id, conductor_id, fecha_salida, fecha_entrega, origen, destino,
      tipo_carga, clase_adr, peso_kg, km_estimados, importe, estado, observaciones } = req.body;
    const { rows } = await q(`UPDATE expediciones SET cliente_id=$1,vehiculo_id=$2,conductor_id=$3,fecha_salida=$4,
      fecha_entrega=$5,origen=$6,destino=$7,tipo_carga=$8,clase_adr=$9,peso_kg=$10,km_estimados=$11,
      importe=$12,estado=$13,observaciones=$14 WHERE id=$15 RETURNING *`,
      [cliente_id||null, vehiculo_id||null, conductor_id||null, fecha_salida, fecha_entrega||null,
       origen, destino, tipo_carga, clase_adr||null, peso_kg||null, km_estimados||null, importe||0,
       estado||'Planificada', observaciones||null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.patch('/api/expediciones/:id/estado', auth, async (req, res) => {
  try {
    const { estado } = req.body;
    const { rows } = await q('UPDATE expediciones SET estado=$1 WHERE id=$2 RETURNING *', [estado, req.params.id]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/expediciones/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM expediciones WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// VEHÍCULOS
// ============================================================
app.get('/api/vehiculos', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM vehiculos ORDER BY matricula');
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/vehiculos', auth, async (req, res) => {
  try {
    const { matricula, tipo, marca, modelo, anio, km, vencimiento_itv, vencimiento_seguro,
      certificado_adr, capacidad_kg, estado, observaciones } = req.body;
    if (!matricula || !tipo) return res.status(400).json({ error: 'Matrícula y tipo son obligatorios' });
    const { rows } = await q(`INSERT INTO vehiculos (matricula,tipo,marca,modelo,anio,km,vencimiento_itv,
      vencimiento_seguro,certificado_adr,capacidad_kg,estado,observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [matricula.toUpperCase(), tipo, marca||null, modelo||null, anio||null, km||0,
       vencimiento_itv||null, vencimiento_seguro||null, certificado_adr||null,
       capacidad_kg||null, estado||'Disponible', observaciones||null]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.put('/api/vehiculos/:id', auth, async (req, res) => {
  try {
    const { matricula, tipo, marca, modelo, anio, km, vencimiento_itv, vencimiento_seguro,
      certificado_adr, capacidad_kg, estado, observaciones } = req.body;
    const { rows } = await q(`UPDATE vehiculos SET matricula=$1,tipo=$2,marca=$3,modelo=$4,anio=$5,km=$6,
      vencimiento_itv=$7,vencimiento_seguro=$8,certificado_adr=$9,capacidad_kg=$10,estado=$11,observaciones=$12
      WHERE id=$13 RETURNING *`,
      [matricula.toUpperCase(), tipo, marca||null, modelo||null, anio||null, km||0,
       vencimiento_itv||null, vencimiento_seguro||null, certificado_adr||null,
       capacidad_kg||null, estado||'Disponible', observaciones||null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/vehiculos/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM vehiculos WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// CONDUCTORES
// ============================================================
app.get('/api/conductores', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM conductores ORDER BY nombre');
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/conductores', auth, async (req, res) => {
  try {
    const { nombre, dni, tipo_carne, vencimiento_carne, vencimiento_adr, vencimiento_cap,
      telefono, email, estado, observaciones } = req.body;
    if (!nombre) return res.status(400).json({ error: 'El nombre es obligatorio' });
    const { rows } = await q(`INSERT INTO conductores (nombre,dni,tipo_carne,vencimiento_carne,
      vencimiento_adr,vencimiento_cap,telefono,email,estado,observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [nombre, dni||null, tipo_carne||null, vencimiento_carne||null, vencimiento_adr||null,
       vencimiento_cap||null, telefono||null, email||null, estado||'Disponible', observaciones||null]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.put('/api/conductores/:id', auth, async (req, res) => {
  try {
    const { nombre, dni, tipo_carne, vencimiento_carne, vencimiento_adr, vencimiento_cap,
      telefono, email, estado, observaciones } = req.body;
    const { rows } = await q(`UPDATE conductores SET nombre=$1,dni=$2,tipo_carne=$3,vencimiento_carne=$4,
      vencimiento_adr=$5,vencimiento_cap=$6,telefono=$7,email=$8,estado=$9,observaciones=$10
      WHERE id=$11 RETURNING *`,
      [nombre, dni||null, tipo_carne||null, vencimiento_carne||null, vencimiento_adr||null,
       vencimiento_cap||null, telefono||null, email||null, estado||'Disponible', observaciones||null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/conductores/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM conductores WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// CLIENTES
// ============================================================
app.get('/api/clientes', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM clientes ORDER BY razon_social');
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/clientes', auth, async (req, res) => {
  try {
    const { razon_social, cif, sector, carga_habitual, contacto, telefono, email,
      direccion, dias_pago, estado, observaciones } = req.body;
    if (!razon_social) return res.status(400).json({ error: 'La razón social es obligatoria' });
    const { rows } = await q(`INSERT INTO clientes (razon_social,cif,sector,carga_habitual,contacto,
      telefono,email,direccion,dias_pago,estado,observaciones)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [razon_social, cif||null, sector||null, carga_habitual||null, contacto||null,
       telefono||null, email||null, direccion||null, dias_pago||'30 días', estado||'Activo', observaciones||null]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.put('/api/clientes/:id', auth, async (req, res) => {
  try {
    const { razon_social, cif, sector, carga_habitual, contacto, telefono, email,
      direccion, dias_pago, estado, observaciones } = req.body;
    const { rows } = await q(`UPDATE clientes SET razon_social=$1,cif=$2,sector=$3,carga_habitual=$4,
      contacto=$5,telefono=$6,email=$7,direccion=$8,dias_pago=$9,estado=$10,observaciones=$11
      WHERE id=$12 RETURNING *`,
      [razon_social, cif||null, sector||null, carga_habitual||null, contacto||null,
       telefono||null, email||null, direccion||null, dias_pago||'30 días', estado||'Activo', observaciones||null, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'No encontrado' });
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/clientes/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM clientes WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// FACTURAS
// ============================================================
app.get('/api/facturas', auth, async (req, res) => {
  try {
    const { rows } = await q(`SELECT f.*, c.razon_social as cliente_nombre
      FROM facturas f LEFT JOIN clientes c ON f.cliente_id=c.id ORDER BY f.fecha_emision DESC`);
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/facturas', auth, async (req, res) => {
  try {
    const { rows: last } = await q("SELECT numero FROM facturas ORDER BY numero DESC LIMIT 1");
    const year = new Date().getFullYear();
    const prefix = `FAC-${year}-`;
    const num = last[0]?.numero?.startsWith(prefix) ? parseInt(last[0].numero.replace(prefix,'')) + 1 : 1;
    const numero = prefix + String(num).padStart(4,'0');
    const { cliente_id, fecha_emision, fecha_vencimiento, base_imponible, concepto, estado } = req.body;
    if (!cliente_id || !base_imponible) return res.status(400).json({ error: 'Cliente e importe son obligatorios' });
    const { rows } = await q(`INSERT INTO facturas (numero,cliente_id,fecha_emision,fecha_vencimiento,
      base_imponible,concepto,estado) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [numero, cliente_id, fecha_emision, fecha_vencimiento||null, base_imponible, concepto||null, estado||'Pendiente']);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.patch('/api/facturas/:id/estado', auth, async (req, res) => {
  try {
    const { estado } = req.body;
    const { rows } = await q('UPDATE facturas SET estado=$1 WHERE id=$2 RETURNING *', [estado, req.params.id]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/facturas/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM facturas WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// SUSTANCIAS ADR
// ============================================================
app.get('/api/sustancias', auth, async (req, res) => {
  try {
    const { rows } = await q('SELECT * FROM sustancias_adr ORDER BY numero_onu');
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/sustancias', auth, async (req, res) => {
  try {
    const { numero_onu, denominacion, clase, grupo_embalaje, punto_inflamacion,
      codigo_ems, restriccion_tunel, instrucciones_emergencia } = req.body;
    if (!numero_onu || !denominacion || !clase) return res.status(400).json({ error: 'Nº ONU, denominación y clase son obligatorios' });
    const { rows } = await q(`INSERT INTO sustancias_adr (numero_onu,denominacion,clase,grupo_embalaje,
      punto_inflamacion,codigo_ems,restriccion_tunel,instrucciones_emergencia)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [numero_onu, denominacion, clase, grupo_embalaje||null, punto_inflamacion||null,
       codigo_ems||null, restriccion_tunel||null, instrucciones_emergencia||null]);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/sustancias/:id', auth, async (req, res) => {
  try {
    await q('DELETE FROM sustancias_adr WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Eliminado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// ALERTAS (generadas en tiempo real)
// ============================================================
app.get('/api/alertas', auth, async (req, res) => {
  try {
    const { rows: cfg } = await q('SELECT * FROM configuracion WHERE id=1');
    const c = cfg[0] || { dias_alerta_itv: 30, dias_alerta_adr_conductor: 30, dias_alerta_seguro: 30, dias_alerta_factura: 3 };
    const alertas = [];

    // ITV vencida o próxima
    const { rows: vehs } = await q('SELECT * FROM vehiculos WHERE vencimiento_itv IS NOT NULL');
    for (const v of vehs) {
      const d = Math.round((new Date(v.vencimiento_itv) - new Date()) / 86400000);
      if (d < 0) alertas.push({ nivel: 'red', titulo: `ITV vencida: ${v.matricula}`, descripcion: `Venció el ${new Date(v.vencimiento_itv).toLocaleDateString('es-ES')}` });
      else if (d <= c.dias_alerta_itv) alertas.push({ nivel: 'amber', titulo: `ITV próxima a vencer: ${v.matricula}`, descripcion: `Vence en ${d} días` });
    }

    // Seguro vehículo
    const { rows: vehs2 } = await q('SELECT * FROM vehiculos WHERE vencimiento_seguro IS NOT NULL');
    for (const v of vehs2) {
      const d = Math.round((new Date(v.vencimiento_seguro) - new Date()) / 86400000);
      if (d < 0) alertas.push({ nivel: 'red', titulo: `Seguro vencido: ${v.matricula}`, descripcion: `Venció el ${new Date(v.vencimiento_seguro).toLocaleDateString('es-ES')}` });
      else if (d <= c.dias_alerta_seguro) alertas.push({ nivel: 'amber', titulo: `Seguro próximo a vencer: ${v.matricula}`, descripcion: `Vence en ${d} días` });
    }

    // ADR conductores
    const { rows: conds } = await q('SELECT * FROM conductores WHERE vencimiento_adr IS NOT NULL');
    for (const c2 of conds) {
      const d = Math.round((new Date(c2.vencimiento_adr) - new Date()) / 86400000);
      if (d < 0) alertas.push({ nivel: 'red', titulo: `Certificado ADR vencido: ${c2.nombre}`, descripcion: `Venció el ${new Date(c2.vencimiento_adr).toLocaleDateString('es-ES')}` });
      else if (d <= c.dias_alerta_adr_conductor) alertas.push({ nivel: 'amber', titulo: `ADR próximo a vencer: ${c2.nombre}`, descripcion: `Vence en ${d} días` });
    }

    // Expediciones en incidencia
    const { rows: incs } = await q("SELECT e.*, cl.razon_social FROM expediciones e LEFT JOIN clientes cl ON e.cliente_id=cl.id WHERE e.estado='Incidencia'");
    for (const e of incs) alertas.push({ nivel: 'red', titulo: `Incidencia activa: ${e.referencia}`, descripcion: `${e.origen} → ${e.destino} — ${e.razon_social || 'Sin cliente'}` });

    // Facturas vencidas
    const { rows: fvenc } = await q("SELECT f.*, c.razon_social FROM facturas f LEFT JOIN clientes c ON f.cliente_id=c.id WHERE f.estado='Vencida'");
    for (const f of fvenc) alertas.push({ nivel: 'red', titulo: `Factura vencida: ${f.numero}`, descripcion: `${f.razon_social || 'Sin cliente'} — Total: € ${parseFloat(f.total).toFixed(2)}` });

    ok(res, alertas);
  } catch (e) { err(res, e); }
});

// ============================================================
// DASHBOARD (estadísticas)
// ============================================================
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const mes = new Date().toISOString().slice(0, 7);
    const [activas, enRuta, facMes, alertasCount, expsRecientes, flota, semana] = await Promise.all([
      q("SELECT COUNT(*) FROM expediciones WHERE estado IN ('En ruta','Cargando')"),
      q("SELECT COUNT(*) FROM vehiculos WHERE estado='En ruta'"),
      q("SELECT COALESCE(SUM(total),0) as total FROM facturas WHERE DATE_TRUNC('month',fecha_emision)=DATE_TRUNC('month',CURRENT_DATE)"),
      q("SELECT COUNT(*) FROM vehiculos WHERE vencimiento_itv < CURRENT_DATE + 30"),
      q(`SELECT e.*, c.razon_social as cliente_nombre FROM expediciones e
        LEFT JOIN clientes c ON e.cliente_id=c.id ORDER BY e.created_at DESC LIMIT 6`),
      q("SELECT tipo, COUNT(*) as total, COUNT(*) FILTER (WHERE estado='En ruta') as en_ruta FROM vehiculos GROUP BY tipo"),
      q("SELECT DATE(fecha_salida) as dia, COUNT(*) as n FROM expediciones WHERE fecha_salida >= CURRENT_DATE - 6 GROUP BY DATE(fecha_salida) ORDER BY dia"),
    ]);
    ok(res, {
      kpis: {
        expedicionesActivas: parseInt(activas.rows[0].count),
        vehiculosEnRuta: parseInt(enRuta.rows[0].count),
        facturacionMes: parseFloat(facMes.rows[0].total),
        alertasPendientes: parseInt(alertasCount.rows[0].count),
      },
      expedicionesRecientes: expsRecientes.rows,
      flota: flota.rows,
      semana: semana.rows,
    });
  } catch (e) { err(res, e); }
});

// ============================================================
// INFORMES
// ============================================================
app.get('/api/informes', auth, async (req, res) => {
  try {
    const [topClientes, porTipo, facMes, kmTotales] = await Promise.all([
      q(`SELECT c.razon_social, COUNT(e.id) as num_exp, COALESCE(SUM(e.importe),0) as total
        FROM expediciones e LEFT JOIN clientes c ON e.cliente_id=c.id GROUP BY c.razon_social ORDER BY total DESC LIMIT 5`),
      q(`SELECT tipo_carga, COUNT(*) as n, COALESCE(SUM(importe),0) as ingresos FROM expediciones GROUP BY tipo_carga ORDER BY n DESC`),
      q(`SELECT DATE_TRUNC('month',fecha_emision) as mes, COALESCE(SUM(total),0) as total FROM facturas
        WHERE fecha_emision >= NOW()-INTERVAL '6 months' GROUP BY mes ORDER BY mes`),
      q(`SELECT COALESCE(SUM(km_estimados),0) as total FROM expediciones WHERE fecha_salida >= DATE_TRUNC('month',CURRENT_DATE)`),
    ]);
    ok(res, { topClientes: topClientes.rows, porTipo: porTipo.rows, facturacionMensual: facMes.rows, kmMes: parseFloat(kmTotales.rows[0].total) });
  } catch (e) { err(res, e); }
});

// ============================================================
// USUARIOS (solo admin)
// ============================================================
app.get('/api/usuarios', authAdmin, async (req, res) => {
  try {
    const { rows } = await q('SELECT id,nombre,email,rol,activo,created_at FROM usuarios ORDER BY nombre');
    ok(res, rows);
  } catch (e) { err(res, e); }
});

app.post('/api/usuarios', authAdmin, async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await q(`INSERT INTO usuarios (nombre,email,password_hash,rol) VALUES ($1,$2,$3,$4) RETURNING id,nombre,email,rol`,
      [nombre, email.toLowerCase(), hash, rol||'operador']);
    ok(res, rows[0]);
  } catch (e) { err(res, e); }
});

app.delete('/api/usuarios/:id', authAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    await q('UPDATE usuarios SET activo=false WHERE id=$1', [req.params.id]);
    ok(res, { message: 'Usuario desactivado' });
  } catch (e) { err(res, e); }
});

// ============================================================
// CATCH-ALL → SPA
// ============================================================
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
});

// ============================================================
// START
// ============================================================
app.listen(PORT, () => {
  console.log(`🚛 TransERP corriendo en http://localhost:${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
});
