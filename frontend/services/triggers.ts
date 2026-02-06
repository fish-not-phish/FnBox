const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://127.0.0.1:8000/api/";

export interface TriggerListItem {
  id: number;
  uuid: string;
  function_id: number;
  function_name: string;
  function_uuid: string;
  name: string;
  trigger_type: "scheduled" | "http";
  schedule: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_triggered_at: string | null;
  created_by_username: string | null;
}

export interface CreateTriggerData {
  name: string;
  trigger_type: "scheduled" | "http";
  schedule?: string;
  enabled?: boolean;
}

export interface UpdateTriggerData {
  name?: string;
  schedule?: string;
  enabled?: boolean;
}

export async function fetchTriggers(
  functionId?: string,
  teamId?: number
): Promise<TriggerListItem[]> {
  let url = `${baseUrl}functions/triggers`;
  const params = new URLSearchParams();

  if (functionId) params.append("function_id", functionId);
  if (teamId) params.append("team_id", teamId.toString());

  if (params.toString()) url += `?${params.toString()}`;

  const res = await fetch(url, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch triggers");
  return res.json();
}

export async function createTrigger(
  functionId: string,
  data: CreateTriggerData,
  csrfToken: string
): Promise<TriggerListItem> {
  const res = await fetch(
    `${baseUrl}functions/triggers?function_id=${functionId}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create trigger" }));
    throw new Error(error.message || "Failed to create trigger");
  }

  return res.json();
}

export async function updateTrigger(
  triggerId: string,
  data: UpdateTriggerData,
  csrfToken: string
): Promise<TriggerListItem> {
  const res = await fetch(`${baseUrl}functions/triggers/${triggerId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to update trigger" }));
    throw new Error(error.message || "Failed to update trigger");
  }

  return res.json();
}

export async function deleteTrigger(
  triggerId: string,
  csrfToken: string
): Promise<void> {
  const res = await fetch(`${baseUrl}functions/triggers/${triggerId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to delete trigger" }));
    throw new Error(error.message || "Failed to delete trigger");
  }
}
