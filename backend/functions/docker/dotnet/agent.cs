using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Reflection;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Emit;

namespace FunctionAgent
{
    public class Program
    {
        private const int Port = 8080;
        private static string? loadedCode;
        private static string handlerName = "Handler";
        private static Dictionary<string, string> envVars = new();
        private static Assembly? loadedAssembly;
        private static Type? loadedType;

        public static async Task Main(string[] args)
        {
            var listener = new HttpListener();
            listener.Prefixes.Add($"http://*:{Port}/");
            listener.Start();

            Console.WriteLine($"[AGENT] Starting .NET function execution agent on port {Port}");
            Console.WriteLine("[AGENT] Ready to receive function invocations");

            while (true)
            {
                try
                {
                    var context = await listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequest(context));
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"[AGENT] Error: {ex.Message}");
                }
            }
        }

        private static async Task HandleRequest(HttpListenerContext context)
        {
            var request = context.Request;
            var response = context.Response;

            try
            {
                if (request.HttpMethod == "GET" && request.Url?.AbsolutePath == "/health")
                {
                    await HandleHealth(response);
                }
                else if (request.HttpMethod == "POST" && request.Url?.AbsolutePath == "/load")
                {
                    await HandleLoad(request, response);
                }
                else if (request.HttpMethod == "POST" && request.Url?.AbsolutePath == "/invoke")
                {
                    await HandleInvoke(request, response);
                }
                else
                {
                    response.StatusCode = 404;
                    response.Close();
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[AGENT] Request error: {ex.Message}");
                response.StatusCode = 500;
                response.Close();
            }
        }

        private static async Task HandleHealth(HttpListenerResponse response)
        {
            var result = JsonSerializer.Serialize(new { status = "healthy", ready = true });
            await SendResponse(response, 200, result);
        }

        private static async Task HandleLoad(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                var body = await ReadRequestBody(request);
                var json = JsonNode.Parse(body)?.AsObject();

                if (json == null)
                {
                    await SendError(response, 400, "Invalid JSON");
                    return;
                }

                var code = json["code"]?.GetValue<string>();
                if (string.IsNullOrEmpty(code))
                {
                    await SendError(response, 400, "Missing 'code' field");
                    return;
                }

                var handler = json["handler"]?.GetValue<string>() ?? "Handler";
                var envVarsNode = json["env_vars"]?.AsObject();

                var env = new Dictionary<string, string>();
                if (envVarsNode != null)
                {
                    foreach (var kvp in envVarsNode)
                    {
                        env[kvp.Key] = kvp.Value?.GetValue<string>() ?? "";
                    }
                }

                LoadFunction(code, handler, env);

                var result = JsonSerializer.Serialize(new { success = true, message = "Function loaded" });
                await SendResponse(response, 200, result);
            }
            catch (Exception ex)
            {
                await SendError(response, 500, $"Failed to load function: {ex.Message}");
            }
        }

        private static async Task HandleInvoke(HttpListenerRequest request, HttpListenerResponse response)
        {
            try
            {
                var body = await ReadRequestBody(request);
                var json = JsonNode.Parse(body)?.AsObject();

                if (json == null)
                {
                    await SendError(response, 400, "Invalid JSON");
                    return;
                }

                // Support one-shot execution
                if (json["code"] != null)
                {
                    var code = json["code"]!.GetValue<string>();
                    var handler = json["handler"]?.GetValue<string>() ?? "Handler";
                    var envVarsNode = json["env_vars"]?.AsObject();

                    var env = new Dictionary<string, string>();
                    if (envVarsNode != null)
                    {
                        foreach (var kvp in envVarsNode)
                        {
                            env[kvp.Key] = kvp.Value?.GetValue<string>() ?? "";
                        }
                    }

                    LoadFunction(code, handler, env);
                }

                var eventNode = json["event"]?.AsObject() ?? new JsonObject();
                var timeoutSeconds = json["timeout_seconds"]?.GetValue<int>() ?? 30;

                var result = await ExecuteFunction(eventNode, timeoutSeconds);
                await SendResponse(response, 200, result);
            }
            catch (Exception ex)
            {
                var errorResponse = JsonSerializer.Serialize(new
                {
                    success = false,
                    error = $"Agent error: {ex.Message}",
                    logs = ex.ToString(),
                    execution_time_ms = 0,
                    memory_used_mb = 0
                });
                await SendResponse(response, 500, errorResponse);
            }
        }

        private static void LoadFunction(string code, string handler, Dictionary<string, string> env)
        {
            loadedCode = code;
            handlerName = handler;
            envVars = env;

            // Set environment variables
            foreach (var kvp in env)
            {
                Environment.SetEnvironmentVariable(kvp.Key, kvp.Value);
            }

            // Compile the code
            var syntaxTree = CSharpSyntaxTree.ParseText(code);

            var assemblyName = $"UserFunction_{Guid.NewGuid():N}";

            var references = new List<MetadataReference>
            {
                MetadataReference.CreateFromFile(typeof(object).Assembly.Location),
                MetadataReference.CreateFromFile(typeof(Console).Assembly.Location),
                MetadataReference.CreateFromFile(typeof(Enumerable).Assembly.Location),
                MetadataReference.CreateFromFile(Assembly.Load("System.Runtime").Location),
                MetadataReference.CreateFromFile(Assembly.Load("System.Collections").Location),
                MetadataReference.CreateFromFile(Assembly.Load("System.Linq").Location),
                MetadataReference.CreateFromFile(Assembly.Load("System.Net.Http").Location),
                MetadataReference.CreateFromFile(typeof(JsonSerializer).Assembly.Location),
            };

            var compilation = CSharpCompilation.Create(
                assemblyName,
                syntaxTrees: new[] { syntaxTree },
                references: references,
                options: new CSharpCompilationOptions(OutputKind.DynamicallyLinkedLibrary));

            using var ms = new MemoryStream();
            EmitResult result = compilation.Emit(ms);

            if (!result.Success)
            {
                var errors = string.Join("\n", result.Diagnostics
                    .Where(d => d.Severity == DiagnosticSeverity.Error)
                    .Select(d => d.ToString()));
                throw new Exception($"Compilation failed:\n{errors}");
            }

            ms.Seek(0, SeekOrigin.Begin);
            loadedAssembly = Assembly.Load(ms.ToArray());

            // Find the type containing the handler
            loadedType = null;
            foreach (var type in loadedAssembly.GetTypes())
            {
                if (type.GetMethod(handlerName) != null)
                {
                    loadedType = type;
                    break;
                }
            }

            if (loadedType == null)
            {
                throw new Exception($"Could not find handler method '{handlerName}' in compiled code");
            }
        }

        /// <summary>
        /// Convert JsonObject to Dictionary<string, object> for handler invocation
        /// </summary>
        private static Dictionary<string, object> JsonObjectToDictionary(JsonObject? jsonObject)
        {
            if (jsonObject == null)
            {
                return new Dictionary<string, object>();
            }

            var dictionary = new Dictionary<string, object>();

            foreach (var kvp in jsonObject)
            {
                if (kvp.Value == null)
                {
                    dictionary[kvp.Key] = null!;
                }
                else if (kvp.Value is JsonObject nestedObject)
                {
                    dictionary[kvp.Key] = JsonObjectToDictionary(nestedObject);
                }
                else if (kvp.Value is JsonArray jsonArray)
                {
                    dictionary[kvp.Key] = JsonArrayToList(jsonArray);
                }
                else
                {
                    // Handle JsonValue types
                    var jsonValue = kvp.Value.AsValue();
                    dictionary[kvp.Key] = jsonValue.GetValue<object>();
                }
            }

            return dictionary;
        }

        /// <summary>
        /// Convert JsonArray to List<object> for handler invocation
        /// </summary>
        private static List<object> JsonArrayToList(JsonArray? jsonArray)
        {
            if (jsonArray == null)
            {
                return new List<object>();
            }

            var list = new List<object>();

            foreach (var item in jsonArray)
            {
                if (item == null)
                {
                    list.Add(null!);
                }
                else if (item is JsonObject nestedObject)
                {
                    list.Add(JsonObjectToDictionary(nestedObject));
                }
                else if (item is JsonArray nestedArray)
                {
                    list.Add(JsonArrayToList(nestedArray));
                }
                else
                {
                    // Handle JsonValue types
                    var jsonValue = item.AsValue();
                    list.Add(jsonValue.GetValue<object>());
                }
            }

            return list;
        }

        private static async Task<string> ExecuteFunction(JsonObject eventData, int timeoutSeconds)
        {
            if (loadedAssembly == null || loadedType == null)
            {
                return JsonSerializer.Serialize(new
                {
                    success = false,
                    error = "No function code loaded",
                    logs = "",
                    execution_time_ms = 0,
                    memory_used_mb = 0
                });
            }

            var stdoutWriter = new StringWriter();
            var stderrWriter = new StringWriter();
            var originalOut = Console.Out;
            var originalErr = Console.Error;

            var stopwatch = Stopwatch.StartNew();
            var startMemory = GC.GetTotalMemory(false);

            try
            {
                Console.SetOut(stdoutWriter);
                Console.SetError(stderrWriter);

                var method = loadedType.GetMethod(handlerName);
                if (method == null)
                {
                    throw new Exception($"Handler method '{handlerName}' not found");
                }

                var instance = Activator.CreateInstance(loadedType);

                // Create context
                var contextJson = new JsonObject
                {
                    ["memory_limit_mb"] = GetMemoryLimit(),
                    ["timeout_seconds"] = timeoutSeconds
                };

                // Convert JsonObjects to Dictionaries for handler invocation
                var eventDict = JsonObjectToDictionary(eventData);
                var contextDict = JsonObjectToDictionary(contextJson);

                // Execute with timeout
                object? result;
                using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSeconds));

                var task = Task.Run(() =>
                {
                    try
                    {
                        var parameters = method.GetParameters();
                        if (parameters.Length == 2)
                        {
                            return method.Invoke(instance, new object[] { eventDict, contextDict });
                        }
                        else if (parameters.Length == 1)
                        {
                            return method.Invoke(instance, new object[] { eventDict });
                        }
                        else
                        {
                            return method.Invoke(instance, null);
                        }
                    }
                    catch (Exception ex)
                    {
                        throw ex.InnerException ?? ex;
                    }
                }, cts.Token);

                try
                {
                    result = await task;
                }
                catch (OperationCanceledException)
                {
                    throw new TimeoutException($"Function execution exceeded {timeoutSeconds} seconds");
                }

                stopwatch.Stop();
                var endMemory = GC.GetTotalMemory(false);

                Console.SetOut(originalOut);
                Console.SetError(originalErr);

                var logs = BuildLogs(stdoutWriter.ToString(), stderrWriter.ToString());

                return JsonSerializer.Serialize(new
                {
                    success = true,
                    result = result,
                    logs = logs,
                    execution_time_ms = stopwatch.ElapsedMilliseconds,
                    memory_used_mb = Math.Max(0, (endMemory - startMemory) / (1024 * 1024))
                });
            }
            catch (Exception ex)
            {
                stopwatch.Stop();

                Console.SetOut(originalOut);
                Console.SetError(originalErr);

                var logs = BuildLogs(stdoutWriter.ToString(), stderrWriter.ToString() + "\n" + ex.ToString());

                return JsonSerializer.Serialize(new
                {
                    success = false,
                    error = $"{ex.GetType().Name}: {ex.Message}",
                    logs = logs,
                    execution_time_ms = stopwatch.ElapsedMilliseconds,
                    memory_used_mb = 0
                });
            }
        }

        private static string BuildLogs(string stdout, string stderr)
        {
            var logs = new StringBuilder();
            if (!string.IsNullOrEmpty(stdout))
            {
                logs.Append("[STDOUT]\n").Append(stdout).Append("\n");
            }
            if (!string.IsNullOrEmpty(stderr))
            {
                logs.Append("[STDERR]\n").Append(stderr).Append("\n");
            }
            return logs.ToString();
        }

        private static long GetMemoryLimit()
        {
            return GC.GetGCMemoryInfo().TotalAvailableMemoryBytes / (1024 * 1024);
        }

        private static async Task<string> ReadRequestBody(HttpListenerRequest request)
        {
            using var reader = new StreamReader(request.InputStream, request.ContentEncoding);
            return await reader.ReadToEndAsync();
        }

        private static async Task SendResponse(HttpListenerResponse response, int statusCode, string content)
        {
            response.StatusCode = statusCode;
            response.ContentType = "application/json";
            var buffer = Encoding.UTF8.GetBytes(content);
            response.ContentLength64 = buffer.Length;
            await response.OutputStream.WriteAsync(buffer);
            response.Close();
        }

        private static async Task SendError(HttpListenerResponse response, int statusCode, string message)
        {
            var error = JsonSerializer.Serialize(new { error = message });
            await SendResponse(response, statusCode, error);
        }
    }
}
