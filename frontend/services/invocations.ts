import { baseUrl } from "@/constants/constants";

export interface Invocation {
  id: number;
  request_id: string;
  status: "pending" | "running" | "success" | "error" | "timeout";
  input_data: Record<string, any> | null;
  output_data: Record<string, any> | null;
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
  const res = await fetch(
    `${baseUrl}functions/${functionId}/invocations?limit=${limit}`,
    {
      credentials: "include",
    }
  );

  if (!res.ok) throw new Error("Failed to fetch invocations");
  return res.json();
}
