import { baseUrl } from "@/constants/constants";

export interface LogItem {
  id: number;
  request_id: string;
  status: string;
  function_id: number;
  function_uuid: string;
  function_name: string;
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

export async function fetchTeamLogs(teamId: number, limit: number = 100): Promise<LogItem[]> {
  const res = await fetch(`${baseUrl}functions/invocations/team/${teamId}?limit=${limit}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch logs");
  return res.json();
}
