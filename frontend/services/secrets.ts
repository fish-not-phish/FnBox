import { baseUrl } from "@/constants/constants";

export interface Secret {
  id: number;
  key: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by_username: string | null;
}

export interface SecretWithValue extends Secret {
  value: string;
}

export interface CreateSecretData {
  key: string;
  value: string;
  description?: string;
}

export async function fetchSecrets(teamId: number, csrfToken: string): Promise<Secret[]> {
  const res = await fetch(`${baseUrl}vault/teams/${teamId}/secrets`, {
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch secrets");
  const data = await res.json();
  return data.items || data;
}

export async function getSecret(
  teamId: number,
  secretId: number,
  csrfToken: string
): Promise<SecretWithValue> {
  const res = await fetch(`${baseUrl}vault/teams/${teamId}/secrets/${secretId}`, {
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });
  if (!res.ok) throw new Error("Failed to fetch secret");
  return res.json();
}

export async function createSecret(
  teamId: number,
  data: CreateSecretData,
  csrfToken: string
): Promise<Secret> {
  const res = await fetch(`${baseUrl}vault/teams/${teamId}/secrets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create secret" }));
    throw new Error(error.message || "Failed to create secret");
  }

  return res.json();
}

export async function updateSecret(
  teamId: number,
  secretId: number,
  data: CreateSecretData,
  csrfToken: string
): Promise<Secret> {
  const res = await fetch(`${baseUrl}vault/teams/${teamId}/secrets/${secretId}`, {
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
  teamId: number,
  secretId: number,
  csrfToken: string
): Promise<void> {
  const res = await fetch(`${baseUrl}vault/teams/${teamId}/secrets/${secretId}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    throw new Error("Failed to delete secret");
  }
}
