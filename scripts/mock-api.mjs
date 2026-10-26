// Mock PROVISIONAL de /v1/admin/orders y /v1/admin/prescriptions (ver openapi/provisional).
// Solo desarrollo: `pnpm mock` en :8081. No valida auth.
import { createServer } from 'node:http';

const id = () => crypto.randomUUID();
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const addr = { recipient: 'Ana López', street: 'Av. Reforma', ext_number: '120', int_number: '4B', neighborhood: 'Juárez', city: 'CDMX', state: 'Ciudad de México', postal_code: '06600', phone: '5512345678' };
const line = (sku, product_name, brand_name, eye, quantity, unit_price_cents, description) => ({ sku, product_name, brand_name, eye, quantity, unit_price_cents, description });

const mk = (number, status, email, hours, lines, extra = {}) => {
  const subtotal = lines.reduce((n, l) => n + l.unit_price_cents * l.quantity * (l.eye === 'both' ? 2 : 1), 0);
  return {
    id: id(), number, status, customer_email: email, created_at: ago(hours), paid_at: status === 'pending_payment' ? null : ago(hours - 0.1),
    items: lines, subtotal_cents: subtotal, shipping_cents: 9900, discount_cents: 0, total_cents: subtotal + 9900,
    shipping_address: addr, prescription_id: null, mp_payment_id: status === 'pending_payment' ? null : '1234567890',
    tracking_carrier: null, tracking_number: null, shipped_at: null, ...extra,
  };
};

const orders = [
  mk(105, 'paid', 'ana@example.com', 2, [line('BIO-MON-2.00', 'Biofinity', 'CooperVision', 'both', 2, 45900, 'Esf -2.00 · CB 8.6 · Diám 14')]),
  mk(104, 'preparing', 'luis@example.com', 20, [line('OAS-BW-3.50', 'Acuvue Oasys', 'Acuvue', 'right', 1, 52900, 'Esf -3.50'), line('OAS-BW-3.25', 'Acuvue Oasys', 'Acuvue', 'left', 1, 52900, 'Esf -3.25')]),
  mk(103, 'shipped', 'sofia@example.com', 50, [line('AIR-AQ-1.00', 'Air Optix Aqua', 'Alcon', 'both', 1, 48900, 'Esf -1.00')], { tracking_carrier: 'Estafeta', tracking_number: '7701234567', shipped_at: ago(30) }),
  mk(102, 'delivered', 'ana@example.com', 200, [line('BIO-MON-2.00', 'Biofinity', 'CooperVision', 'both', 1, 45900, 'Esf -2.00')], { tracking_carrier: 'DHL', tracking_number: '1Z999', shipped_at: ago(180) }),
  mk(101, 'pending_payment', 'beto@example.com', 1, [line('OAS-BW-2.00', 'Acuvue Oasys', 'Acuvue', 'both', 1, 52900, 'Esf -2.00')]),
  mk(100, 'cancelled', 'carla@example.com', 300, [line('AIR-AQ-4.00', 'Air Optix Aqua', 'Alcon', 'both', 1, 48900, 'Esf -4.00')]),
];

const rx = (status, email, hours, od, os, extra = {}) => ({
  id: id(), status, customer_email: email, od_sphere: od, od_cylinder: null, od_axis: null, od_addition: null,
  os_sphere: os, os_cylinder: null, os_axis: null, os_addition: null, issued_at: '2026-09-15', expires_at: '2027-09-15',
  doctor_name: 'Dra. Pérez', doctor_license: '12345678', file_url: 'https://example.com/receta-demo.pdf', reject_reason: null, created_at: ago(hours), ...extra,
});
const prescriptions = [
  rx('pending', 'ana@example.com', 3, -2.0, -2.25),
  rx('pending', 'luis@example.com', 26, -3.5, -3.25, { od_cylinder: -0.75, od_axis: 90 }),
  rx('approved', 'sofia@example.com', 100, -1.0, -1.0),
];

// --- A4: imágenes (en memoria; los bytes se sirven en /uploads/<key>) ---
const files = new Map(); // r2_key -> { type, buf }
const galleries = new Map(); // product_id -> [{ id, r2_key, position }]
const imgView = (g) => g.map((i, idx) => ({ id: i.id, r2_key: i.r2_key, url: `http://localhost:8081/uploads/${i.r2_key}`, position: idx }));

