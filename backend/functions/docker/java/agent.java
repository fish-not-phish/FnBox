import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import javax.tools.*;
import java.io.*;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLClassLoader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.*;
import java.util.stream.Collectors;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

/**
 * Universal Function Agent for Java
 * HTTP server for executing user Java functions dynamically
 */
public class agent {

    private static final int PORT = 8080;
    private static final Path TEMP_DIR = Paths.get("/tmp/java-functions");

    private static String loadedCode = null;
    private static String handlerName = "handler";
    private static Map<String, String> envVars = new HashMap<>();
    private static Class<?> loadedClass = null;

    public static void main(String[] args) throws IOException {
        // Create temp directory for compiled classes
        Files.createDirectories(TEMP_DIR);

        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);
        server.createContext("/health", new HealthHandler());
        server.createContext("/load", new LoadHandler());
        server.createContext("/invoke", new InvokeHandler());
        server.setExecutor(Executors.newFixedThreadPool(10));

        System.out.println("[AGENT] Starting Java function execution agent on port " + PORT);
        server.start();
        System.out.println("[AGENT] Ready to receive function invocations");
    }

    static class HealthHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if ("GET".equals(exchange.getRequestMethod())) {
                String response = "{\"status\":\"healthy\",\"ready\":true}";
                sendResponse(exchange, 200, response);
            } else {
                exchange.sendResponseHeaders(405, -1);
            }
        }
    }

    static class LoadHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            try {
                String body = readRequestBody(exchange);
                JSONObject json = new JSONObject(body);

                String code = json.optString("code", null);
                if (code == null || code.isEmpty()) {
                    sendError(exchange, 400, "Missing 'code' field");
                    return;
                }

                String handler = json.optString("handler", "handler");
                JSONObject envVarsJson = json.optJSONObject("env_vars");

                Map<String, String> env = new HashMap<>();
                if (envVarsJson != null) {
                    for (String key : envVarsJson.keySet()) {
                        env.put(key, envVarsJson.getString(key));
                    }
                }

                loadFunction(code, handler, env);

                String response = "{\"success\":true,\"message\":\"Function loaded\"}";
                sendResponse(exchange, 200, response);

            } catch (Exception e) {
                sendError(exchange, 500, "Failed to load function: " + e.getMessage());
            }
        }
    }

    static class InvokeHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            if (!"POST".equals(exchange.getRequestMethod())) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            try {
                String body = readRequestBody(exchange);
                JSONObject json = new JSONObject(body);

                // Support one-shot execution
                if (json.has("code")) {
                    String code = json.getString("code");
                    String handler = json.optString("handler", "handler");
                    JSONObject envVarsJson = json.optJSONObject("env_vars");

                    Map<String, String> env = new HashMap<>();
                    if (envVarsJson != null) {
                        for (String key : envVarsJson.keySet()) {
                            env.put(key, envVarsJson.getString(key));
                        }
                    }

                    loadFunction(code, handler, env);
                }

                JSONObject event = json.optJSONObject("event");
                if (event == null) {
                    event = new JSONObject();
                }

                int timeoutSeconds = json.optInt("timeout_seconds", 30);

                JSONObject result = executeFunction(event, timeoutSeconds);
                sendResponse(exchange, 200, result.toString());

            } catch (Exception e) {
                JSONObject errorResponse = new JSONObject();
                errorResponse.put("success", false);
                errorResponse.put("error", "Agent error: " + e.getMessage());
                errorResponse.put("logs", getStackTrace(e));
                errorResponse.put("execution_time_ms", 0);
                errorResponse.put("memory_used_mb", 0);

                sendResponse(exchange, 500, errorResponse.toString());
            }
        }
    }

    private static void loadFunction(String code, String handler, Map<String, String> env) throws Exception {
        loadedCode = code;
        handlerName = handler;
        envVars = env;

        // Set environment variables as system properties
        // Access in user code via System.getProperty("KEY")
        for (Map.Entry<String, String> entry : env.entrySet()) {
            System.setProperty(entry.getKey(), entry.getValue());
        }

        // Extract class name from code
        String className = extractClassName(code);
        if (className == null) {
            throw new Exception("Could not find public class in code");
        }

        // Write source file
        Path sourceFile = TEMP_DIR.resolve(className + ".java");
        Files.writeString(sourceFile, code);

        // Compile the code
        JavaCompiler compiler = ToolProvider.getSystemJavaCompiler();
        if (compiler == null) {
            throw new Exception("Java compiler not available. Make sure you're using JDK, not JRE.");
        }

        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        StandardJavaFileManager fileManager = compiler.getStandardFileManager(diagnostics, null, null);

        Iterable<? extends JavaFileObject> compilationUnits = fileManager.getJavaFileObjects(sourceFile);

        List<String> options = Arrays.asList("-d", TEMP_DIR.toString());
        JavaCompiler.CompilationTask task = compiler.getTask(null, fileManager, diagnostics, options, null, compilationUnits);

        boolean success = task.call();
        fileManager.close();

        if (!success) {
            StringBuilder errors = new StringBuilder("Compilation failed:\n");
            for (Diagnostic<? extends JavaFileObject> diagnostic : diagnostics.getDiagnostics()) {
                errors.append(diagnostic.toString()).append("\n");
            }
            throw new Exception(errors.toString());
        }

        // Load the compiled class
        URLClassLoader classLoader = URLClassLoader.newInstance(new java.net.URL[]{TEMP_DIR.toUri().toURL()});
        loadedClass = classLoader.loadClass(className);
    }

    /**
     * Convert JSONObject to Map<String, Object> for handler invocation
     */
    private static Map<String, Object> jsonObjectToMap(JSONObject jsonObject) {
        if (jsonObject == null) {
            return new HashMap<>();
        }

        Map<String, Object> map = new HashMap<>();
        Iterator<String> keys = jsonObject.keys();

        while (keys.hasNext()) {
            String key = keys.next();
            Object value = jsonObject.get(key);

            if (value instanceof JSONObject) {
                map.put(key, jsonObjectToMap((JSONObject) value));
            } else if (value instanceof JSONArray) {
                map.put(key, jsonArrayToList((JSONArray) value));
            } else {
                map.put(key, value);
            }
        }

        return map;
    }

    /**
     * Convert JSONArray to List for handler invocation
     */
    private static List<Object> jsonArrayToList(JSONArray jsonArray) {
        if (jsonArray == null) {
            return new ArrayList<>();
        }

        List<Object> list = new ArrayList<>();

        for (int i = 0; i < jsonArray.length(); i++) {
            Object value = jsonArray.get(i);

            if (value instanceof JSONObject) {
                list.add(jsonObjectToMap((JSONObject) value));
            } else if (value instanceof JSONArray) {
                list.add(jsonArrayToList((JSONArray) value));
            } else {
                list.add(value);
            }
        }

        return list;
    }

    private static JSONObject executeFunction(JSONObject event, int timeoutSeconds) {
        if (loadedClass == null) {
            JSONObject error = new JSONObject();
            error.put("success", false);
            error.put("error", "No function code loaded");
            error.put("logs", "");
            error.put("execution_time_ms", 0);
            error.put("memory_used_mb", 0);
            return error;
        }

        ByteArrayOutputStream stdout = new ByteArrayOutputStream();
        ByteArrayOutputStream stderr = new ByteArrayOutputStream();
        PrintStream originalOut = System.out;
        PrintStream originalErr = System.err;

        long startTime = System.currentTimeMillis();
        Runtime runtime = Runtime.getRuntime();
        long startMemory = runtime.totalMemory() - runtime.freeMemory();

        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            System.setOut(new PrintStream(stdout));
            System.setErr(new PrintStream(stderr));

            // Find handler method
            Method handlerMethod = null;
            for (Method method : loadedClass.getDeclaredMethods()) {
                if (method.getName().equals(handlerName)) {
                    handlerMethod = method;
                    break;
                }
            }

            if (handlerMethod == null) {
                throw new Exception("Handler method '" + handlerName + "' not found in class");
            }

            final Method finalHandlerMethod = handlerMethod;
            Object instance = loadedClass.getDeclaredConstructor().newInstance();

            // Create context
            JSONObject contextJson = new JSONObject();
            contextJson.put("memory_limit_mb", getMemoryLimit());
            contextJson.put("timeout_seconds", timeoutSeconds);

            // Convert JSONObjects to Maps for handler invocation
            Map<String, Object> eventMap = jsonObjectToMap(event);
            Map<String, Object> contextMap = jsonObjectToMap(contextJson);

            // Execute with timeout
            Future<Object> future = executor.submit(() -> {
                try {
                    if (finalHandlerMethod.getParameterCount() == 2) {
                        return finalHandlerMethod.invoke(instance, eventMap, contextMap);
                    } else if (finalHandlerMethod.getParameterCount() == 1) {
                        return finalHandlerMethod.invoke(instance, eventMap);
                    } else {
                        return finalHandlerMethod.invoke(instance);
                    }
                } catch (Exception e) {
                    throw new RuntimeException(e.getCause() != null ? e.getCause() : e);
                }
            });

            Object result;
            try {
                result = future.get(timeoutSeconds, TimeUnit.SECONDS);
            } catch (TimeoutException e) {
                future.cancel(true);
                throw new Exception("Function execution exceeded " + timeoutSeconds + " seconds");
            }

            long endTime = System.currentTimeMillis();
            long endMemory = runtime.totalMemory() - runtime.freeMemory();

            System.setOut(originalOut);
            System.setErr(originalErr);

            String logs = buildLogs(stdout.toString(), stderr.toString());

            JSONObject response = new JSONObject();
            response.put("success", true);
            response.put("result", result);
            response.put("logs", logs);
            response.put("execution_time_ms", endTime - startTime);
            response.put("memory_used_mb", Math.max(0, (endMemory - startMemory) / (1024 * 1024)));

            return response;

        } catch (Exception e) {
            long endTime = System.currentTimeMillis();

            System.setOut(originalOut);
            System.setErr(originalErr);

            String logs = buildLogs(stdout.toString(), stderr.toString() + "\n" + getStackTrace(e));

            JSONObject error = new JSONObject();
            error.put("success", false);
            error.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
            error.put("logs", logs);
            error.put("execution_time_ms", endTime - startTime);
            error.put("memory_used_mb", 0);

            return error;
        } finally {
            executor.shutdownNow();
        }
    }

    private static String extractClassName(String code) {
        // Simple regex to find public class name
        String[] lines = code.split("\n");
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("public class ")) {
                String[] parts = trimmed.split("\\s+");
                for (int i = 0; i < parts.length - 1; i++) {
                    if (parts[i].equals("class")) {
                        return parts[i + 1].split("[{<]")[0];
                    }
                }
            }
        }
        return null;
    }

    private static String buildLogs(String stdout, String stderr) {
        StringBuilder logs = new StringBuilder();
        if (!stdout.isEmpty()) {
            logs.append("[STDOUT]\n").append(stdout).append("\n");
        }
        if (!stderr.isEmpty()) {
            logs.append("[STDERR]\n").append(stderr).append("\n");
        }
        return logs.toString();
    }

    private static long getMemoryLimit() {
        Runtime runtime = Runtime.getRuntime();
        return runtime.maxMemory() / (1024 * 1024);
    }

    private static String getStackTrace(Exception e) {
        StringWriter sw = new StringWriter();
        PrintWriter pw = new PrintWriter(sw);
        e.printStackTrace(pw);
        return sw.toString();
    }

    private static String readRequestBody(HttpExchange exchange) throws IOException {
        InputStream is = exchange.getRequestBody();
        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    private static void sendResponse(HttpExchange exchange, int statusCode, String response) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(statusCode, bytes.length);
        OutputStream os = exchange.getResponseBody();
        os.write(bytes);
        os.close();
    }

    private static void sendError(HttpExchange exchange, int statusCode, String message) throws IOException {
        JSONObject error = new JSONObject();
        error.put("error", message);
        sendResponse(exchange, statusCode, error.toString());
    }
}
