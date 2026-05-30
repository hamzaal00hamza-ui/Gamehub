const express = require('express');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const FC_HOST  = 'fastcard1.store';
const FC_PATH  = '/client/api';
const FC_TOKEN = process.env.FC_API_TOKEN || 'QMMcLPmGsdgD6lQq9Z_2WFdfMQnLy1ZfM670CByiBS43O5PX6U9SHmlvMBI_ycg7';
const PROFIT   = parseFloat(process.env.PROFIT_MARGIN || '0.15');

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper — GET request to FastCard
function fcGET(endpoint) {
  return new Promise((resolve, reject) => {
    const reqPath = FC_PATH + endpoint;
    console.log(`→ FastCard GET: ${reqPath}`);
    const options = {
      hostname: FC_HOST,
      path:     reqPath,
      method:   'GET',
      headers:  {
        'api-token':  FC_TOKEN,
        'Accept':     'application/json',
        'User-Agent': 'GameZone/1.0',
        'Host':       FC_HOST,
      },
      timeout: 20000,
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        console.log(`← FastCard ${res.statusCode}: ${raw.slice(0,80)}`);
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: { error: 'Invalid JSON', raw: raw.slice(0,200) } }); }
      });
    });
    req.on('error', err => { console.error('FC error:', err.message); reject(err); });
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// Helper — POST request to FastCard
function fcPOST(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = Object.keys(params).length ? '?' + new URLSearchParams(params).toString() : '';
    const reqPath = FC_PATH + endpoint + qs;
    console.log(`→ FastCard POST: ${reqPath}`);
    const options = {
      hostname:      FC_HOST,
      path:          reqPath,
      method:        'POST',
      headers:       {
        'api-token':      FC_TOKEN,
        'Accept':         'application/json',
        'Content-Length': '0',
        'Host':           FC_HOST,
      },
      timeout: 20000,
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        console.log(`← FastCard POST ${res.statusCode}: ${raw.slice(0,100)}`);
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch(e) { resolve({ status: res.statusCode, body: { error: 'Invalid JSON' } }); }
      });
    });
    req.on('error', err => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

// ── Health ──────────────────────────────
app.get('/health', (req, res) => {
  res.json({ ok: true, token: FC_TOKEN ? FC_TOKEN.slice(0,10)+'...' : '❌', time: new Date() });
});

// ── Profile ─────────────────────────────
app.get('/api/fc/profile', async (req, res) => {
  try {
    const { status, body } = await fcGET('/profile');
    res.status(status).json(body);
  } catch(e) {
    res.status(503).json({ error: e.message });
  }
});

// ── Products ─────────────────────────────
app.get('/api/fc/products', async (req, res) => {
  try {
    const { status, body } = await fcGET('/products');
    if (Array.isArray(body)) {
      body.forEach(p => {
        p.sell_price = +(p.price * (1 + PROFIT)).toFixed(3);
      });
    }
    res.status(status).json(body);
  } catch(e) {
    res.status(503).json({ error: e.message });
  }
});

// ── Content (category) ───────────────────
app.get('/api/fc/content/:catId', async (req, res) => {
  try {
    const { status, body } = await fcGET(`/content/${req.params.catId}`);
    res.status(status).json(body);
  } catch(e) {
    res.status(503).json({ error: e.message });
  }
});

// ── New Order ────────────────────────────
// POST /api/fc/order  body: { productId, qty, playerId, order_uuid, ...extra }
app.post('/api/fc/order', async (req, res) => {
  const { productId, ...params } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  try {
    const strParams = {};
    Object.entries(params).forEach(([k,v]) => strParams[k] = String(v));
    const { status, body } = await fcPOST(`/newOrder/${productId}/params`, strParams);
    res.status(status).json(body);
  } catch(e) {
    res.status(503).json({ error: e.message });
  }
});

// ── Check Order ──────────────────────────
app.get('/api/fc/check', async (req, res) => {
  const { orderId, uuid } = req.query;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const ep = uuid === '1'
      ? `/check?orders=["${orderId}"]&uuid=1`
      : `/check?orders=[${orderId}]`;
    const { status, body } = await fcGET(ep);
    res.status(status).json(body);
  } catch(e) {
    res.status(503).json({ error: e.message });
  }
});

// ── Catch-all ────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ GameZone on port ${PORT}`);
  console.log(`FC_TOKEN: ${FC_TOKEN ? FC_TOKEN.slice(0,12)+'...' : '❌ NOT SET'}`);
});
