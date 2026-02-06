import { baseUrl } from "@/constants/constants";

export interface SiteSettings {
  allow_registration: boolean;
}

export async function fetchSiteSettings(): Promise<SiteSettings> {
  const res = await fetch(`${baseUrl}accounts/site-settings`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch site settings");
  return res.json();
}

export async function updateSiteSettings(
  data: SiteSettings,
  csrfToken: string
): Promise<SiteSettings> {
  const res = await fetch(`${baseUrl}accounts/site-settings`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to update site settings" }));
    throw new Error(error.message || "Failed to update site settings");
  }

  return res.json();
}
