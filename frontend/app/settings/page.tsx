"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Settings as SettingsIcon, ShieldCheck } from "lucide-react";
import { useAuthContext } from "@/store/AuthContext";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  // Check if user is admin
  const isAdmin = user.isAdmin || false;

  // Auth check
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Settings", href: "/settings" }]}>
        <div className="container max-w-7xl mx-auto px-4">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout breadcrumbs={[{ label: "Settings", href: "/settings" }]}>
        <div className="container max-w-7xl mx-auto px-4">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ShieldCheck className="size-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground text-center">
                Only administrators can access settings.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Settings", href: "/settings" }]}>
      <div className="container max-w-7xl mx-auto px-4 space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="size-8 text-primary" />
          <h3 className="text-2xl font-semibold tracking-tight">Settings</h3>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
            <CardDescription>
              Platform configuration and preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-12">
              <SettingsIcon className="size-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Settings configuration coming soon.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
