#!/usr/bin/env bash
# Bash function execution agent
set -euo pipefail

PORT="${PORT:-8080}"
FUNCTION_CODE=""
HANDLER_NAME="handler"
TEMP_DIR="/tmp/bash-functions"

# Create temp directory
mkdir -p "$TEMP_DIR"

# Function to send HTTP response
send_response() {
    local status_code="$1"
    local body="$2"
    local content_length=${#body}

    printf "HTTP/1.1 %s OK\r\n" "$status_code"
    printf "Content-Type: application/json\r\n"
    printf "Content-Length: %s\r\n" "$content_length"
    printf "Connection: close\r\n"
    printf "\r\n"
    printf "%s" "$body"
}

# Load function endpoint
handle_load() {
    local request_body="$1"

    # Parse JSON (requires jq)
    FUNCTION_CODE=$(echo "$request_body" | jq -r '.code // empty')
    HANDLER_NAME=$(echo "$request_body" | jq -r '.handler // "handler"')

    # Parse environment variables
    local env_json=$(echo "$request_body" | jq -r '.env_vars // {}')
    if [[ -n "$env_json" && "$env_json" != "{}" ]]; then
        while IFS="=" read -r key value; do
            export "$key=$value"
        done < <(echo "$env_json" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"')
    fi

    # Validate the function code by checking if handler exists
    if [[ -z "$FUNCTION_CODE" ]]; then
        send_response 500 '{"success":false,"error":"No function code provided"}'
        return
    fi

    # Try to validate the syntax
    if ! bash -n <(echo "$FUNCTION_CODE") 2>/dev/null; then
        send_response 500 '{"success":false,"error":"Syntax error in function code"}'
        return
    fi

    send_response 200 '{"success":true,"message":"Function loaded"}'
}

# Invoke function endpoint
handle_invoke() {
    local request_body="$1"
    local start_time=$(date +%s%3N)

    # Support one-shot execution
    local code=$(echo "$request_body" | jq -r '.code // empty')
    if [[ -n "$code" ]]; then
        FUNCTION_CODE="$code"
        HANDLER_NAME=$(echo "$request_body" | jq -r '.handler // "handler"')

        # Parse environment variables
        local env_json=$(echo "$request_body" | jq -r '.env_vars // {}')
        if [[ -n "$env_json" && "$env_json" != "{}" ]]; then
            while IFS="=" read -r key value; do
                export "$key=$value"
            done < <(echo "$env_json" | jq -r 'to_entries | .[] | "\(.key)=\(.value)"')
        fi
    fi

    if [[ -z "$FUNCTION_CODE" ]]; then
        send_response 200 '{"success":false,"error":"No function code loaded","logs":"","execution_time_ms":0,"memory_used_mb":0}'
        return
    fi

    # Parse event and timeout
    local event=$(echo "$request_body" | jq -c '.event // {}')
    local timeout_seconds=$(echo "$request_body" | jq -r '.timeout_seconds // 30')

    # Create temporary files for execution
    local func_file="$TEMP_DIR/function_$$.sh"
    local output_file="$TEMP_DIR/output_$$"
    local logs_file="$TEMP_DIR/logs_$$"

    # Write function code to temp file
    cat > "$func_file" <<'EOF'
#!/usr/bin/env bash
EOF
    echo "$FUNCTION_CODE" >> "$func_file"
    echo "" >> "$func_file"

    # Add handler invocation
    cat >> "$func_file" <<INVOKE
# Call the handler and capture output
${HANDLER_NAME} '$event' '{"timeout_seconds":${timeout_seconds},"memory_limit_mb":128}'
INVOKE

    chmod +x "$func_file"

    # Execute with timeout
    local exit_code=0
    if timeout "${timeout_seconds}s" bash "$func_file" > "$output_file" 2> "$logs_file"; then
        exit_code=0
    else
        exit_code=$?
    fi

    local end_time=$(date +%s%3N)
    local elapsed_ms=$((end_time - start_time))

    # Read logs
    local logs=""
    if [[ -f "$logs_file" ]]; then
        local stderr_content=$(cat "$logs_file")
        if [[ -n "$stderr_content" ]]; then
            logs="[STDERR]\n$stderr_content\n"
        fi
    fi

    # Handle timeout
    if [[ $exit_code -eq 124 ]]; then
        local error_msg="Function execution exceeded ${timeout_seconds} seconds"
        send_response 200 "$(jq -nc --arg err "$error_msg" --arg log "$logs" --argjson time "$elapsed_ms" '{success:false,error:$err,logs:$log,execution_time_ms:$time,memory_used_mb:0}')"
        rm -f "$func_file" "$output_file" "$logs_file"
        return
    fi

    # Handle execution error
    if [[ $exit_code -ne 0 ]]; then
        local error_output=$(cat "$output_file" 2>/dev/null || echo "")
        local combined_logs="[STDERR]\n$error_output\n$logs"
        send_response 200 "$(jq -nc --arg log "$combined_logs" --argjson time "$elapsed_ms" '{success:false,error:"Runtime error",logs:$log,execution_time_ms:$time,memory_used_mb:0}')"
        rm -f "$func_file" "$output_file" "$logs_file"
        return
    fi

    # Read result
    local result=$(cat "$output_file" 2>/dev/null || echo '{}')

    # Ensure result is valid JSON, if not wrap it
    if ! echo "$result" | jq empty 2>/dev/null; then
        result=$(echo "$result" | jq -Rs .)
    else
        result=$(echo "$result" | jq -c .)
    fi

    # Clean up temp files
    rm -f "$func_file" "$output_file" "$logs_file"

    # Send response
    send_response 200 "$(jq -nc --argjson res "$result" --arg log "$logs" --argjson time "$elapsed_ms" '{success:true,result:$res,logs:$log,execution_time_ms:$time,memory_used_mb:0}')"
}

# Handle incoming HTTP request
handle_request() {
    local request_line method path

    # Read the HTTP request line
    read -r request_line
    method=$(echo "$request_line" | cut -d' ' -f1)
    path=$(echo "$request_line" | cut -d' ' -f2)

    # Skip headers and collect body
    local content_length=0
    while IFS=: read -r header value; do
        header=$(echo "$header" | tr -d '\r' | tr '[:upper:]' '[:lower:]')
        value=$(echo "$value" | tr -d '\r' | sed 's/^ *//')

        if [[ "$header" == "content-length" ]]; then
            content_length=$value
        fi

        # Empty line marks end of headers
        if [[ -z "$header" ]]; then
            break
        fi
    done

    # Read body for POST requests
    local body=""
    if [[ "$method" == "POST" ]] && [[ $content_length -gt 0 ]]; then
        body=$(head -c "$content_length")
    fi

    # Route the request
    case "$path" in
        "/health")
            send_response 200 '{"status":"healthy","ready":true}'
            ;;
        "/load")
            handle_load "$body"
            ;;
        "/invoke")
            handle_invoke "$body"
            ;;
        *)
            send_response 404 '{"error":"Not found"}'
            ;;
    esac
}

# Main entry point
main() {
    echo "[AGENT] Starting Bash function execution agent on port ${PORT}"
    echo "[AGENT] Bash version: ${BASH_VERSION}"
    echo "[AGENT] Ready to receive function invocations"

    # Use socat for HTTP server
    # Each connection forks a new bash that runs this script in handle mode
    socat TCP-LISTEN:${PORT},fork,reuseaddr EXEC:"/usr/local/bin/bash /app/agent.sh handle"
}

# Check if we're in handle mode or server mode
if [[ "${1:-}" == "handle" ]]; then
    # Handle a single request
    handle_request
else
    # Run in server mode
    main
fi
