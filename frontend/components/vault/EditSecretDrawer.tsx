"use client";

import { useState, useEffect } from "react";
import { Edit } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";
import { updateSecret, type SecretListItem, type UpdateSecretData } from "@/services/vault";

interface EditSecretDrawerProps {
  secret: SecretListItem;
  onSecretUpdated?: () => void;
}

export function EditSecretDrawer({ secret, onSecretUpdated }: EditSecretDrawerProps) {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [value, setValue] = useState("");
  const [description, setDescription] = useState(secret.description);

  // Reset form when secret changes or drawer opens
  useEffect(() => {
    if (open) {
      setValue("");
      setDescription(secret.description);
    }
  }, [open, secret]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user.csrfToken) {
      toast.error("Authentication error");
      return;
    }

    // Check if anything changed
    if (!value && description === secret.description) {
      toast.error("No changes to save");
      return;
    }

    setIsSubmitting(true);

    try {
      const data: UpdateSecretData = {
        description,
      };

      // Only include value if it was provided
      if (value) {
        data.value = value;
      }

      await updateSecret(secret.uuid, data, user.csrfToken);
      toast.success("Secret updated successfully");

      // Reset form
      setValue("");
      setDescription(secret.description);

      // Close drawer
      setOpen(false);

      // Notify parent component
      if (onSecretUpdated) {
        onSecretUpdated();
      }
    } catch (error) {
      console.error("Failed to update secret:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update secret");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="sm"  className="cursor-pointer">
          <Edit className="size-4" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[400px] rounded-none">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>Edit Secret</DrawerTitle>
            <DrawerDescription>
              Update the secret value or description
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {/* Key (Read-only) */}
            <div className="space-y-2">
              <Label htmlFor="key">Key (Read-only)</Label>
              <Input
                id="key"
                value={secret.key}
                disabled
                className="bg-muted cursor-not-allowed font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Environment variable name cannot be changed
              </p>
            </div>

            {/* Value (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="value">New Value (Optional)</Label>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Leave empty to keep current value"
                rows={4}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Enter a new value only if you want to change it. The current value cannot be viewed.
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Production database connection string"
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground">
                A brief description of what this secret is for
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> If you provide a new value, the secret will be re-encrypted.
                The new value cannot be viewed after saving.
              </p>
            </div>
          </div>

          <DrawerFooter>
            <Button
              type="submit"
              className="cursor-pointer"
              disabled={isSubmitting || (!value && description === secret.description)}
            >
              {isSubmitting ? "Updating..." : "Update Secret"}
            </Button>
            <DrawerClose asChild>
              <Button variant="outline" type="button"  className="cursor-pointer">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
