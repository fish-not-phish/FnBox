package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

const (
	port    = 8080
	tempDir = "/tmp/go-functions"
)

var (
	loadedCode    string
	handlerName   = "Handler"
	envVars       = make(map[string]string)
	useInterpreter = true
)

type LoadRequest struct {
	Code     string            `json:"code"`
	Handler  string            `json:"handler"`
	EnvVars  map[string]string `json:"env_vars"`
}

type InvokeRequest struct {
	Code           string                 `json:"code"`
	Handler        string                 `json:"handler"`
	Event          map[string]interface{} `json:"event"`
	EnvVars        map[string]string      `json:"env_vars"`
	TimeoutSeconds int                    `json:"timeout_seconds"`
}

type ExecutionResult struct {
	Success         bool        `json:"success"`
	Result          interface{} `json:"result,omitempty"`
	Error           string      `json:"error,omitempty"`
	Logs            string      `json:"logs"`
	ExecutionTimeMs int64       `json:"execution_time_ms"`
	MemoryUsedMb    int64       `json:"memory_used_mb"`
}

func main() {
	// Create temp directory
	os.MkdirAll(tempDir, 0755)

	http.HandleFunc("/health", healthHandler)
	http.HandleFunc("/load", loadHandler)
	http.HandleFunc("/invoke", invokeHandler)

	addr := fmt.Sprintf(":%d", port)
	log.Printf("[AGENT] Starting Go function execution agent on port %d\n", port)
	log.Printf("[AGENT] Ready to receive function invocations\n")

	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatalf("[AGENT] Failed to start server: %v\n", err)
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status": "healthy",
		"ready":  true,
	})
}

func loadHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req LoadRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	if req.Code == "" {
		sendError(w, http.StatusBadRequest, "Missing 'code' field")
		return
	}

	if req.Handler == "" {
		req.Handler = "Handler"
	}

	if err := loadFunction(req.Code, req.Handler, req.EnvVars); err != nil {
		sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to load function: %v", err))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"message": "Function loaded",
	})
}

func invokeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req InvokeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		sendError(w, http.StatusBadRequest, "Invalid JSON")
		return
	}

	// Support one-shot execution
	if req.Code != "" {
		if req.Handler == "" {
			req.Handler = "Handler"
		}
		if err := loadFunction(req.Code, req.Handler, req.EnvVars); err != nil {
			sendError(w, http.StatusInternalServerError, fmt.Sprintf("Failed to load function: %v", err))
			return
		}
	}

	if req.Event == nil {
		req.Event = make(map[string]interface{})
	}

	if req.TimeoutSeconds == 0 {
		req.TimeoutSeconds = 30
	}

	result := executeFunction(req.Event, req.TimeoutSeconds)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func loadFunction(code, handler string, env map[string]string) error {
	loadedCode = code
	handlerName = handler
	envVars = env

	// Set environment variables
	for key, value := range env {
		os.Setenv(key, value)
	}

	// Validate code syntax by trying to parse it
	// We'll use yaegi interpreter for dynamic execution
	return nil
}

func executeFunction(event map[string]interface{}, timeoutSeconds int) ExecutionResult {
	if loadedCode == "" {
		return ExecutionResult{
			Success:         false,
			Error:           "No function code loaded",
			Logs:            "",
			ExecutionTimeMs: 0,
			MemoryUsedMb:    0,
		}
	}

	// Capture stdout/stderr
	var stdoutBuf, stderrBuf bytes.Buffer
	oldStdout := os.Stdout
	oldStderr := os.Stderr

	rOut, wOut, _ := os.Pipe()
	rErr, wErr, _ := os.Pipe()

	os.Stdout = wOut
	os.Stderr = wErr

	// Goroutines to capture output
	go io.Copy(&stdoutBuf, rOut)
	go io.Copy(&stderrBuf, rErr)

	startTime := time.Now()
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	startMemory := memStats.Alloc

	// Create context with timeout
	ctx, cancel := context.WithTimeout(context.Background(), time.Duration(timeoutSeconds)*time.Second)
	defer cancel()

	// Execute function
	result, err := executeFunctionWithCompile(ctx, event, timeoutSeconds)

	execTime := time.Since(startTime).Milliseconds()

	// Restore stdout/stderr
	wOut.Close()
	wErr.Close()
	os.Stdout = oldStdout
	os.Stderr = oldStderr

	time.Sleep(10 * time.Millisecond) // Allow goroutines to finish

	runtime.ReadMemStats(&memStats)
	endMemory := memStats.Alloc

	stdout := stdoutBuf.String()
	stderr := stderrBuf.String()

	logs := buildLogs(stdout, stderr)

	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return ExecutionResult{
				Success:         false,
				Error:           fmt.Sprintf("Function execution exceeded %d seconds", timeoutSeconds),
				Logs:            logs,
				ExecutionTimeMs: int64(timeoutSeconds * 1000),
				MemoryUsedMb:    0,
			}
		}

		logs = buildLogs(stdout, stderr+"\n"+err.Error())
		return ExecutionResult{
			Success:         false,
			Error:           err.Error(),
			Logs:            logs,
			ExecutionTimeMs: execTime,
			MemoryUsedMb:    0,
		}
	}

	memoryUsed := int64(0)
	if endMemory > startMemory {
		memoryUsed = int64(endMemory-startMemory) / (1024 * 1024)
	}

	return ExecutionResult{
		Success:         true,
		Result:          result,
		Logs:            logs,
		ExecutionTimeMs: execTime,
		MemoryUsedMb:    memoryUsed,
	}
}

