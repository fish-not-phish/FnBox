import { baseUrl } from "@/constants/constants";

export interface Team {
  id: number;
  name: string;
  slug: string;
  team_type: string;
  member_count: number;
  is_owner: boolean;
  my_roles: string[];
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(`${baseUrl}accounts/teams`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch teams");
  return res.json();
}

export async function createTeam(
  data: { name: string },
  csrfToken: string
): Promise<Team> {
  const res = await fetch(`${baseUrl}accounts/teams`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create team" }));
    throw new Error(error.message || "Failed to create team");
  }

  return res.json();
}

export interface DashboardStats {
  total_functions: number;
  total_invocations: number;
  total_deployments: number;
  recent_invocations: number;
}

export interface InvocationTrendDataPoint {
  hour: string;
  invocations: number;
  errors: number;
}

export interface FunctionUsageDataPoint {
  name: string;
  invocations: number;
  runtime: string;
}

export interface RuntimeDistributionDataPoint {
  name: string;
  value: number;
  color: string;
}

export interface RecentActivityItem {
  function_name: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
}

export interface EnhancedDashboardStats {
  stats: DashboardStats;
  invocation_trend: InvocationTrendDataPoint[];
  top_functions: FunctionUsageDataPoint[];
  runtime_distribution: RuntimeDistributionDataPoint[];
  recent_activity: RecentActivityItem[];
}

export async function fetchTeamStats(teamSlug: string): Promise<DashboardStats> {
  const res = await fetch(`${baseUrl}accounts/teams/${teamSlug}/stats`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch team stats");
  return res.json();
}

export async function fetchEnhancedTeamStats(teamSlug: string): Promise<EnhancedDashboardStats> {
  const res = await fetch(`${baseUrl}accounts/teams/${teamSlug}/enhanced-stats`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch enhanced team stats");
  return res.json();
}