// --- A5: inventario ---
const stock = new Map(); // variant_id -> stock
const adjustments = new Map(); // variant_id -> []
const low = [
  { variant_id: id(), sku: 'BIO-MON-2.00', product_id: id(), product_name: 'Biofinity', brand_name: 'CooperVision', stock: 3, reserved: 1 },
  { variant_id: id(), sku: 'OAS-BW-3.50', product_id: id(), product_name: 'Acuvue Oasys', brand_name: 'Acuvue', stock: 2, reserved: 2 },
  { variant_id: id(), sku: 'AIR-AQ-1.00', product_id: id(), product_name: 'Air Optix Aqua', brand_name: 'Alcon', stock: 12, reserved: 0 },
];
low.forEach((v) => stock.set(v.variant_id, v.stock));
const stockOf = (vid) => (stock.has(vid) ? stock.get(vid) : 10);

const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b ? JSON.parse(b) : {})); });
const NEXT = { paid: ['preparing', 'cancelled'], preparing: ['shipped', 'cancelled'], shipped: ['delivered'] };

createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'authorization,content-type');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  const send = (status, body, type = 'application/json') => { res.writeHead(status, { 'content-type': type }); res.end(JSON.stringify(body)); };
  const problem = (status, title, detail) => send(status, { title, status, detail }, 'application/problem+json');
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  const q = url.searchParams;
  const summary = ({ items, subtotal_cents, shipping_cents, discount_cents, shipping_address, prescription_id, mp_payment_id, tracking_carrier, tracking_number, shipped_at, ...s }) => s;

  if (p === '/v1/admin/orders' && req.method === 'GET') {
    const st = q.get('status');
    return send(200, { items: orders.filter((o) => !st || o.status === st).map(summary), next_cursor: null });
  }
  let m = p.match(/^\/v1\/admin\/orders\/([^/]+)$/);
  if (m) {
    const o = orders.find((x) => x.id === m[1]);
    if (!o) return problem(404, 'No encontrado');
    if (req.method === 'GET') return send(200, o);
    if (req.method === 'PATCH') {
      const b = await readBody(req);
      if (b.status) {
        if (!(NEXT[o.status] ?? []).includes(b.status)) return problem(409, 'Transición no permitida', `${o.status} → ${b.status}`);
        if (b.status === 'shipped') {
          if (!b.tracking_carrier || !b.tracking_number) return problem(409, 'Falta la guía', 'Paquetería y número de guía son obligatorios.');
          o.tracking_carrier = b.tracking_carrier; o.tracking_number = b.tracking_number; o.shipped_at = new Date().toISOString();
        }
        o.status = b.status;
      }
      return send(200, o);
    }
  }
  if (p === '/v1/admin/prescriptions' && req.method === 'GET') {
    const st = q.get('status');
    return send(200, { items: prescriptions.filter((r) => !st || r.status === st) });
  }
  m = p.match(/^\/v1\/admin\/prescriptions\/([^/]+)$/);
  if (m && req.method === 'PATCH') {
    const r = prescriptions.find((x) => x.id === m[1]);
    if (!r) return problem(404, 'No encontrado');
    if (r.status !== 'pending') return problem(409, 'Ya revisada');
    const b = await readBody(req);
    if (b.status === 'rejected' && !b.reject_reason?.trim()) return problem(400, 'Falta el motivo', 'El motivo es obligatorio al rechazar.');
    r.status = b.status; r.reject_reason = b.status === 'rejected' ? b.reject_reason.trim() : null;
    return send(200, r);
  }
  // --- A4 ---
  if (p === '/v1/admin/uploads/image-url' && req.method === 'POST') {
    const b = await readBody(req);
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[b.content_type];
    if (!ext) return problem(400, 'Tipo no permitido');
    const key = `productos/${b.product_id}/${id()}.${ext}`;
    return send(200, { upload_url: `http://localhost:8081/uploads/${key}`, r2_key: key });
  }
  m = p.match(/^\/uploads\/(.+)$/);
  if (m && req.method === 'PUT') {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    return req.on('end', () => { files.set(m[1], { type: req.headers['content-type'], buf: Buffer.concat(chunks) }); res.writeHead(200).end(); });
  }
  if (m && req.method === 'GET') {
    const f = files.get(m[1]);
    if (!f) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': f.type }); return res.end(f.buf);
  }
  m = p.match(/^\/v1\/admin\/products\/([^/]+)\/images(?:\/(order|[^/]+))?$/);
  if (m) {
    const g = galleries.get(m[1]) ?? [];
    galleries.set(m[1], g);
    if (!m[2] && req.method === 'GET') return send(200, { items: imgView(g) });
    if (!m[2] && req.method === 'POST') {
      const b = await readBody(req);
      const img = { id: id(), r2_key: b.r2_key };
      g.push(img);
      return send(201, imgView(g)[g.length - 1]);
    }
    if (m[2] === 'order' && req.method === 'PUT') {
      const b = await readBody(req);
      const byId = new Map(g.map((i) => [i.id, i]));
      const next = b.image_ids.map((x) => byId.get(x)).filter(Boolean);
      if (next.length !== g.length) return problem(400, 'Orden inválido', 'Debe incluir todas las imágenes.');
      galleries.set(m[1], next);
      return send(200, { items: imgView(next) });
    }
    if (m[2] && m[2] !== 'order' && req.method === 'DELETE') {
      galleries.set(m[1], g.filter((i) => i.id !== m[2]));
      return res.writeHead(204).end();
    }
  }
  // --- A5 ---
  if (p === '/v1/admin/inventory/low-stock') {
    const t = Number(q.get('threshold') ?? 5);
    return send(200, { items: low.map((v) => ({ ...v, stock: stockOf(v.variant_id), available: stockOf(v.variant_id) - v.reserved })).filter((v) => v.available <= t) });
  }
  m = p.match(/^\/v1\/admin\/variants\/([^/]+)\/stock-adjustments$/);
  if (m) {
    const list = adjustments.get(m[1]) ?? [];
    adjustments.set(m[1], list);
    if (req.method === 'GET') return send(200, { items: list });
    if (req.method === 'POST') {
      const b = await readBody(req);
      if (!Number.isInteger(b.delta) || b.delta === 0) return problem(400, 'Cantidad inválida', 'El ajuste no puede ser 0.');
      if (b.reason === 'other' && !b.note?.trim()) return problem(400, 'Falta la nota', 'La nota es obligatoria con motivo "otro".');
      const after = stockOf(m[1]) + b.delta;
      if (after < 0) return problem(409, 'Existencia insuficiente', 'El stock no puede quedar negativo.');
      stock.set(m[1], after);
      const adj = { id: id(), delta: b.delta, reason: b.reason, note: b.note?.trim() || null, stock_after: after, created_at: new Date().toISOString(), actor_email: 'admin@example.com' };
      list.unshift(adj);
      return send(201, adj);
    }
  }
  if (p === '/v1/admin/reports/sales') {
    const from = new Date(`${q.get('from')}T00:00:00Z`), to = new Date(`${q.get('to')}T00:00:00Z`);
    if (!(from <= to)) return problem(400, 'Rango inválido');
    const daily = [];
    for (let d = new Date(from), i = 0; d <= to && i < 366; d.setUTCDate(d.getUTCDate() + 1), i++) {
      const n = (i * 7) % 5;
      daily.push({ date: d.toISOString().slice(0, 10), orders: n, revenue_cents: n * 61800 });
    }
    return send(200, {
      orders: daily.reduce((a, d) => a + d.orders, 0), revenue_cents: daily.reduce((a, d) => a + d.revenue_cents, 0),
      units: daily.reduce((a, d) => a + d.orders * 2, 0), daily,
      top_products: [
        { product_name: 'Biofinity', brand_name: 'CooperVision', units: 42, revenue_cents: 1927800 },
        { product_name: 'Acuvue Oasys', brand_name: 'Acuvue', units: 30, revenue_cents: 1587000 },
        { product_name: 'Air Optix Aqua', brand_name: 'Alcon', units: 18, revenue_cents: 880200 },
      ],
    });
  }
  if (p === '/v1/admin/reports/repurchase') return send(200, { customers: 120, repeat_customers: 48, reminders_sent: 80, reorders_from_reminder: 22 });
  return problem(404, 'No encontrado');
}).listen(8081, () => console.log('mock admin http://localhost:8081'));