// cleanUserCode removes package declarations and extracts imports from user code
func cleanUserCode(code string) (cleanedCode string, imports []string) {
	lines := strings.Split(code, "\n")
	var codeLines []string
	imports = []string{}
	inImportBlock := false

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		// Skip package declarations
		if strings.HasPrefix(trimmed, "package ") {
			continue
		}

		// Handle import blocks
		if strings.HasPrefix(trimmed, "import (") {
			inImportBlock = true
			continue
		}

		if inImportBlock {
			if trimmed == ")" {
				inImportBlock = false
				continue
			}
			// Extract import
			if trimmed != "" {
				imports = append(imports, trimmed)
			}
			continue
		}

		// Handle single-line imports
		if strings.HasPrefix(trimmed, "import ") {
			// Extract the import path
			importPath := strings.TrimPrefix(trimmed, "import ")
			importPath = strings.TrimSpace(importPath)
			imports = append(imports, importPath)
			continue
		}

		// Keep all other lines
		codeLines = append(codeLines, line)
	}

	cleanedCode = strings.Join(codeLines, "\n")
	return cleanedCode, imports
}

func executeFunctionWithInterpreter(ctx context.Context, event map[string]interface{}, timeoutSeconds int) (interface{}, error) {
	// Use yaegi interpreter for dynamic Go code execution
	i := interp.New(interp.Options{})

	// Import standard library
	i.Use(stdlib.Symbols)

	// Clean user code and extract imports
	cleanedCode, userImports := cleanUserCode(loadedCode)

	// Build import list (include user imports)
	defaultImports := []string{`"encoding/json"`, `"fmt"`, `"os"`}
	allImports := make(map[string]bool)
	for _, imp := range defaultImports {
		allImports[imp] = true
	}
	for _, imp := range userImports {
		allImports[imp] = true
	}

	// Build import block
	importBlock := "import (\n"
	for imp := range allImports {
		importBlock += "\t" + imp + "\n"
	}
	importBlock += ")\n"

	// Prepare the code with package and imports
	fullCode := "package main\n\n" + importBlock + "\n" + cleanedCode

	// Evaluate the code
	if _, err := i.Eval(fullCode); err != nil {
		return nil, fmt.Errorf("code evaluation error: %v", err)
	}

	// Get the handler function
	handlerVal, err := i.Eval("main." + handlerName)
	if err != nil {
		return nil, fmt.Errorf("handler function '%s' not found: %v", handlerName, err)
	}

	// Create context map
	contextMap := map[string]interface{}{
		"timeout_seconds": timeoutSeconds,
		"memory_limit_mb": getMemoryLimit(),
	}

	// Execute in goroutine with timeout
	type execResult struct {
		result interface{}
		err    error
	}

	resultChan := make(chan execResult, 1)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				resultChan <- execResult{err: fmt.Errorf("panic: %v", r)}
			}
		}()

		// Call the handler function
		// Try to call with different signatures
		handler := handlerVal.Interface()

		// Marshal event and context for function call
		eventJSON, _ := json.Marshal(event)
		contextJSON, _ := json.Marshal(contextMap)

		// We need to call the function with proper types
		// This is a simplified approach - in production, use reflection more carefully
		result, err := callHandlerFunction(handler, eventJSON, contextJSON)
		resultChan <- execResult{result: result, err: err}
	}()

	select {
	case res := <-resultChan:
		return res.result, res.err
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func callHandlerFunction(handler interface{}, eventJSON, contextJSON []byte) (interface{}, error) {
	// This is a simplified call - in production, use proper reflection
	// to handle different function signatures

	// For now, we'll create a simple wrapper that calls the function
	// and captures the result

	var event map[string]interface{}
	var context map[string]interface{}
	json.Unmarshal(eventJSON, &event)
	json.Unmarshal(contextJSON, &context)

	// Try to execute as a simple function that returns string or interface{}
	switch fn := handler.(type) {
	// Functions returning (interface{}, error)
	case func(map[string]interface{}, map[string]interface{}) (interface{}, error):
		return fn(event, context)
	case func(map[string]interface{}) (interface{}, error):
		return fn(event)
	case func(interface{}) (interface{}, error):
		var eventIface interface{}
		json.Unmarshal(eventJSON, &eventIface)
		return fn(eventIface)

	// Functions returning interface{} without error
	case func(map[string]interface{}, map[string]interface{}) interface{}:
		result := fn(event, context)
		return result, nil
	case func(map[string]interface{}) interface{}:
		result := fn(event)
		return result, nil

	// Functions returning map[string]interface{} (common pattern)
	case func(map[string]interface{}, map[string]interface{}) map[string]interface{}:
		result := fn(event, context)
		return result, nil
	case func(map[string]interface{}) map[string]interface{}:
		result := fn(event)
		return result, nil

	// Functions returning string
	case func(map[string]interface{}, map[string]interface{}) string:
		result := fn(event, context)
		return result, nil
	case func(map[string]interface{}) string:
		result := fn(event)
		return result, nil

	default:
		// Fallback: return error for unsupported signature
		return nil, fmt.Errorf("unsupported handler signature: %T. Expected func(map[string]interface{}, map[string]interface{}) map[string]interface{} or similar", handler)
	}
}

func buildLogs(stdout, stderr string) string {
	var logs strings.Builder

	if stdout != "" {
		logs.WriteString("[STDOUT]\n")
		logs.WriteString(stdout)
		logs.WriteString("\n")
	}

	if stderr != "" {
		logs.WriteString("[STDERR]\n")
		logs.WriteString(stderr)
		logs.WriteString("\n")
	}

	return logs.String()
}

func getMemoryLimit() int64 {
	// Try to read from cgroup
	if data, err := os.ReadFile("/sys/fs/cgroup/memory.max"); err == nil {
		var limit int64
		fmt.Sscanf(string(data), "%d", &limit)
		if limit > 0 && limit < 9223372036854771712 {
			return limit / (1024 * 1024)
		}
	}

	// Fallback to system memory
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)
	return int64(memStats.Sys / (1024 * 1024))
}

