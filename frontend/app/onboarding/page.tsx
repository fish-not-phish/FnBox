"use client";

import { TeamSetupForm } from "@/components/onboarding/TeamSetupForm";
import { useAuthContext } from "@/store/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";
import { DashboardPreview } from "@/components/onboarding/DashboardPreview";

export default function OnboardingPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const [teamName, setTeamName] = useState("");

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading || !user.isLoggedIn) {
    return (
      <div className="h-[100dvh] w-full flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <div className="container py-20">
        <div className="flex w-full flex-col-reverse gap-10 sm:rounded-2xl sm:border md:min-h-[85dvh] md:flex-row lg:rounded-3xl">
          {/* Left side - Form */}
          <div className="flex flex-1 justify-center sm:py-10 sm:px-10 md:py-20 md:px-16">
            <div className="flex h-full w-full max-w-md flex-col gap-6">
              <div>
                <p className="text-sm font-medium text-muted-foreground">1/1</p>
                <h3 className="text-2xl font-semibold tracking-tight">
                  Welcome! Let's set up your team
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  Create your first team to get started with collaboration
                </p>
              </div>
              <TeamSetupForm onTeamNameChange={setTeamName} />
            </div>
          </div>

          {/* Right side - Preview */}
          <div className="hidden flex-1 overflow-hidden bg-gradient-to-b from-background to-muted sm:pt-10 md:pt-20 lg:block">
            <DashboardPreview teamName={teamName} />
          </div>
        </div>
      </div>
    </div>
  );
}
