"use client";

import { useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { createTeam } from "@/services/teams";
import { toast } from "sonner";
import { useAuthContext } from "@/store/AuthContext";

interface TeamSetupFormData {
  name: string;
}

interface TeamSetupFormProps {
  onTeamNameChange?: (name: string) => void;
}

export function TeamSetupForm({ onTeamNameChange }: TeamSetupFormProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TeamSetupFormData>({
    defaultValues: {
      name: "",
    },
  });

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTeamNameChange?.(e.target.value);
  };

  async function onSubmit(data: TeamSetupFormData) {
    if (!user.csrfToken) {
      toast.error("Authentication error. Please refresh the page.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createTeam(data, user.csrfToken);
      toast.success("Team created successfully!");
      router.push("/dashboard");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create team. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          rules={{ required: "Team name is required" }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="My Awesome Team"
                  {...field}
                  onChange={(e) => {
                    field.onChange(e);
                    handleNameChange(e);
                  }}
                />
              </FormControl>
              <FormDescription>
                Choose a name for your team. You can change this later.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end">
          <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
            {isSubmitting ? "Creating..." : "Create Team"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
