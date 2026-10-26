// Mock PROVISIONAL de los reportes (ver openapi/provisional); recetas, pedidos, imágenes e inventario ya salen de la API real.
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
