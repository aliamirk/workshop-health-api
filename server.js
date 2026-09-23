const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Track when the process started so we can report real uptime
const startTime = process.hrtime.bigint();

function formatBytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function getStatus() {
  const uptimeSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;

  return {
    status: 'healthy',
    hostname: os.hostname(),
    uptime: `${uptimeSeconds.toFixed(2)}s`,
    memory: {
      total: formatBytes(os.totalmem()),
      free: formatBytes(os.freemem())
    },
    cpu_cores: os.cpus().length,
    timestamp: new Date().toISOString()
  };
}

// The one and only API endpoint
app.get('/status', (req, res) => {
  res.json(getStatus());
});

// Simple browser UI that renders the same data
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Health API listening on port ${PORT}`);
});
