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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { createFunction, type CreateFunctionData } from "@/services/functions";
import { useRouter } from "next/navigation";

interface CreateFunctionDrawerProps {
  onFunctionCreated?: () => void;
}

// Default code templates for each runtime
const DEFAULT_CODE_TEMPLATES: Record<string, string> = {
  python: `def handler(event, context):
    """
    Main function handler.

    Args:
        event: Input event data
        context: Execution context

    Returns:
        Response data
    """
    return {
        "statusCode": 200,
        "body": "Hello from Python!"
    }`,
  nodejs: `function handler(event, context) {
  /**
   * Main function handler
   *
   * @param {Object} event - Input event data
   * @param {Object} context - Execution context
   * @returns {Object} Response data
   */
  return {
      statusCode: 200,
      body: 'Hello from Node.js!'
  };
}`,
  ruby: `# Ruby handler
def handler(event, context)
  {
    statusCode: 200,
    body: "Hello from Ruby!"
  }
end`,
  java: `import java.util.Map;
import java.util.HashMap;

public class Handler {
    public Map<String, Object> handler(Map<String, Object> event, Map<String, Object> context) {
        Map<String, Object> response = new HashMap<>();
        response.put("statusCode", 200);
        response.put("body", "Hello from Java!");
        return response;
    }
}`,
  dotnet: `using System.Collections.Generic;

public class Handler
{
    public Dictionary<string, object> handler(Dictionary<string, object> evt, Dictionary<string, object> context)
    {
        return new Dictionary<string, object>
        {
            { "statusCode", 200 },
            { "body", "Hello from .NET!" }
        };
    }
}`,
  bash: `#!/usr/bin/env bash
handler() {
    local event="$1"
    local context="$2"

    echo '{"statusCode": 200, "body": "Hello from Bash!"}'
}`,
  go: `package main

import "encoding/json"

func handler(event map[string]interface{}, context map[string]interface{}) map[string]interface{} {
    return map[string]interface{}{
        "statusCode": 200,
        "body":       "Hello from Go!",
    }
}`,
};

export function CreateFunctionDrawer({ onFunctionCreated }: CreateFunctionDrawerProps) {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [runtime, setRuntime] = useState("python3.11");

  const getDefaultCode = (runtimeId: string): string => {
    if (runtimeId.startsWith("python")) return DEFAULT_CODE_TEMPLATES.python;
    if (runtimeId.startsWith("nodejs")) return DEFAULT_CODE_TEMPLATES.nodejs;
    if (runtimeId.startsWith("ruby")) return DEFAULT_CODE_TEMPLATES.ruby;
    if (runtimeId.startsWith("java")) return DEFAULT_CODE_TEMPLATES.java;
    if (runtimeId.startsWith("dotnet")) return DEFAULT_CODE_TEMPLATES.dotnet;
    if (runtimeId.startsWith("bash")) return DEFAULT_CODE_TEMPLATES.bash;
    if (runtimeId.startsWith("go")) return DEFAULT_CODE_TEMPLATES.go;
    return DEFAULT_CODE_TEMPLATES.python;
  };

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
      const data: CreateFunctionData = {
        name,
        code: getDefaultCode(runtime),
        handler: "handler",
        runtime,
        memory_mb: 128,
        vcpu_count: 1,
        timeout_seconds: 30,
        status: "draft",
        is_public: false,
        team_id: selectedTeam.id,
      };

      const newFunction = await createFunction(data, user.csrfToken);
      toast.success("Function created");

      // Reset form
      setName("");
      setRuntime("python3.11");

      // Close drawer
      setOpen(false);

      // Notify parent component
      if (onFunctionCreated) {
        onFunctionCreated();
      }

      // Navigate to the function editor
      router.push(`/functions/${newFunction.uuid}/edit`);
    } catch (error) {
      console.error("Failed to create function:", error);
      toast.error("Failed to create function");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="right">
      <DrawerTrigger asChild>
        <Button className="cursor-pointer">
          <Plus className="size-4 mr-2" />
          New Function
        </Button>
      </DrawerTrigger>
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[400px] rounded-none">
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <DrawerHeader>
            <DrawerTitle>Create New Function</DrawerTitle>
            <DrawerDescription>
              Choose a name and runtime to get started
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Function Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-function"
                required
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Choose a descriptive name for your function
              </p>
            </div>

            {/* Runtime */}
            <div className="space-y-2">
              <Label htmlFor="runtime">Runtime</Label>
              <Select value={runtime} onValueChange={setRuntime}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="python3.14">Python 3.14</SelectItem>
                  <SelectItem value="python3.13">Python 3.13</SelectItem>
                  <SelectItem value="python3.12">Python 3.12</SelectItem>
                  <SelectItem value="python3.11">Python 3.11</SelectItem>
                  <SelectItem value="python3.10">Python 3.10</SelectItem>
                  <SelectItem value="python3.9">Python 3.9</SelectItem>
                  <SelectItem value="nodejs25">Node.js 25</SelectItem>
                  <SelectItem value="nodejs24">Node.js 24</SelectItem>
                  <SelectItem value="nodejs20">Node.js 20</SelectItem>
                  <SelectItem value="ruby3.4">Ruby 3.4</SelectItem>
                  <SelectItem value="java27">Java 27</SelectItem>
                  <SelectItem value="dotnet10">.NET 10</SelectItem>
                  <SelectItem value="dotnet9">.NET 9</SelectItem>
                  <SelectItem value="dotnet8">.NET 8</SelectItem>
                  <SelectItem value="bash5">Bash 5</SelectItem>
                  <SelectItem value="go1.25">Go 1.25</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Select the programming language and version
              </p>
            </div>

            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                You'll be able to write code, configure settings, and test your function in the editor.
              </p>
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" disabled={isSubmitting || !name} className="cursor-pointer">
              {isSubmitting ? "Creating..." : "Create & Edit"}
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
