"use client";

import { CornerDownLeft, User as UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { addTeamMember } from "@/services/team-members";
import { searchUsers, type UserSearchResult } from "@/services/user";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleMultiSelect } from "./RoleMultiSelect";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InviteMemberDialogProps {
  onMemberAdded?: () => void;
}

export const InviteMemberDialog = ({
  onMemberAdded,
}: InviteMemberDialogProps) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [roles, setRoles] = useState<string[]>(["viewer"]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();

  // Search for users when query changes
  useEffect(() => {
    const searchDebounced = setTimeout(async () => {
      if (searchQuery.length >= 2) {
        console.log('Searching for users with query:', searchQuery);
        setIsSearching(true);
        setShowDropdown(true);
        try {
          const results = await searchUsers(searchQuery);
          console.log('Search results:', results);
          setSearchResults(results);
        } catch (error) {
          console.error("Failed to search users:", error);
          toast.error("Failed to search users");
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(searchDebounced);
  }, [searchQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam || !user.csrfToken) {
      toast.error("No team selected or not authenticated");
      return;
    }

    if (!selectedUser) {
      toast.error("Please select a user");
      return;
    }

    if (roles.length === 0) {
      toast.error("Please select at least one role");
      return;
    }

    setIsSubmitting(true);

    try {
      await addTeamMember(
        selectedTeam.slug,
        {
          email: selectedUser.email,
          roles,
        },
        user.csrfToken
      );
      toast.success("Member added successfully");

      setOpen(false);
      setSearchQuery("");
      setSelectedUser(null);
      setSearchResults([]);
      setRoles(["viewer"]);

      if (onMemberAdded) {
        onMemberAdded();
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add member"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectUser = (user: UserSearchResult) => {
    setSelectedUser(user);
    setSearchQuery(user.email);
    setShowDropdown(false);
  };

  const getUserDisplayName = (user: UserSearchResult) => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return user.username;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="cursor-pointer">Invite Member</Button>
      </DialogTrigger>
      <DialogContent className="gap-0 overflow-hidden p-0">
        <DialogTitle className="flex items-center gap-2 border-b p-4 text-sm font-medium">
          Invite Team Member
        </DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 bg-muted pt-4">
          <div className="flex flex-col gap-4 px-4">
            <div className="space-y-1">
              <Label className="text-xs">Search User</Label>
              <div className="relative">
                <Input
                  placeholder="Search by name, email, or username..."
                  className="bg-background"
                  value={searchQuery}
                  onChange={(e) => {
                    console.log('Input changed:', e.target.value);
                    setSearchQuery(e.target.value);
                    if (!e.target.value) {
                      setSelectedUser(null);
                    }
                  }}
                  onFocus={() => {
                    if (searchResults.length > 0) {
                      setShowDropdown(true);
                    }
                  }}
                />

                {/* Dropdown with search results */}
                {showDropdown && searchQuery.length >= 2 && (
                  <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
                    {isSearching ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        Searching...
                      </div>
                    ) : searchResults.length > 0 ? (
                      <div className="p-1">
                        {searchResults.map((userResult) => (
                          <button
                            key={userResult.id}
                            type="button"
                            className={cn(
                              "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-accent cursor-pointer",
                              selectedUser?.id === userResult.id && "bg-accent"
                            )}
                            onClick={() => handleSelectUser(userResult)}
                          >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted shrink-0">
                              <UserIcon className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col items-start min-w-0">
                              <span className="text-sm font-medium truncate w-full">
                                {getUserDisplayName(userResult)}
                              </span>
                              <span className="text-xs text-muted-foreground truncate w-full">
                                {userResult.email}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Search and select a user to add to the team
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Select roles</Label>
              <RoleMultiSelect
                selectedRoles={roles}
                onRolesChange={setRoles}
                disabledRoles={["owner"]}
                adminExclusive={true}
              />
              <p className="text-xs text-muted-foreground">
                Select one or more roles. Admin cannot be combined with other roles.
              </p>
            </div>
          </div>
          <DialogFooter className="border-t bg-background px-4 py-3">
            <Button size="sm" type="submit" disabled={isSubmitting || !selectedUser} className="cursor-pointer">
              {isSubmitting ? "Adding..." : "Add Member"} <CornerDownLeft />
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
