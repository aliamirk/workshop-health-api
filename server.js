const cluster = require('cluster');
const os = require('os');
const express = require('express');

const PORT = process.env.PORT || 3000;

const CPU_ITERATIONS = 200000;

if (cluster.isPrimary) {
    const workers = os.cpus().length;

    console.log('Primary process: ' + process.pid);
    console.log('Starting ' + workers + ' workers');

    for (let i = 0; i < workers; i++) {
        cluster.fork();
    }

    // Auto-restart workers if any crash during load testing
    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} exited. Respawning...`);
        cluster.fork();
    });

} else {
    const app = express();

    // High-RPS performance tweak: disable unnecessary header serialization
    app.disable('x-powered-by');

    const startTime = process.hrtime.bigint();

    function formatBytes(bytes) {
        return Math.round(bytes / (1024 * 1024)) + ' MB';
    }

    const HOSTNAME = os.hostname();
    const TOTAL_MEMORY = formatBytes(os.totalmem());
    const CPU_CORES = os.cpus().length;

    const SUBNET_ID = process.env.SUBNET_ID || 'NA';
    const AVAILABILITY_ZONE = process.env.AVAILABILITY_ZONE || 'NA';

    function getStatus() {
        const uptimeSeconds =
            Number(process.hrtime.bigint() - startTime) / 1e9;

        return {
            status: 'healthy',
            hostname: HOSTNAME,
            worker_pid: process.pid,
            uptime: uptimeSeconds.toFixed(2) + 's',
            memory: {
                total: TOTAL_MEMORY,
                free: formatBytes(os.freemem())
            },
            cpu_cores: CPU_CORES,
            network: {
                subnet_id: SUBNET_ID,
                availability_zone: AVAILABILITY_ZONE
            },
            timestamp: new Date().toISOString()
        };
    }

    app.get('/status', (req, res) => {
        res.json(getStatus());
    });

    app.get('/cpu', (req, res) => {
        let result = 0;

        // Perform fast arithmetic operations that prevent V8 loop-unrolling optimizations
        for (let i = 0; i < CPU_ITERATIONS; i++) {
            result = (result + i) ^ (i & 0xFF);
        }

        res.json({
            status: 'ok',
            worker_pid: process.pid,
            iterations: CPU_ITERATIONS,
            result: result
        });
    });

    app.use(express.static(__dirname));

    app.listen(PORT, '0.0.0.0', 4096, () => {
        console.log(
            'Worker ' + process.pid +
            ' listening on port ' + PORT
        );
    });
}