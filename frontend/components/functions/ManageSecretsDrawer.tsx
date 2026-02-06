"use client";

import { useState, useEffect } from "react";
import { Lock } from "lucide-react";
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
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchSecrets, type SecretListItem } from "@/services/vault";
import { updateFunction } from "@/services/functions";

interface ManageSecretsDrawerProps {
  functionId: string;
  currentSecretIds: number[];
  disabled?: boolean;
  onSecretsUpdated?: () => void;
}

export function ManageSecretsDrawer({
  functionId,
  currentSecretIds,
  disabled = false,
  onSecretsUpdated,
}: ManageSecretsDrawerProps) {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [secrets, setSecrets] = useState<SecretListItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>(currentSecretIds);

  // Load secrets when drawer opens
  useEffect(() => {
    if (open && selectedTeam) {
      loadSecrets();
    }
  }, [open, selectedTeam]);

  // Reset selection when currentSecretIds changes or drawer opens
  useEffect(() => {
    if (open) {
      setSelectedIds(currentSecretIds);
    }
  }, [open, currentSecretIds]);

  const loadSecrets = async () => {
    if (!selectedTeam) return;

    setIsLoading(true);
    try {
      const data = await fetchSecrets(selectedTeam.id);
      setSecrets(data);
    } catch (error) {
      console.error("Failed to fetch secrets:", error);
      toast.error("Failed to load secrets");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = (secretId: number) => {
    setSelectedIds((prev) =>
      prev.includes(secretId)
        ? prev.filter((id) => id !== secretId)
        : [...prev, secretId]
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
        { secret_ids: selectedIds },
        user.csrfToken
      );
      toast.success("Secrets updated successfully");

      // Close drawer
      setOpen(false);

      // Notify parent component
      if (onSecretsUpdated) {
        onSecretsUpdated();
      }
    } catch (error) {
      console.error("Failed to update secrets:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update secrets"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button size="sm" disabled={disabled} className="cursor-pointer">
          <Lock className="size-4 mr-2" />
          Add Secret
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[400px] rounded-none">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>Manage Secrets</DrawerTitle>
            <DrawerDescription>
              Select secrets to inject as environment variables
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : secrets.length === 0 ? (
              <div className="border rounded-lg p-8 text-center">
                <Lock className="size-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  No secrets available. Create secrets in the Vault first.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {secrets.map((secret) => (
                  <div
                    key={secret.id}
                    className="flex items-start space-x-3 border rounded-lg p-3 hover:bg-accent/50 transition-colors"
                  >
                    <Checkbox
                      id={`secret-${secret.id}`}
                      checked={selectedIds.includes(secret.id)}
                      onCheckedChange={() => handleToggle(secret.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`secret-${secret.id}`}
                        className="text-sm font-mono font-medium cursor-pointer"
                      >
                        {secret.key}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {secret.description || "No description"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Selected secrets will be injected as
                environment variables when your function runs. Access them using
                standard methods (e.g., <code className="text-xs bg-background px-1 py-0.5 rounded">os.environ</code> in Python).
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
