import { baseUrl } from "@/constants/constants";

export async function fetchMe() {
  const res = await fetch(`${baseUrl}accounts/me`, {
    credentials: "include",
  });

  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export interface ProfileUpdateData {
  first_name?: string;
  last_name?: string;
}

export async function updateProfile(data: ProfileUpdateData, csrfToken: string) {
  const res = await fetch(`${baseUrl}accounts/profile`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to update profile");
  }

  return res.json();
}

export interface PasswordChangeData {
  current_password: string;
  new_password: string;
}

export async function changePassword(data: PasswordChangeData, csrfToken: string) {
  const res = await fetch(`${baseUrl}accounts/change-password`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || "Failed to change password");
  }

  const result = await res.json();

  // The backend returns {success: bool, message: string}
  if (!result.success) {
    throw new Error(result.message || "Failed to change password");
  }

  return result;
}

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

export async function searchUsers(query: string): Promise<UserSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  const res = await fetch(`${baseUrl}accounts/users/search?q=${encodeURIComponent(query)}`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to search users");
  }

  return res.json();
}