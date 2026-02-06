"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
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
import { useTeamContext } from "@/store/TeamContext";
import { createSecret, type CreateSecretData } from "@/services/vault";

interface CreateSecretDrawerProps {
  onSecretCreated?: () => void;
}

export function CreateSecretDrawer({ onSecretCreated }: CreateSecretDrawerProps) {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTeam) {
      toast.error("No team selected");
      return;
    }

    if (!user.csrfToken) {
      toast.error("Authentication error");
      return;
    }

    setIsSubmitting(true);

    try {
      const data: CreateSecretData = {
        key,
        value,
        description,
        team_id: selectedTeam.id,
      };

      await createSecret(data, user.csrfToken);
      toast.success("Secret created successfully");

      // Reset form
      setKey("");
      setValue("");
      setDescription("");

      // Close drawer
      setOpen(false);

      // Notify parent component
      if (onSecretCreated) {
        onSecretCreated();
      }
    } catch (error) {
      console.error("Failed to create secret:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create secret");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="size-4 mr-2" />
          New Secret
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[400px] rounded-none">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>Create New Secret</DrawerTitle>
            <DrawerDescription>
              Add an encrypted secret to your team's vault
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {/* Key */}
            <div className="space-y-2">
              <Label htmlFor="key">
                Key <span className="text-destructive">*</span>
              </Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="DATABASE_URL"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Environment variable name (e.g., DATABASE_URL, API_KEY)
              </p>
            </div>

            {/* Value */}
            <div className="space-y-2">
              <Label htmlFor="value">
                Value <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="postgresql://user:pass@host/db"
                required
                rows={4}
                className="resize-none font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The secret value will be encrypted at rest
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
                <strong>Note:</strong> After creation, the secret value cannot be viewed again.
                You can only update it with a new value.
              </p>
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" className="cursor-pointer" disabled={isSubmitting || !key || !value}>
              {isSubmitting ? "Creating..." : "Create Secret"}
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
