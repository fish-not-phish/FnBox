"use client";

import { MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import {
  updateTeamMemberRole,
  removeTeamMember,
  type TeamMember,
} from "@/services/team-members";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RoleMultiSelect } from "./RoleMultiSelect";
import { toast } from "sonner";

interface MemberCardProps {
  member: TeamMember;
  currentUserRoles: string[];
  ownerId: number;
  onMemberUpdated?: () => void;
}

export const MemberCard = ({
  member,
  currentUserRoles,
  ownerId,
  onMemberUpdated,
}: MemberCardProps) => {
  const [isUpdating, setIsUpdating] = useState(false);
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();

  // Check if current user can manage members (has owner or admin role)
  const canManage =
    currentUserRoles.includes("owner") ||
    (currentUserRoles.includes("admin") && !member.roles.includes("owner"));

  const isCurrentUser = user.id === member.id;
  const isOwner = member.id === ownerId;

  const handleRolesChange = async (newRoles: string[]) => {
    if (!selectedTeam || !user.csrfToken || !canManage) return;

    setIsUpdating(true);

    try {
      const result = await updateTeamMemberRole(
        selectedTeam.slug,
        member.id,
        { roles: newRoles },
        user.csrfToken
      );

      toast.success(result.message || "Member roles updated successfully");

      if (onMemberUpdated) {
        onMemberUpdated();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update member roles"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!selectedTeam || !user.csrfToken) return;

    setIsUpdating(true);

    try {
      const result = await removeTeamMember(
        selectedTeam.slug,
        member.id,
        user.csrfToken
      );

      toast.success(result.message || "Member removed successfully");

      if (onMemberUpdated) {
        onMemberUpdated();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove member"
      );
    } finally {
      setIsUpdating(false);
    }
  };

  // Generate avatar initials
  const avatarInitials = member.username
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex w-full items-center justify-between">
      <div className="flex items-center gap-2 sm:flex-2/3">
        <div className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-muted">
          <span className="text-sm font-medium">{avatarInitials}</span>
        </div>
        <div className="text-sm font-medium">
          <p>
            {member.username}
            {isCurrentUser && (
              <span className="ml-2 text-xs text-muted-foreground">(You)</span>
            )}
          </p>
          <p className="text-xs text-muted-foreground">{member.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 sm:flex-1/3">
        <RoleMultiSelect
          selectedRoles={member.roles}
          onRolesChange={handleRolesChange}
          disabled={!canManage || isUpdating || isOwner}
          deferUpdate={true}
          adminExclusive={true}
        />

        {canManage && !isOwner && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                aria-label="Open menu"
                size="icon-sm"
                className="cursor-pointer"
                disabled={isUpdating}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-fit max-w-56" align="end">
              <DropdownMenuItem onClick={handleRemoveMember}>
                Remove from team
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};
