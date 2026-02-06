"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const AVAILABLE_ROLES = [
  { value: "admin", label: "Admin", description: "Full administrative access" },
  { value: "editor", label: "Editor", description: "Can create, edit, and deploy functions" },
  { value: "runner", label: "Runner", description: "Can execute functions" },
  { value: "viewer", label: "Viewer", description: "Read-only access" },
];

interface RoleMultiSelectProps {
  selectedRoles: string[];
  onRolesChange: (roles: string[]) => void;
  disabled?: boolean;
  disabledRoles?: string[];
  adminExclusive?: boolean; // If true, admin cannot coexist with other roles
  deferUpdate?: boolean; // If true, only update when popover closes
}

export const RoleMultiSelect = ({
  selectedRoles,
  onRolesChange,
  disabled = false,
  disabledRoles = [],
  adminExclusive = false,
  deferUpdate = false,
}: RoleMultiSelectProps) => {
  const [open, setOpen] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<string[]>(selectedRoles);

  const handleRoleToggle = (roleValue: string) => {
    const currentRoles = deferUpdate ? pendingRoles : selectedRoles;
    let newRoles: string[];

    if (currentRoles.includes(roleValue)) {
      // Remove role
      newRoles = currentRoles.filter((r) => r !== roleValue);
    } else {
      // Add role
      if (adminExclusive && roleValue === "admin") {
        // If adding admin and adminExclusive is true, clear all other roles
        newRoles = ["admin"];
      } else if (adminExclusive && currentRoles.includes("admin")) {
        // If admin is selected and adding another role, remove admin
        newRoles = [roleValue];
      } else {
        // Normal multi-select
        newRoles = [...currentRoles, roleValue];
      }
    }

    if (deferUpdate) {
      // Update pending roles only, don't call onRolesChange yet
      setPendingRoles(newRoles);
    } else {
      // Immediate update
      onRolesChange(newRoles);
    }

    // Keep popover open for multi-select
    setTimeout(() => setOpen(true), 0);
  };

  // Sync pendingRoles when selectedRoles changes from parent
  useEffect(() => {
    if (deferUpdate) {
      setPendingRoles(selectedRoles);
    }
  }, [selectedRoles, deferUpdate]);

  // Handle popover close - save pending changes if deferUpdate is true
  useEffect(() => {
    if (!open && deferUpdate) {
      // Popover closed, apply pending changes
      if (JSON.stringify(pendingRoles.sort()) !== JSON.stringify(selectedRoles.sort())) {
        onRolesChange(pendingRoles);
      }
    }
  }, [open, deferUpdate, pendingRoles, selectedRoles, onRolesChange]);

  const getDisplayText = () => {
    const roles = deferUpdate ? pendingRoles : selectedRoles;
    if (roles.length === 0) return "Select roles...";
    if (roles.length === 1) {
      const role = AVAILABLE_ROLES.find(r => r.value === roles[0]);
      return role ? role.label : roles[0];
    }
    return `${roles.length} roles selected`;
  };

  // Determine if a role should be disabled
  const isRoleDisabled = (roleValue: string) => {
    // Check if role is explicitly disabled
    return disabledRoles.includes(roleValue);
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="min-w-[200px] justify-between capitalize cursor-pointer"
          role="combobox"
          variant="outline"
          disabled={disabled}
        >
          {getDisplayText()}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[250px] p-0">
        <Command>
          <CommandInput placeholder="Search roles..." />
          <CommandList>
            <CommandEmpty>No role found.</CommandEmpty>
            <CommandGroup>
              {AVAILABLE_ROLES.map((role) => {
                const currentRoles = deferUpdate ? pendingRoles : selectedRoles;
                const isSelected = currentRoles.includes(role.value);
                const isDisabled = isRoleDisabled(role.value);

                return (
                  <CommandItem
                    className={cn(isDisabled && "opacity-50")}
                    disabled={isDisabled}
                    key={role.value}
                    onSelect={() => {
                      handleRoleToggle(role.value);
                    }}
                    value={role.value}
                  >
                    <Check
                      className={cn(
                        "mr-2 size-4",
                        isSelected ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{role.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {role.description}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
