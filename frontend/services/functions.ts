import { baseUrl } from "@/constants/constants";

export interface FunctionListItem {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  description: string;
  runtime: string; // e.g., "python3.14", "nodejs20", "go1.22"
  status: string;
  invocation_count: number;
  last_invoked_at: string | null;
  created_at: string;
}

export type RuntimeType = "python" | "nodejs" | "dotnet" | "rust" | "ruby" | "golang" | "java" | "bash" | "go";

export const RUNTIME_LABELS: Record<string, string> = {
  // Python
  "python3.14": "Python 3.14",
  "python3.13": "Python 3.13",
  "python3.12": "Python 3.12",
  "python3.11": "Python 3.11",
  "python3.10": "Python 3.10",
  "python3.9": "Python 3.9",
  // Node.js
  nodejs25: "Node.js 25",
  nodejs24: "Node.js 24",
  nodejs20: "Node.js 20",
  // Ruby
  "ruby3.4": "Ruby 3.4",
  // Java
  java27: "Java 27",
  // .NET
  dotnet10: ".NET 10",
  dotnet9: ".NET 9",
  dotnet8: ".NET 8",
  "dotnet9.0": ".NET 9.0",  // legacy
  "dotnet8.0": ".NET 8.0",  // legacy
  // Bash
  bash5: "Bash 5",
  // Go
  "go1.25": "Go 1.25",
  golang: "Go (latest)",  // legacy
  // Rust
  "rust1.93": "Rust 1.93",
  rust: "Rust (latest)",  // legacy
};

export interface FunctionDetail {
  id: number;
  uuid: string;
  name: string;
  slug: string;
  description: string;
  team_id: number;
  team_name: string;
  code: string;
  handler: string;
  runtime: string;
  memory_mb: number;
  vcpu_count: number;
  timeout_seconds: number;
  status: string;
  is_public: boolean;
  invocation_count: number;
  last_invoked_at: string | null;
  last_deployed_at: string | null;
  created_at: string;
  updated_at: string;
  created_by_username: string | null;
  depset_count: number;
  secret_count: number;
  depset_ids: number[];
  secret_ids: number[];
  trigger_count: number;
  // Kubernetes fields
  deployment_name: string | null;
  service_name: string | null;
  k8s_namespace: string | null;
  // Legacy VM fields (deprecated)
  vm_id: string | null;
  vm_ip: string | null;
  vm_status: string | null;
}

export async function fetchFunctions(teamId?: number): Promise<FunctionListItem[]> {
  const url = teamId
    ? `${baseUrl}functions/?team_id=${teamId}`
    : `${baseUrl}functions/`;
  const res = await fetch(url, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch functions");
  return res.json();
}

export async function fetchFunctionDetail(functionId: string): Promise<FunctionDetail> {
  const res = await fetch(`${baseUrl}functions/${functionId}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch function details");
  return res.json();
}

export interface CreateFunctionData {
  name: string;
  slug?: string;
  description?: string;
  code: string;
  handler?: string;
  runtime?: string;
  memory_mb?: number;
  vcpu_count?: number;
  timeout_seconds?: number;
  status?: string;
  is_public?: boolean;
  team_id: number;
  depset_ids?: number[];
  secret_ids?: number[];
}

export async function createFunction(
  data: CreateFunctionData,
  csrfToken: string
): Promise<FunctionDetail> {
  const res = await fetch(`${baseUrl}functions/`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create function" }));
    throw new Error(error.message || "Failed to create function");
  }

  return res.json();
}

export interface UpdateFunctionData {
  name?: string;
  description?: string;
  code?: string;
  handler?: string;
  runtime?: string;
  memory_mb?: number;
  vcpu_count?: number;
  timeout_seconds?: number;
  status?: string;
  is_public?: boolean;
  depset_ids?: number[];
  secret_ids?: number[];
}

export async function updateFunction(
  functionId: string,
  data: UpdateFunctionData,
  csrfToken: string
): Promise<FunctionDetail> {
  const res = await fetch(`${baseUrl}functions/${functionId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to update function" }));
    throw new Error(error.message || "Failed to update function");
  }

  return res.json();
}

export interface TestInvocationResult {
  success: boolean;
  result?: any;
  error?: string;
  execution_time_ms?: number;
}

export async function testFunction(
  functionId: string,
  event: Record<string, any>,
  csrfToken: string
): Promise<TestInvocationResult> {
  const res = await fetch(`${baseUrl}functions/${functionId}/test`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({ event }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to test function" }));
    throw new Error(error.message || "Failed to test function");
  }

  return res.json();
}

export interface DeployResult {
  success: boolean;
  message: string;
  vm_id?: string;
  vm_ip?: string;
  vm_status?: string;
  deployed_at?: string;
}

export async function deployFunction(
  functionId: string,
  csrfToken: string
): Promise<DeployResult> {
  const res = await fetch(`${baseUrl}functions/${functionId}/deploy`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to deploy function" }));
    throw new Error(error.message || "Failed to deploy function");
  }

  return res.json();
}

export interface UndeployResult {
  success: boolean;
  message: string;
}

export async function undeployFunction(
  functionId: string,
  csrfToken: string
): Promise<UndeployResult> {
  const res = await fetch(`${baseUrl}functions/${functionId}/undeploy`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to undeploy function" }));
    throw new Error(error.message || "Failed to undeploy function");
  }

  return res.json();
}

export interface DeploymentStatus {
  status: string; // 'draft', 'deploying', 'active', 'undeploying', 'error'
  deployment_name: string | null;
  service_name: string | null;
  k8s_namespace: string | null;
  vm_id: string | null;
  vm_ip: string | null;
  vm_status: string | null;
  last_deployed_at: string | null;
}

export async function fetchDeploymentStatus(
  functionId: string
): Promise<DeploymentStatus> {
  const res = await fetch(`${baseUrl}functions/${functionId}/deployment-status`, {
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to fetch deployment status" }));
    throw new Error(error.message || "Failed to fetch deployment status");
  }

  return res.json();
}

export interface Invocation {
  id: number;
  request_id: string;
  status: string; // 'pending', 'running', 'success', 'error'
  input_data: Record<string, any> | null;
  output_data: any;
  error_message: string;
  duration_ms: number | null;
  memory_used_mb: number | null;
  logs: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export async function fetchInvocations(
  functionId: string,
  limit: number = 50
): Promise<Invocation[]> {
  const res = await fetch(`${baseUrl}functions/${functionId}/invocations?limit=${limit}`, {
    credentials: "include",
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to fetch invocations" }));
    throw new Error(error.message || "Failed to fetch invocations");
  }

  return res.json();
}

export interface ClusterLimits {
  memory_mb: { min: number; max: number };
  vcpu_count: { min: number; max: number };
  timeout_seconds: { min: number; max: number };
}

export async function fetchClusterLimits(): Promise<ClusterLimits> {
  const res = await fetch(`${baseUrl}functions/cluster-limits`, {
    credentials: "include",
  });

  if (!res.ok) {
    // Fallback to hardcoded limits if API fails
    return {
      memory_mb: { min: 64, max: 4096 },
      vcpu_count: { min: 0.05, max: 2 },
      timeout_seconds: { min: 1, max: 3600 },
    };
  }

  return res.json();
}

export interface DeleteResult {
  success: boolean;
  message: string;
}

export async function deleteFunction(
  functionId: string,
  csrfToken: string
): Promise<DeleteResult> {
  const res = await fetch(`${baseUrl}functions/${functionId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to delete function" }));
    throw new Error(error.message || "Failed to delete function");
  }

  return res.json();
}
