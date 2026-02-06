"use client";

import { useAuthContext } from "@/store/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { AppLayout } from "@/components/layout/sidebar";
import { DashboardContent } from "./DashboardContent";

export default function DashboardPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    // Wait for auth to load
    if (user.isLoading) return;

    // Redirect to login if not authenticated
    if (!user.isLoggedIn) {
      router.push("/login");
      return;
    }
  }, [user, router]);

  // Show spinner while checking auth
  if (user.isLoading || !user.isLoggedIn) {
    return (
      <div className="h-[100dvh] w-full flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  return (
    
    <AppLayout
      breadcrumbs={[
        { label: "Overview", href: "/dashboard" },
        { label: "Dashboard" }
      ]}
    >
      <DashboardContent />
    </AppLayout>
  );
}
