"use client";

import { useState, useEffect } from "react";
import { Clock, Trash2, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";
import { fetchTriggers, createTrigger, updateTrigger, deleteTrigger, type TriggerListItem } from "@/services/triggers";

interface ManageTriggersDrawerProps {
  functionId: string;
  disabled?: boolean;
  onTriggersUpdated?: () => void;
}

export function ManageTriggersDrawer({
  functionId,
  disabled = false,
  onTriggersUpdated,
}: ManageTriggersDrawerProps) {
  const { user } = useAuthContext();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [triggers, setTriggers] = useState<TriggerListItem[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newTriggerName, setNewTriggerName] = useState("");
  const [schedulePreset, setSchedulePreset] = useState("hourly");
  const [newTriggerSchedule, setNewTriggerSchedule] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Schedule presets
  const schedulePresets = {
    "hourly": { label: "Every hour", cron: "0 * * * *" },
    "daily": { label: "Every day at midnight", cron: "0 0 * * *" },
    "daily-9am": { label: "Every day at 9 AM", cron: "0 9 * * *" },
    "weekly": { label: "Every Monday at 9 AM", cron: "0 9 * * 1" },
    "monthly": { label: "First day of month at midnight", cron: "0 0 1 * *" },
    "every-15min": { label: "Every 15 minutes", cron: "*/15 * * * *" },
    "every-5min": { label: "Every 5 minutes", cron: "*/5 * * * *" },
    "custom": { label: "Custom cron expression", cron: "" },
  };

  // Get human-readable description of a cron schedule
  const getScheduleDescription = (cron: string): string => {
    const preset = Object.entries(schedulePresets).find(([_, v]) => v.cron === cron);
    if (preset) {
      return preset[1].label;
    }
    return cron; // Return raw cron if no preset matches
  };

  // Load triggers when drawer opens
  useEffect(() => {
    if (open) {
      loadTriggers();
    }
  }, [open]);

  const loadTriggers = async () => {
    setIsLoading(true);
    try {
      const data = await fetchTriggers(functionId);
      setTriggers(data);
    } catch (error) {
      console.error("Failed to fetch triggers:", error);
      toast.error("Failed to load triggers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!user.csrfToken) {
      toast.error("Authentication error");
      return;
    }

    if (!newTriggerName.trim()) {
      toast.error("Trigger name is required");
      return;
    }

    // Determine the schedule to use
    let scheduleToUse = "";
    if (schedulePreset === "custom") {
      if (!newTriggerSchedule.trim()) {
        toast.error("Custom cron expression is required");
        return;
      }
      scheduleToUse = newTriggerSchedule;
    } else {
      scheduleToUse = schedulePresets[schedulePreset as keyof typeof schedulePresets].cron;
    }

    setIsCreating(true);
    try {
      await createTrigger(
        functionId,
        {
          name: newTriggerName,
          trigger_type: "scheduled",
          schedule: scheduleToUse,
          enabled: true,
        },
        user.csrfToken
      );
      toast.success("Trigger created successfully");
      setNewTriggerName("");
      setNewTriggerSchedule("");
      setShowCreateForm(false);
      loadTriggers();
      if (onTriggersUpdated) onTriggersUpdated();
    } catch (error) {
      console.error("Failed to create trigger:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create trigger");
    } finally {
      setIsCreating(false);
    }
  };

  const handleToggle = async (trigger: TriggerListItem) => {
    if (!user.csrfToken) return;

    try {
      await updateTrigger(
        trigger.uuid,
        { enabled: !trigger.enabled },
        user.csrfToken
      );
      toast.success(`Trigger ${trigger.enabled ? "disabled" : "enabled"}`);
      loadTriggers();
      if (onTriggersUpdated) onTriggersUpdated();
    } catch (error) {
      console.error("Failed to update trigger:", error);
      toast.error("Failed to update trigger");
    }
  };

  const handleDelete = async (trigger: TriggerListItem) => {
    if (!user.csrfToken) return;

    try {
      await deleteTrigger(trigger.uuid, user.csrfToken);
      toast.success("Trigger deleted successfully");
      loadTriggers();
      if (onTriggersUpdated) onTriggersUpdated();
    } catch (error) {
      console.error("Failed to delete trigger:", error);
      toast.error("Failed to delete trigger");
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button size="sm" disabled={disabled} className="cursor-pointer">
          <Clock className="size-4 mr-2" />
          Manage Triggers
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[500px] rounded-none">
        <DrawerHeader>
          <DrawerTitle>Manage Triggers</DrawerTitle>
          <DrawerDescription>
            Configure scheduled triggers to automatically invoke this function
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              {/* Existing Triggers */}
              {triggers.length > 0 && (
                <div className="space-y-2">
                  {triggers.map((trigger) => (
                    <div
                      key={trigger.id}
                      className="border rounded-lg p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="size-4 text-muted-foreground" />
                            <p className="text-sm font-medium">{trigger.name}</p>
                            <Badge variant={trigger.enabled ? "default" : "secondary"}>
                              {trigger.enabled ? "Enabled" : "Disabled"}
                            </Badge>
                          </div>
                          {trigger.schedule && (
                            <div className="space-y-0.5">
                              <p className="text-xs text-muted-foreground">
                                {getScheduleDescription(trigger.schedule)}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono">
                                {trigger.schedule}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch
                            checked={trigger.enabled}
                            onCheckedChange={() => handleToggle(trigger)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => handleDelete(trigger)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create Form */}
              {showCreateForm ? (
                <div className="border rounded-lg p-4 space-y-4">
                  <h3 className="text-sm font-medium">New Schedule Trigger</h3>
                  <div className="space-y-2">
                    <Label htmlFor="name">Trigger Name</Label>
                    <Input
                      id="name"
                      value={newTriggerName}
                      onChange={(e) => setNewTriggerName(e.target.value)}
                      placeholder="Daily backup"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="preset">Schedule</Label>
                    <Select
                      value={schedulePreset}
                      onValueChange={(value) => setSchedulePreset(value)}
                    >
                      <SelectTrigger id="preset">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(schedulePresets).map(([key, value]) => (
                          <SelectItem key={key} value={key}>
                            {value.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {schedulePreset !== "custom" && (
                      <p className="text-xs text-muted-foreground font-mono">
                        Cron: {schedulePresets[schedulePreset as keyof typeof schedulePresets].cron}
                      </p>
                    )}
                  </div>
                  {schedulePreset === "custom" && (
                    <div className="space-y-2">
                      <Label htmlFor="schedule">Custom Cron Expression</Label>
                      <Input
                        id="schedule"
                        value={newTriggerSchedule}
                        onChange={(e) => setNewTriggerSchedule(e.target.value)}
                        placeholder="0 0 * * *"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">
                        Format: minute hour day month weekday
                      </p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="cursor-pointer"
                      onClick={handleCreate}
                      disabled={isCreating}
                    >
                      {isCreating ? "Creating..." : "Create Trigger"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                      onClick={() => {
                        setShowCreateForm(false);
                        setNewTriggerName("");
                        setNewTriggerSchedule("");
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full cursor-pointer"
                  onClick={() => setShowCreateForm(true)}
                >
                  <Plus className="size-4 mr-2" />
                  Add Trigger
                </Button>
              )}

              {triggers.length === 0 && !showCreateForm && (
                <div className="text-center py-8">
                  <Clock className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No triggers configured
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" className="cursor-pointer">Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
