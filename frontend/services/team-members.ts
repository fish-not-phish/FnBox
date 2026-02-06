import { baseUrl } from "@/constants/constants";

export interface TeamMember {
  id: number;
  username: string;
  email: string;
  roles: string[];
  joined_at: string;
}

export interface TeamDetail {
  id: number;
  name: string;
  slug: string;
  team_type: string;
  owner_id: number;
  owner_username: string;
  member_count: number;
  created_at: string;
  updated_at: string;
  members: TeamMember[];
}

export interface AddMemberData {
  email: string;
  roles?: string[];
}

export interface UpdateMemberRoleData {
  roles: string[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Fetch team details including all members
 */
export async function fetchTeamMembers(
  teamSlug: string,
  csrfToken: string
): Promise<TeamDetail> {
  const res = await fetch(`${baseUrl}accounts/teams/${teamSlug}`, {
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) throw new Error("Failed to fetch team members");
  return res.json();
}

/**
 * Add a member to the team
 */
export async function addTeamMember(
  teamSlug: string,
  data: AddMemberData,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${baseUrl}accounts/teams/${teamSlug}/members`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to add member" }));
    throw new Error(error.message || "Failed to add member");
  }

  return res.json();
}

/**
 * Update a team member's role
 */
export async function updateTeamMemberRole(
  teamSlug: string,
  userId: number,
  data: UpdateMemberRoleData,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${baseUrl}accounts/teams/${teamSlug}/members/${userId}`,
    {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-CSRFToken": csrfToken,
      },
      body: JSON.stringify(data),
    }
  );

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to update member role" }));
    throw new Error(error.message || "Failed to update member role");
  }

  return res.json();
}

/**
 * Remove a member from the team
 */
export async function removeTeamMember(
  teamSlug: string,
  userId: number,
  csrfToken: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(
    `${baseUrl}accounts/teams/${teamSlug}/members/${userId}`,
    {
      method: "DELETE",
      credentials: "include",
      headers: {
        "X-CSRFToken": csrfToken,
      },
    }
  );

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Failed to remove member" }));
    throw new Error(error.message || "Failed to remove member");
  }

  return res.json();
}

/**
 * Search users by username or email (for adding to team)
 * Note: This would need a backend endpoint to be implemented
 * For now, this is a placeholder that returns empty array
 */
export async function searchUsers(
  query: string,
  csrfToken: string
): Promise<User[]> {
  // TODO: Implement backend endpoint for user search
  // For now, return empty array
  return [];
}
