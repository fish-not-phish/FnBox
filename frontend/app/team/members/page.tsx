"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchTeamMembers, type TeamDetail } from "@/services/team-members";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { MembersList } from "@/components/team/MembersList";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function TeamMembersPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  // Auth check only
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Team", href: "/team" },
          { label: "Members", href: "/team/members" },
        ]}
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-10 w-32" />
            </div>
            <Skeleton className="h-4 w-24" />
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Team", href: "/team" },
        { label: "Members", href: "/team/members" },
      ]}
    >
      <TeamMembersContent />
    </AppLayout>
  );
}

function TeamMembersContent() {
  const { user } = useAuthContext();
  const { selectedTeam, teams, isLoading: teamsLoading } = useTeamContext();
  const router = useRouter();
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Redirect to onboarding only if teams are loaded and user has no teams
  useEffect(() => {
    if (!teamsLoading && teams.length === 0) {
      router.push("/onboarding");
    }
  }, [teamsLoading, teams, router]);

  // Fetch team members
  const loadTeamMembers = async () => {
    if (!selectedTeam || !user.csrfToken) return;

    setIsLoading(true);
    try {
      const data = await fetchTeamMembers(selectedTeam.slug, user.csrfToken);
      setTeamDetail(data);
    } catch (error) {
      console.error("Failed to fetch team members:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTeam && user.csrfToken) {
      loadTeamMembers();
    }
  }, [selectedTeam, user.csrfToken]);

  // Filter members based on search
  const filteredMembers = useMemo(() => {
    if (!teamDetail?.members) return [];

    return teamDetail.members.filter((member) => {
      const searchLower = searchValue.toLowerCase();
      return (
        member.username.toLowerCase().includes(searchLower) ||
        member.email.toLowerCase().includes(searchLower)
      );
    });
  }, [teamDetail?.members, searchValue]);

  // Get current user's roles
  const currentUserRoles = useMemo(() => {
    if (!teamDetail?.members || !user.id) return [];
    const membership = teamDetail.members.find((m) => m.id === user.id);
    return membership?.roles || [];
  }, [teamDetail?.members, user.id]);

  // Show loading state while teams are loading or no team is selected yet
  if (teamsLoading || !selectedTeam) {
    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-10 w-56" />
            <Skeleton className="h-10 w-32" />
          </div>
          <Skeleton className="h-4 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold tracking-tight">
            Team Members
          </h3>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Manage your team members and their roles. Control permissions and
            access levels for each member.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-56 min-w-20">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members"
                className="pl-7"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            {(currentUserRoles.includes("owner") || currentUserRoles.includes("admin")) && (
              <InviteMemberDialog onMemberAdded={loadTeamMembers} />
            )}
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">
                {filteredMembers.length}{" "}
                {filteredMembers.length === 1 ? "member" : "members"}
              </p>

              <MembersList
                members={filteredMembers}
                currentUserRoles={currentUserRoles}
                ownerId={teamDetail?.owner_id || 0}
                onMemberUpdated={loadTeamMembers}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
