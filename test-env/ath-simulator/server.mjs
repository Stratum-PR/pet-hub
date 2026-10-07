// ATH Móvil Payment Button API simulator: local Node server (never deploy to production).
//
// Evertec has no sandbox; this serves the documented API from ./core.mjs with an in-memory store,
// plus a "customer phone" page. See core.mjs for behavior and README for usage.
//
//   GET  /                                 customer phone page (Pagar / Rechazar)
//   POST /simulator/payments/:id/approve   OPEN → CONFIRM
//   POST /simulator/payments/:id/decline   OPEN → CANCEL (+ cancelled webhook)
//   POST /simulator/payments/:id/expire    → CANCEL (+ expired webhook)
//   GET  /simulator/state                  payments + webhooks sent
//   POST /simulator/reset
//
// Env: PORT (4010), SIM_BUSINESSES ("publicToken:privateToken:Business Name,…"),
//      SIM_TIME_SCALE (1 = real time; 60 makes the 10-minute window last 10 s), SIM_AUTO_APPROVE_MS (1500).
import http from 'node:http';
import { createMemoryStore, createSimulator } from './core.mjs';

const PORT = Number(process.env.PORT ?? 4010);
const TIME_SCALE = Math.max(1, Number(process.env.SIM_TIME_SCALE ?? 1));

function parseBusinesses(raw) {
  const out = [];
  for (const entry of (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const [publicToken, privateToken, name] = entry.split(':');
    out.push({ publicToken, privateToken, name: name || 'Negocio de prueba' });
  }
  return out.length ? out : [{ publicToken: 'sim_public_token', privateToken: 'sim_private_token', name: 'Grumi Test Groomers' }];
}

const store = createMemoryStore(parseBusinesses(process.env.SIM_BUSINESSES));
let sim = createSimulator({ store, timeScale: TIME_SCALE, autoMs: Number(process.env.SIM_AUTO_APPROVE_MS ?? 1500) });

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '', 'text/plain');
    const url = new URL(req.url ?? '/', 'http://sim');
    const m = url.pathname.match(/^\/simulator\/payments\/([^/]+)\/(approve|decline|expire)$/);
    if (req.method === 'POST' && m) {
      const r = await sim.customerAction(m[1], m[2]);
      return send(res, r.error === 'not_found' ? 404 : r.ok ? 200 : 409, r);
    }
    if (req.method === 'GET' && url.pathname === '/simulator/state') return send(res, 200, await sim.state());
    if (req.method === 'POST' && url.pathname === '/simulator/reset') {
      store.reset(parseBusinesses(process.env.SIM_BUSINESSES));
      sim = createSimulator({ store, timeScale: TIME_SCALE, autoMs: Number(process.env.SIM_AUTO_APPROVE_MS ?? 1500) });
      return send(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/') return send(res, 200, PHONE_PAGE, 'text/html; charset=utf-8');
    if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true });
    const r = await sim.handle(req.method ?? 'GET', url.pathname, { authorization: req.headers.authorization ?? '' }, await readJson(req));
    send(res, r.status, r.body);
  } catch (e) {
    console.error(e);
    send(res, 500, { status: 'error', message: 'Internal Error', errorcode: 'BTRA_9999', data: null });
  }
});

const PHONE_PAGE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ATH Móvil · Simulador</title>
<style>
:root{--bg:#f4f5f7;--card:#fff;--ink:#1f2937;--muted:#6b7280;--brand:#f26b21;--ok:#16a34a;--bad:#dc2626}
@media (prefers-color-scheme:dark){:root{--bg:#111318;--card:#1b1e25;--ink:#e5e7eb;--muted:#9ca3af}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.4 system-ui,sans-serif}
main{max-width:420px;margin:0 auto;padding:16px}
h1{font-size:18px;margin:8px 0 4px}p.note{color:var(--muted);font-size:13px;margin:0 0 16px}
.card{background:var(--card);border-radius:14px;padding:14px;margin-bottom:12px;box-shadow:0 1px 3px #0001}
.row{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.amt{font-size:24px;font-weight:700}.muted{color:var(--muted);font-size:13px}
.st{font-size:12px;font-weight:600;padding:2px 8px;border-radius:999px;background:#0001}
.btns{display:flex;gap:8px;margin-top:12px}button{flex:1;border:0;border-radius:10px;padding:10px;font-weight:600;font-size:15px;cursor:pointer}
.yes{background:var(--brand);color:#fff}.no{background:#0001;color:var(--ink)}
.empty{text-align:center;color:var(--muted);padding:32px 0}
</style></head><body><main>
<h1>📱 Teléfono del cliente (simulado)</h1>
<p class="note">Así aprueba el cliente en ATH Móvil. Solo para pruebas locales; nunca se cobra dinero real.</p>
<div id="list"></div><h1 style="font-size:15px;margin-top:20px">Webhooks enviados</h1><div id="hooks" class="muted"></div>
</main><script>
async function act(id,a){await fetch('/simulator/payments/'+id+'/'+a,{method:'POST'});load()}
async function load(){
 const s=await (await fetch('/simulator/state')).json();
 const list=document.getElementById('list');
 const ps=s.payments.slice().reverse();
 list.innerHTML=ps.length?ps.map(p=>'<div class="card"><div class="row"><span class="amt">$'+Number(p.total).toFixed(2)+'</span><span class="st">'+p.ecommerceStatus+'</span></div>'
  +'<div class="muted">'+p.businessName+' · tel. '+p.phone+'</div>'
  +(p.items||[]).map(i=>'<div class="muted">'+i.quantity+' × '+i.name+'</div>').join('')
  +(p.ecommerceStatus==='OPEN'?'<div class="btns"><button class="no" onclick="act(\\''+p.ecommerceId+'\\',\\'decline\\')">Rechazar</button><button class="yes" onclick="act(\\''+p.ecommerceId+'\\',\\'approve\\')">Pagar</button></div>':'')
  +'</div>').join(''):'<div class="empty">No hay pagos pendientes</div>';
 document.getElementById('hooks').innerHTML=s.webhooks.slice(0,8).map(w=>w.at+' · '+w.event+(w.url?(w.delivered?' ✓':' ✗'):' (sin suscripción)')).join('<br>')||'—';
}
load();setInterval(load,1500);
</script></body></html>`;

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  setInterval(() => void sim.sweep(), 1000).unref();
  server.listen(PORT, () => console.log(`ATH Móvil simulator on http://localhost:${PORT}  (time scale ×${TIME_SCALE})`));
}

export { server };
