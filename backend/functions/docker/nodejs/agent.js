#!/usr/bin/env node
/**
 * Node.js Function Agent - HTTP server for executing user functions
 */

const http = require('http');
const vm = require('vm');

class FunctionExecutor {
    constructor() {
        this.functionCode = null;
        this.handler = 'handler';
        this.envVars = {};
    }

    loadFunction(code, handler = 'handler', envVars = {}) {
        this.functionCode = code;
        this.handler = handler;
        this.envVars = envVars;

        // Set environment variables
        Object.assign(process.env, envVars);
    }

    async execute(event, timeoutSeconds = 30) {
        if (!this.functionCode) {
            return {
                success: false,
                error: 'No function code loaded',
                logs: '',
                execution_time_ms: 0,
                memory_used_mb: 0
            };
        }

        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;

        const logs = [];
        const originalLog = console.log;
        const originalError = console.error;

        // Capture console output
        console.log = (...args) => logs.push('[STDOUT] ' + args.join(' '));
        console.error = (...args) => logs.push('[STDERR] ' + args.join(' '));

        try {
            // Create sandbox context
            const sandbox = {
                console,
                require,
                process,
                Buffer,
                setTimeout,
                setInterval,
                clearTimeout,
                clearInterval,
                exports: {},
                module: { exports: {} }
            };

            // Execute function code
            vm.runInNewContext(this.functionCode, sandbox, {
                timeout: timeoutSeconds * 1000,
                displayErrors: true
            });

            // Get handler function
            const handlerFunc = sandbox.exports[this.handler] || sandbox.module.exports[this.handler] || sandbox[this.handler];

            if (typeof handlerFunc !== 'function') {
                throw new Error(`Handler function '${this.handler}' not found`);
            }

            // Create context object
            const context = {
                memoryLimitMB: Math.floor(process.memoryUsage().heapTotal / (1024 * 1024)),
                timeoutSeconds
            };

            // Execute with timeout
            const result = await Promise.race([
                handlerFunc(event, context),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error(`Function execution exceeded ${timeoutSeconds} seconds`)),
                    timeoutSeconds * 1000)
                )
            ]);

            const endTime = Date.now();
            const endMemory = process.memoryUsage().heapUsed;

            // Restore console
            console.log = originalLog;
            console.error = originalError;

            return {
                success: true,
                result,
                logs: logs.join('\n'),
                execution_time_ms: endTime - startTime,
                memory_used_mb: Math.max(0, Math.floor((endMemory - startMemory) / (1024 * 1024)))
            };

        } catch (error) {
            const endTime = Date.now();

            // Restore console
            console.log = originalLog;
            console.error = originalError;

            logs.push(`[ERROR] ${error.stack}`);

            return {
                success: false,
                error: `${error.name}: ${error.message}`,
                logs: logs.join('\n'),
                execution_time_ms: endTime - startTime,
                memory_used_mb: 0
            };
        }
    }
}

const executor = new FunctionExecutor();

const server = http.createServer(async (req, res) => {
    // Health check
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', ready: true }));
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);

                if (req.url === '/load') {
                    // Load function
                    executor.loadFunction(data.code, data.handler || 'handler', data.env_vars || {});
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, message: 'Function loaded' }));

                } else if (req.url === '/invoke') {
                    // Invoke function
                    if (data.code) {
                        executor.loadFunction(data.code, data.handler || 'handler', data.env_vars || {});
                    }

                    const result = await executor.execute(data.event || {}, data.timeout_seconds || 30);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result));

                } else {
                    res.writeHead(404);
                    res.end();
                }
            } catch (error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: false,
                    error: error.message,
                    logs: error.stack
                }));
            }
        });
    } else {
        res.writeHead(404);
        res.end();
    }
});

const PORT = 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`[AGENT] Function execution agent running on 0.0.0.0:${PORT}`);
});
