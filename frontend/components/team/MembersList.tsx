"use client";

import { MemberCard } from "./MemberCard";
import type { TeamMember } from "@/services/team-members";

interface MembersListProps {
  members: TeamMember[];
  currentUserRoles: string[];
  ownerId: number;
  onMemberUpdated?: () => void;
}

export const MembersList = ({
  members,
  currentUserRoles,
  ownerId,
  onMemberUpdated,
}: MembersListProps) => {
  if (members.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">No members found</p>
      </div>
    );
  }

  return (
    <ul className="overflow-x-auto">
      {members.map((member) => (
        <li
          key={`member-${member.id}`}
          className="w-full min-w-80 shrink-0 border-b py-3 first:pt-0 last:border-b-0"
        >
          <MemberCard
            member={member}
            currentUserRoles={currentUserRoles}
            ownerId={ownerId}
            onMemberUpdated={onMemberUpdated}
          />
        </li>
      ))}
    </ul>
  );
};
