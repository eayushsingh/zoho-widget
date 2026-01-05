const express = require('express');
const path = require('path');

// Mirror the FUNCTION_URL used in index.html so the proxy forwards there
const FUNCTION_URL = "https://project-rainfall-60058837594.development.catalystserverless.in/server/mcpGateway/execute";

const app = express();
app.use(express.json({ limit: '1mb' }));

// Allow local testing from the browser
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Serve static files (index.html etc.) from the project root
app.use(express.static(process.cwd()));

// Proxy endpoint for /mcp — forwards the incoming record to the remote FUNCTION_URL
app.post('/mcp', async (req, res) => {
  try {
    // Build payload compatible with the original FUNCTION_URL usage
    const incoming = req.body || {};

    const payloadObj = {
      // if caller sent { record: {...} } use it, otherwise use the whole incoming body
      record: incoming.record || incoming,
      request: 'score_and_assign'
    };

    // The remote function previously expected { payload: JSON.stringify(payloadObj) }
    const forwarded = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payload: JSON.stringify(payloadObj) })
    });

    const text = await forwarded.text();
    // Try to parse JSON, otherwise send raw text
    try {
      const json = JSON.parse(text);
      res.status(forwarded.status).json(json);
    } catch (e) {
      res.status(forwarded.status).type('text').send(text);
    }
  } catch (err) {
    console.error('Proxy /mcp error:', err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Static server + /mcp proxy listening on http://localhost:${PORT}`));
