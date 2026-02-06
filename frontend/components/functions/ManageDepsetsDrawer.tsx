"use client";

import { useState, useEffect } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchDepsets, type DepsetListItem } from "@/services/depsets";
import { updateFunction } from "@/services/functions";

interface ManageDepsetsDrawerProps {
  functionId: string;
  currentDepsetIds: number[];
  functionRuntime: string; // e.g., "python3.14"
  disabled?: boolean;
  onDepsetsUpdated?: () => void;
}

export function ManageDepsetsDrawer({
  functionId,
  currentDepsetIds,
  functionRuntime,
  disabled = false,
  onDepsetsUpdated,
}: ManageDepsetsDrawerProps) {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [depsets, setDepsets] = useState<DepsetListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(currentDepsetIds);

  // Parse runtime type and version from function runtime
  // e.g., "python3.11" -> { type: "python", version: "3.11" }
  const parseRuntime = (runtime: string): { type: string; version: string } => {
    if (runtime.startsWith("python")) {
      return { type: "python", version: runtime.replace("python", "") };
    }
    if (runtime.startsWith("nodejs")) {
      return { type: "nodejs", version: runtime.replace("nodejs", "") };
    }
    if (runtime.startsWith("ruby")) {
      return { type: "ruby", version: runtime.replace("ruby", "") };
    }
    if (runtime.startsWith("go")) {
      return { type: "go", version: runtime.replace("go", "") };
    }
    if (runtime.startsWith("java")) {
      return { type: "java", version: runtime.replace("java", "") };
    }
    if (runtime.startsWith("dotnet")) {
      return { type: "dotnet", version: runtime.replace("dotnet", "") };
    }
    if (runtime.startsWith("bash")) {
      return { type: "bash", version: runtime.replace("bash", "") };
    }
    return { type: "python", version: "3.11" };
  };

  const { type: runtimeType, version: runtimeVersion } = parseRuntime(functionRuntime);

  // Load depsets when drawer opens
  useEffect(() => {
    if (open && selectedTeam) {
      loadDepsets();
    }
  }, [open, selectedTeam]);

  // Reset selection when currentDepsetIds changes or drawer opens
  useEffect(() => {
    if (open) {
      setSelectedIds(currentDepsetIds);
    }
  }, [open, currentDepsetIds]);

  const loadDepsets = async () => {
    if (!selectedTeam) return;

    setIsLoading(true);
    try {
      // Fetch depsets filtered by runtime type and version
      const data = await fetchDepsets(selectedTeam.id, runtimeType, runtimeVersion);
      setDepsets(data);
    } catch (error) {
      console.error("Failed to fetch depsets:", error);
      toast.error("Failed to load dependency sets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (depsetId: number) => {
    setSelectedIds((prev) =>
      prev.includes(depsetId)
        ? prev.filter((id) => id !== depsetId)
        : [...prev, depsetId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user.csrfToken) {
      toast.error("Authentication error");
      return;
    }

    setIsSubmitting(true);

    try {
      await updateFunction(
        functionId,
        { depset_ids: selectedIds },
        user.csrfToken
      );
      toast.success("Dependencies updated successfully");

      // Close drawer
      setOpen(false);

      // Notify parent component
      if (onDepsetsUpdated) {
        onDepsetsUpdated();
      }
    } catch (error) {
      console.error("Failed to update depsets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update dependencies"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button size="sm" disabled={disabled} className="cursor-pointer">
          <Package className="size-4 mr-2" />
          Add Dependencies
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[400px] rounded-none">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>Manage Dependencies</DrawerTitle>
            <DrawerDescription>
              Select dependency sets to install in your function runtime
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : depsets.length === 0 ? (
              <div className="border rounded-lg p-8 text-center">
                <Package className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-1">
                  No {runtimeType} {runtimeVersion} dependency sets available.
                </p>
                <p className="text-xs text-muted-foreground">
                  Create dependency sets for {runtimeType} {runtimeVersion} in the Depsets section first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {depsets.map((depset) => (
                  <div
                    key={depset.id}
                    className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`depset-${depset.id}`}
                      checked={selectedIds.includes(depset.id)}
                      onCheckedChange={() => handleToggle(depset.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Label
                          htmlFor={`depset-${depset.id}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {depset.name}
                        </Label>
                        <Badge variant="outline" className="text-xs">
                          {depset.runtime_type} {depset.runtime_version}
                        </Badge>
                        {depset.is_public && (
                          <Badge variant="secondary" className="text-xs">
                            Public
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                        {depset.description || "No description"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {depset.package_count} package{depset.package_count !== 1 ? "s" : ""}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Selected packages will be installed when
                your function is deployed. This ensures dependencies are available
                at runtime.
              </p>
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" type="button" className="cursor-pointer">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
