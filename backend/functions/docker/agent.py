#!/usr/bin/env python3
"""
Universal Function Agent for Kubernetes - HTTP server for executing user functions

This agent runs inside each Kubernetes pod and handles:
- Function code loading and execution
- Environment variable injection
- Stdout/stderr capture
- Timeout enforcement
- Result serialization
"""

import json
import sys
import os
import traceback
import time
import io
from http.server import HTTPServer, BaseHTTPRequestHandler, ThreadingHTTPServer
from contextlib import redirect_stdout, redirect_stderr
from typing import Dict, Any, Optional
import resource


class FunctionExecutor:
    """Executes user function code in isolated context"""

    def __init__(self):
        self.function_code: Optional[str] = None
        self.handler_name: str = "handler"
        self.env_vars: Dict[str, str] = {}

    def load_function(self, code: str, handler: str = "handler", env_vars: Optional[Dict[str, str]] = None):
        """Load function code and prepare for execution"""
        self.function_code = code
        self.handler_name = handler
        self.env_vars = env_vars or {}

        # Inject environment variables
        for key, value in self.env_vars.items():
            os.environ[key] = value

    def execute(self, event: Dict[str, Any], timeout_seconds: int = 30) -> Dict[str, Any]:
        """Execute the loaded function with given event data"""
        if not self.function_code:
            return {
                "success": False,
                "error": "No function code loaded",
                "logs": "",
                "execution_time_ms": 0,
                "memory_used_mb": 0
            }

        # Capture stdout/stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        start_time = time.time()
        start_memory = self._get_memory_usage()

        try:
            # Create isolated namespace for function execution
            function_namespace = {
                "__name__": "__main__",
                "__builtins__": __builtins__,
            }

            # Execute function code to define handler
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(self.function_code, function_namespace)

            # Get handler function
            if self.handler_name not in function_namespace:
                raise ValueError(f"Handler function '{self.handler_name}' not found in code")

            handler_func = function_namespace[self.handler_name]

            # Create context object (similar to AWS Lambda)
            context = {
                "memory_limit_mb": self._get_memory_limit(),
                "timeout_seconds": timeout_seconds,
            }

            # Execute handler with timeout using threading
            import threading
            result_container = {"result": None, "error": None, "timed_out": False}

            def run_handler():
                try:
                    with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                        result_container["result"] = handler_func(event, context)
                except Exception as e:
                    result_container["error"] = e

            thread = threading.Thread(target=run_handler)
            thread.daemon = True
            thread.start()
            thread.join(timeout=timeout_seconds)

            if thread.is_alive():
                # Timeout occurred
                result_container["timed_out"] = True
                return {
                    "success": False,
                    "error": f"Function execution exceeded {timeout_seconds} seconds",
                    "logs": stdout_capture.getvalue() + "\n" + stderr_capture.getvalue(),
                    "execution_time_ms": timeout_seconds * 1000,
                    "memory_used_mb": 0
                }

            # Check if error occurred during execution
            if result_container["error"]:
                raise result_container["error"]

            result = result_container["result"]

            end_time = time.time()
            end_memory = self._get_memory_usage()

            # Collect logs
            stdout_logs = stdout_capture.getvalue()
            stderr_logs = stderr_capture.getvalue()
            combined_logs = ""
            if stdout_logs:
                combined_logs += f"[STDOUT]\n{stdout_logs}\n"
            if stderr_logs:
                combined_logs += f"[STDERR]\n{stderr_logs}\n"

            return {
                "success": True,
                "result": result,
                "logs": combined_logs,
                "execution_time_ms": int((end_time - start_time) * 1000),
                "memory_used_mb": max(0, end_memory - start_memory)
            }

        except Exception as e:
            end_time = time.time()

            # Capture full traceback
            error_trace = traceback.format_exc()
            stderr_capture.write(f"\n{error_trace}")

            return {
                "success": False,
                "error": f"{type(e).__name__}: {str(e)}",
                "logs": stdout_capture.getvalue() + "\n" + stderr_capture.getvalue(),
                "execution_time_ms": int((end_time - start_time) * 1000),
                "memory_used_mb": 0
            }

    @staticmethod
    def _get_memory_usage() -> int:
        """Get current memory usage in MB"""
        try:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            # maxrss is in kilobytes on Linux
            return usage.ru_maxrss // 1024
        except Exception:
            return 0

    @staticmethod
    def _get_memory_limit() -> int:
        """Get memory limit from cgroup or system"""
        try:
            # Try to read from cgroup v2 (Kubernetes)
            with open("/sys/fs/cgroup/memory.max", "r") as f:
                limit_bytes = int(f.read().strip())
                if limit_bytes != 9223372036854771712:  # not "max"
                    return limit_bytes // (1024 * 1024)
        except Exception:
            pass

        try:
            # Try cgroup v1
            with open("/sys/fs/cgroup/memory/memory.limit_in_bytes", "r") as f:
                limit_bytes = int(f.read().strip())
                return limit_bytes // (1024 * 1024)
        except Exception:
            pass

        # Fallback to system memory
        try:
            with open("/proc/meminfo", "r") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        kb = int(line.split()[1])
                        return kb // 1024
        except Exception:
            return 128  # Default fallback


