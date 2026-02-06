#!/usr/bin/env ruby
# frozen_string_literal: true

require 'webrick'
require 'json'
require 'stringio'
require 'timeout'

PORT = 8080

# Agent for executing Ruby functions
class FunctionAgent
  def initialize
    @function_code = nil
    @handler_name = 'handler'
    @env_vars = {}
  end

  def load_function(data)
    @function_code = data['code']
    @handler_name = data['handler'] || 'handler'
    @env_vars = data['env_vars'] || {}

    # Set environment variables
    @env_vars.each { |key, value| ENV[key] = value }

    # Validate the code by parsing it
    begin
      RubyVM::InstructionSequence.compile(@function_code)
      { success: true, message: 'Function loaded' }
    rescue SyntaxError => e
      { success: false, error: "Syntax error: #{e.message}" }
    end
  end

  def invoke_function(data)
    start_time = Time.now

    # Support one-shot execution
    if data['code']
      load_result = load_function(data)
      return format_error(load_result[:error], '', 0, 0) unless load_result[:success]
    end

    unless @function_code
      return format_error('No function code loaded', '', 0, 0)
    end

    event = data['event'] || {}
    timeout_seconds = data['timeout_seconds'] || 30

    # Execute with timeout
    begin
      result, logs = execute_with_timeout(event, timeout_seconds)
      elapsed_ms = ((Time.now - start_time) * 1000).to_i

      {
        success: true,
        result: result,
        logs: logs,
        execution_time_ms: elapsed_ms,
        memory_used_mb: 0
      }
    rescue Timeout::Error
      elapsed_ms = ((Time.now - start_time) * 1000).to_i
      format_error(
        "Function execution exceeded #{timeout_seconds} seconds",
        "[STDERR]\nFunction execution exceeded #{timeout_seconds} seconds\n",
        elapsed_ms,
        0
      )
    rescue StandardError => e
      elapsed_ms = ((Time.now - start_time) * 1000).to_i
      format_error(
        "Runtime error: #{e.message}",
        "[STDERR]\n#{e.message}\n#{e.backtrace.join("\n")}\n",
        elapsed_ms,
        0
      )
    end
  end

  private

  def execute_with_timeout(event, timeout_seconds)
    logs = StringIO.new

    # Redirect stdout/stderr to capture logs
    old_stdout = $stdout
    old_stderr = $stderr
    $stdout = logs
    $stderr = logs

    result = nil

    begin
      Timeout.timeout(timeout_seconds) do
        # Create a clean binding for execution
        binding_context = binding

        # Evaluate the function code
        eval(@function_code, binding_context, '<user_function>')

        # Get the handler method
        handler_method = binding_context.eval("method(:#{@handler_name})")

        # Create context
        context = {
          'timeout_seconds' => timeout_seconds,
          'memory_limit_mb' => get_memory_limit
        }

        # Call the handler
        result = handler_method.call(event, context)
      end
    ensure
      # Restore stdout/stderr
      $stdout = old_stdout
      $stderr = old_stderr
    end

    [result, logs.string]
  end

  def format_error(error_msg, logs, elapsed_ms, memory_mb)
    {
      success: false,
      error: error_msg,
      logs: logs,
      execution_time_ms: elapsed_ms,
      memory_used_mb: memory_mb
    }
  end

  def get_memory_limit
    # Try to read from cgroup
    if File.exist?('/sys/fs/cgroup/memory.max')
      limit = File.read('/sys/fs/cgroup/memory.max').strip.to_i
      return limit / (1024 * 1024) if limit.positive? && limit < 9223372036854771712
    end

    # Fallback
    128
  rescue StandardError
    128
  end
end

# HTTP Server
class AgentServer
  def initialize
    @agent = FunctionAgent.new
    @server = WEBrick::HTTPServer.new(
      Port: PORT,
      Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
      AccessLog: []
    )

    setup_routes
  end

  def setup_routes
    # Health check endpoint
    @server.mount_proc '/health' do |_req, res|
      res.status = 200
      res['Content-Type'] = 'application/json'
      res.body = JSON.generate({ status: 'healthy', ready: true })
    end

    # Load function endpoint
    @server.mount_proc '/load' do |req, res|
      begin
        data = JSON.parse(req.body)
        result = @agent.load_function(data)

        res.status = result[:success] ? 200 : 500
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate(result)
      rescue JSON::ParserError => e
        res.status = 400
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate({ error: "Invalid JSON: #{e.message}" })
      rescue StandardError => e
        res.status = 500
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate({ error: e.message })
      end
    end

    # Invoke function endpoint
    @server.mount_proc '/invoke' do |req, res|
      begin
        data = JSON.parse(req.body)
        result = @agent.invoke_function(data)

        res.status = 200
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate(result)
      rescue JSON::ParserError => e
        res.status = 400
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate({
          success: false,
          error: "Invalid JSON: #{e.message}",
          logs: '',
          execution_time_ms: 0,
          memory_used_mb: 0
        })
      rescue StandardError => e
        res.status = 500
        res['Content-Type'] = 'application/json'
        res.body = JSON.generate({
          success: false,
          error: e.message,
          logs: "[STDERR]\n#{e.backtrace.join("\n")}\n",
          execution_time_ms: 0,
          memory_used_mb: 0
        })
      end
    end
  end

  def start
    puts "[AGENT] Starting Ruby function execution agent on port #{PORT}"
    puts "[AGENT] Ruby version: #{RUBY_VERSION}"
    puts "[AGENT] Ready to receive function invocations"

    trap('INT') { @server.shutdown }
    trap('TERM') { @server.shutdown }

    @server.start
  end
end

# Start the server
AgentServer.new.start
