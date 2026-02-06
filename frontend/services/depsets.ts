import { baseUrl } from "@/constants/constants";

export interface DepsetPackage {
  id: number;
  package_name: string;
  version_spec: string;
  order: number;
  notes: string;
}

export interface DepsetPackageInput {
  package_name: string;
  version_spec?: string;
  order?: number;
  notes?: string;
}

export interface DepsetListItem {
  id: number;
  name: string;
  slug: string;
  description: string;
  runtime_type: "python" | "nodejs" | "ruby";
  runtime_version: string;
  python_version: string; // backward compatibility
  is_public: boolean;
  package_count: number;
  created_at: string;
}

export interface DepsetDetail extends DepsetListItem {
  team_id: number;
  team_name: string;
  updated_at: string;
  created_by_username: string | null;
  packages: DepsetPackage[];
  requirements_txt: string;
}

export interface CreateDepsetData {
  name: string;
  slug?: string;
  description?: string;
  runtime_type?: string;
  runtime_version?: string;
  is_public?: boolean;
  packages?: DepsetPackageInput[];
}

export interface UpdateDepsetData {
  name?: string;
  description?: string;
  runtime_type?: string;
  runtime_version?: string;
  is_public?: boolean;
  packages?: DepsetPackageInput[];
}

export async function fetchDepsets(
  teamId: number,
  runtimeType?: string,
  runtimeVersion?: string
): Promise<DepsetListItem[]> {
  const params = new URLSearchParams();
  if (runtimeType) params.append("runtime_type", runtimeType);
  if (runtimeVersion) params.append("runtime_version", runtimeVersion);

  const url = `${baseUrl}depsets/teams/${teamId}/depsets${params.toString() ? `?${params.toString()}` : ""}`;

  const res = await fetch(url, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch depsets");
  return res.json();
}

export async function fetchDepsetDetail(teamId: number, slug: string): Promise<DepsetDetail> {
  const res = await fetch(`${baseUrl}depsets/teams/${teamId}/depsets/${slug}`, {
    credentials: "include",
  });
  if (!res.ok) throw new Error("Failed to fetch depset detail");
  return res.json();
}

export async function createDepset(
  teamId: number,
  data: CreateDepsetData,
  csrfToken: string
): Promise<DepsetDetail> {
  const res = await fetch(`${baseUrl}depsets/teams/${teamId}/depsets`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to create depset" }));
    throw new Error(error.message || "Failed to create depset");
  }

  return res.json();
}

export async function updateDepset(
  teamId: number,
  slug: string,
  data: UpdateDepsetData,
  csrfToken: string
): Promise<DepsetDetail> {
  const res = await fetch(`${baseUrl}depsets/teams/${teamId}/depsets/${slug}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-CSRFToken": csrfToken,
    },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to update depset" }));
    throw new Error(error.message || "Failed to update depset");
  }

  return res.json();
}

export async function deleteDepset(
  teamId: number,
  slug: string,
  csrfToken: string
): Promise<void> {
  const res = await fetch(`${baseUrl}depsets/teams/${teamId}/depsets/${slug}`, {
    method: "DELETE",
    credentials: "include",
    headers: {
      "X-CSRFToken": csrfToken,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Failed to delete depset" }));
    throw new Error(error.message || "Failed to delete depset");
  }
}
