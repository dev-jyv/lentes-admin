// Mock PROVISIONAL de imágenes, inventario y reportes (ver openapi/provisional); recetas y pedidos ya salen de la API real.
// Solo desarrollo: `pnpm mock` en :8081. No valida auth.
import { createServer } from 'node:http';

const id = () => crypto.randomUUID();
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();
const readBody = (req) => new Promise((resolve) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => resolve(b ? JSON.parse(b) : {})); });

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
