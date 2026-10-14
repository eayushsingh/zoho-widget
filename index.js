const express = require('express');
const path = require('path');

const app = express();

const FUNCTION_URL =
  'https://project-rainfall-60058837594.development.catalystserverless.in/server/mcpGateway/execute';

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(process.cwd(), 'public');

app.use(express.json({ limit: '2mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

app.use(express.static(
  require('fs').existsSync(path.join(PUBLIC_DIR, 'index.html'))
    ? PUBLIC_DIR
    : process.cwd()
));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/mcp', async (req, res) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const incoming = req.body;

    if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ error: 'A JSON object is required.' });
    }

    const record = incoming.record ?? incoming;

    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      return res.status(400).json({ error: 'Invalid record.' });
    }

    const payloadObj = {
      record,
      request: 'score_and_assign'
    };

    const forwarded = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payload: JSON.stringify(payloadObj)
      }),
      signal: controller.signal
    });

    const text = await forwarded.text();

    let result;

    try {
      result = JSON.parse(text);
    } catch {
      result = { result: text };
    }

    return res.status(forwarded.status).json(result);
  } catch (err) {
    console.error('Proxy /mcp error:', err.message);

    if (err.name === 'AbortError') {
      return res.status(504).json({ error: 'Remote function timed out.' });
    }

    return res.status(502).json({ error: 'Remote function request failed.' });
  } finally {
    clearTimeout(timeout);
  }
});

app.listen(PORT, () => {
  console.log(`OOHI widget server running on port ${PORT}`);
});