class AgentHTTPHandler(BaseHTTPRequestHandler):
    """HTTP request handler for function invocations"""

    executor = FunctionExecutor()

    def do_GET(self):
        """Handle GET requests (health check)"""
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps({"status": "healthy", "ready": True})
            self.wfile.write(response.encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        """Handle POST requests (function invocation and code loading)"""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            data = json.loads(body.decode())
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        if self.path == "/load":
            # Load function code
            self._handle_load(data)
        elif self.path == "/invoke":
            # Execute function
            self._handle_invoke(data)
        else:
            self.send_response(404)
            self.end_headers()

    def _handle_load(self, data: Dict[str, Any]):
        """Handle function code loading"""
        code = data.get("code")
        handler = data.get("handler", "handler")
        env_vars = data.get("env_vars", {})

        if not code:
            self.send_error(400, "Missing 'code' field")
            return

        try:
            self.executor.load_function(code, handler, env_vars)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps({"success": True, "message": "Function loaded"})
            self.wfile.write(response.encode())

        except Exception as e:
            self.send_error(500, f"Failed to load function: {str(e)}")

    def _handle_invoke(self, data: Dict[str, Any]):
        """Handle function invocation"""
        event = data.get("event", {})
        timeout = data.get("timeout_seconds", 30)

        # If code is provided, load it first (for one-shot execution)
        if "code" in data:
            code = data.get("code")
            handler = data.get("handler", "handler")
            env_vars = data.get("env_vars", {})
            self.executor.load_function(code, handler, env_vars)

        try:
            result = self.executor.execute(event, timeout)

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            response = json.dumps(result)
            self.wfile.write(response.encode())

        except Exception as e:
            error_response = {
                "success": False,
                "error": f"Agent error: {str(e)}",
                "logs": traceback.format_exc(),
                "execution_time_ms": 0,
                "memory_used_mb": 0
            }
            self.send_response(500)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(error_response).encode())

    def log_message(self, format, *args):
        """Override to control logging"""
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")


def main():
    """Start the agent HTTP server"""
    host = "0.0.0.0"
    port = 8080

    print(f"[AGENT] Starting function execution agent on {host}:{port}", flush=True)
    sys.stdout.flush()

    # Use ThreadingHTTPServer to handle multiple concurrent requests
    server = ThreadingHTTPServer((host, port), AgentHTTPHandler)

    print(f"[AGENT] Ready to receive function invocations", flush=True)
    sys.stdout.flush()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("[AGENT] Shutting down...", flush=True)
        server.shutdown()


if __name__ == "__main__":
    main()
