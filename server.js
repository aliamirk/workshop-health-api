const express = require('express');
const os = require('os');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const startTime = process.hrtime.bigint();

function formatBytes(bytes) {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

const METADATA_BASE = 'http://169.254.169.254/latest';

// Pulls subnet/VPC/AZ from the EC2 instance metadata service (IMDSv2).
async function getNetworkInfo() {
  try {
    const tokenRes = await fetch(`${METADATA_BASE}/api/token`, {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' },
      signal: AbortSignal.timeout(1000)
    });
    const token = await tokenRes.text();
    const headers = { 'X-aws-ec2-metadata-token': token };

    const mac = await fetch(`${METADATA_BASE}/meta-data/mac`, { headers }).then(r => r.text());
    const [subnetId, az] = await Promise.all([
      fetch(`${METADATA_BASE}/meta-data/network/interfaces/macs/${mac}/subnet-id`, { headers }).then(r => r.text()),
      fetch(`${METADATA_BASE}/meta-data/placement/availability-zone`, { headers }).then(r => r.text())
    ]);

    return { subnet_id: subnetId, availability_zone: az };
  } catch (e) {
    // Not on EC2, or metadata service unreachable
    return { subnet_id: null, availability_zone: null };
  }
}

async function getStatus() {
  const uptimeSeconds = Number(process.hrtime.bigint() - startTime) / 1e9;
  const network = await getNetworkInfo();

  return {
    status: 'healthy',
    hostname: os.hostname(),
    uptime: `${uptimeSeconds.toFixed(2)}s`,
    memory: {
      total: formatBytes(os.totalmem()),
      free: formatBytes(os.freemem())
    },
    cpu_cores: os.cpus().length,
    network,
    timestamp: new Date().toISOString()
  };
}

// The one and only API endpoint
app.get('/status', async (req, res) => {
  res.json(await getStatus());
});

// Simple browser UI that renders the same data
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`Health API listening on port ${PORT}`);
});