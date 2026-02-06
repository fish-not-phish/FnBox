import { baseUrl } from "@/constants/constants";

export interface OIDCProvider {
  id: number;
  provider_type: string;
  provider_name: string;
  client_id: string;
  server_url: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface OIDCProviderCreateData {
  provider_type: string;
  provider_name: string;
  client_id: string;
  client_secret: string;
  server_url: string;
  enabled?: boolean;
}

export interface OIDCProviderUpdateData {
  provider_name?: string;
  client_id?: string;
  client_secret?: string;
  server_url?: string;
  enabled?: boolean;
}

export async function fetchOIDCProviders(): Promise<OIDCProvider[]> {
  const res = await fetch(`${baseUrl}accounts/oidc-providers`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch OIDC providers");
  return res.json();
}

export async function createOIDCProvider(
  data: OIDCProviderCreateData
): Promise<OIDCProvider> {
  const res = await fetch(`${baseUrl}accounts/oidc-providers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to create OIDC provider");
  }
  return res.json();
}

export async function updateOIDCProvider(
  providerId: number,
  data: OIDCProviderUpdateData
): Promise<OIDCProvider> {
  const res = await fetch(`${baseUrl}accounts/oidc-providers/${providerId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update OIDC provider");
  }
  return res.json();
}

export async function deleteOIDCProvider(providerId: number): Promise<void> {
  const res = await fetch(`${baseUrl}accounts/oidc-providers/${providerId}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to delete OIDC provider");
  }
}