func sendError(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]string{
		"error": message,
	})
}

// Alternative: Compile and execute as plugin (more complex, requires proper Go module setup)
func executeFunctionWithCompile(ctx context.Context, event map[string]interface{}, timeoutSeconds int) (interface{}, error) {
	// Create temporary directory for this execution
	execDir := filepath.Join(tempDir, fmt.Sprintf("exec_%d", time.Now().UnixNano()))
	os.MkdirAll(execDir, 0755)
	defer os.RemoveAll(execDir)

	// Clean user code and extract imports
	cleanedCode, userImports := cleanUserCode(loadedCode)

	// Build import list
	defaultImports := []string{`"encoding/json"`, `"fmt"`, `"os"`}
	allImports := make(map[string]bool)
	for _, imp := range defaultImports {
		allImports[imp] = true
	}
	for _, imp := range userImports {
		allImports[imp] = true
	}

	// Build import block
	importBlock := "import (\n"
	for imp := range allImports {
		importBlock += "\t" + imp + "\n"
	}
	importBlock += ")\n"

	// Write function code to file
	functionFile := filepath.Join(execDir, "function.go")

	// Wrap code in proper package structure
	fullCode := fmt.Sprintf(`package main

%s

%s

func main() {
	// Read event from environment
	var event map[string]interface{}
	eventStr := os.Getenv("EVENT")
	if eventStr != "" {
		json.Unmarshal([]byte(eventStr), &event)
	}

	context := map[string]interface{}{
		"timeout_seconds": %d,
	}

	result := %s(event, context)
	output, _ := json.Marshal(result)
	fmt.Println(string(output))
}
`, importBlock, cleanedCode, timeoutSeconds, handlerName)

	if err := os.WriteFile(functionFile, []byte(fullCode), 0644); err != nil {
		return nil, fmt.Errorf("failed to write function file: %v", err)
	}

	// Initialize go.mod if /packages/go.mod exists (has dependencies)
	packagesModPath := "/packages/go.mod"
	if _, err := os.Stat(packagesModPath); err == nil {
		// Copy go.mod and go.sum from /packages
		exec.CommandContext(ctx, "cp", packagesModPath, filepath.Join(execDir, "go.mod")).Run()
		packagesSumPath := "/packages/go.sum"
		if _, err := os.Stat(packagesSumPath); err == nil {
			exec.CommandContext(ctx, "cp", packagesSumPath, filepath.Join(execDir, "go.sum")).Run()
		}
	} else {
		// No dependencies, create a simple go.mod
		goModContent := "module function\n\ngo 1.25\n"
		os.WriteFile(filepath.Join(execDir, "go.mod"), []byte(goModContent), 0644)
	}

	// Compile the function
	binaryFile := filepath.Join(execDir, "function")
	cmd := exec.CommandContext(ctx, "go", "build", "-mod=readonly", "-o", binaryFile, functionFile)
	cmd.Dir = execDir

	// Set environment to use cached modules
	env := os.Environ()
	// Ensure GOMODCACHE is set
	gomodcache := os.Getenv("GOMODCACHE")
	if gomodcache == "" {
		gomodcache = "/packages/pkg/mod"
		env = append(env, "GOMODCACHE="+gomodcache)
	}
	cmd.Env = env

	if output, err := cmd.CombinedOutput(); err != nil {
		return nil, fmt.Errorf("compilation failed: %v\n%s", err, output)
	}

	// Execute the compiled binary
	cmd = exec.CommandContext(ctx, binaryFile)
	eventJSON, _ := json.Marshal(event)
	cmd.Env = append(os.Environ(), "EVENT="+string(eventJSON))

	output, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("execution failed: %v\n%s", err, output)
	}

	// Parse result
	var result interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		return string(output), nil
	}

	return result, nil
}
