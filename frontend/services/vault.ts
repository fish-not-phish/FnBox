import { baseUrl } from "@/constants/constants";

export interface SecretListItem {
  id: number;
  uuid: string;
  key: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by_username: string | null;
}

export interface CreateSecretData {
  key: string;
  value: string;
  description?: string;
  team_id: number;
}

export interface UpdateSecretData {
  key?: string;
  value?: string;
  description?: string;
}

export async function fetchSecrets(teamId?: number): Promise<SecretListItem[]> {
  const url = teamId
    ? `${baseUrl}vault/?team_id=${teamId}`
    : `${baseUrl}vault/`;
  const res = await fetch(url, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch secrets");
  return res.json();
}

export async function createSecret(
  data: CreateSecretData,
  csrfToken: string
): Promise<SecretListItem> {
  const res = await fetch(`${baseUrl}vault/?team_id=${data.team_id}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify({
      key: data.key,
      value: data.value,
      description: data.description || "",
    }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create secret" }));
    throw new Error(error.message || "Failed to create secret");
  }

  return res.json();
}

export async function updateSecret(
  secretId: string,
  data: UpdateSecretData,
  csrfToken: string
): Promise<SecretListItem> {
  const res = await fetch(`${baseUrl}vault/${secretId}`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to update secret" }));
    throw new Error(error.message || "Failed to update secret");
  }

  return res.json();
}

export async function deleteSecret(
  secretId: string,
  csrfToken: string
): Promise<void> {
  const res = await fetch(`${baseUrl}vault/${secretId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to delete secret" }));
    throw new Error(error.message || "Failed to delete secret");
  }
}
