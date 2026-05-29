const express = require('express');
const cors    = require('cors');
const https   = require('https');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const FC_BASE  = 'fastcard1.store';
const FC_PATH  = '/client/api';
const FC_TOKEN = process.env.FC_API_TOKEN || 'QMMcLPmGsdgD6lQq9Z_2WFdfMQnLy1ZfM670CByiBS43O5PX6U9SHmlvMBI_ycg7';
const PROFIT   = parseFloat(process.env.PROFIT_MARGIN || '0.15');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function fcRequest(endpoint) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: FC_BASE,
      path: FC_PATH + endpoint,
      method: 'GET',
      headers: { 'api-token': FC_TOKEN, 'Accept': 'application/json' },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: 'Invalid JSON' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

function fcPost(endpoint, params = {}) {
  return new Promise((resolve, reject) => {
    const qs = '?' + new URLSearchParams(params).toString();
    const options = {
      hostname: FC_BASE,
      path: FC_PATH + endpoint + qs,
      method: 'POST',
      headers: { 'api-token': FC_TOKEN, 'Accept': 'application/json', 'Content-Length': 0 },
      timeout: 15000
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { resolve({ error: 'Invalid JSON' }); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

app.get('/health', (req, res) => {
  res.json({ ok: true, token: FC_TOKEN ? FC_TOKEN.slice(0,8)+'...' : '❌' });
});

app.get('/api/fc/profile', async (req, res) => {
  try { res.json(await fcRequest('/profile')); }
  catch(e) { res.status(503).json({ error: e.message }); }
});

app.get('/api/fc/products', async (req, res) => {
  try {
    const data = await fcRequest('/products');
    if (Array.isArray(data)) {
      data.forEach(p => { p.sell_price = +(p.price * (1 + PROFIT)).toFixed(3); });
    }
    res.json(data);
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.post('/api/fc/order', async (req, res) => {
  const { productId, ...rest } = req.body || {};
  if (!productId) return res.status(400).json({ error: 'productId required' });
  try {
    const params = {};
    Object.entries(rest).forEach(([k,v]) => params[k] = String(v));
    res.json(await fcPost(`/newOrder/${productId}/params`, params));
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.get('/api/fc/check', async (req, res) => {
  const { orderId, uuid } = req.query;
  if (!orderId) return res.status(400).json({ error: 'orderId required' });
  try {
    const ep = uuid === '1' ? `/check?orders=["${orderId}"]&uuid=1` : `/check?orders=[${orderId}]`;
    res.json(await fcRequest(ep));
  } catch(e) { res.status(503).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ GameZone on port ${PORT}`);
});
