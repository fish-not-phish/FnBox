"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Lock,
  ChevronRight,
  Settings,
} from "lucide-react";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchSiteSettings,
  updateSiteSettings,
  type SiteSettings,
} from "@/services/siteSettings";
import { updateProfile, changePassword } from "@/services/user";

const sections = [
  { id: "personal", label: "Personal Info", icon: User },
  { id: "security", label: "Security", icon: Lock },
  { id: "site", label: "Site Settings", icon: Settings, adminOnly: true },
];

export default function AccountSettingsPage() {
  const { user, setUser } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("personal");
  const [isAdmin, setIsAdmin] = useState(false);

  // Personal info state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Site settings state
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [isLoadingSiteSettings, setIsLoadingSiteSettings] = useState(false);
  const [isSavingSiteSettings, setIsSavingSiteSettings] = useState(false);

  // Auth check
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  // Load user data
  useEffect(() => {
    if (user.isLoggedIn) {
      setFirstName(user.first_name || "");
      setLastName(user.last_name || "");
      setIsAdmin(user.isAdmin || false);
    }
  }, [user]);

  // Load site settings for admins
  const loadSiteSettings = async () => {
    if (!isAdmin) return;

    setIsLoadingSiteSettings(true);
    try {
      const data = await fetchSiteSettings();
      setSiteSettings(data);
    } catch (error) {
      console.error("Failed to load site settings:", error);
      toast.error("Failed to load site settings");
    } finally {
      setIsLoadingSiteSettings(false);
    }
  };

  useEffect(() => {
    if (activeSection === "site" && isAdmin) {
      loadSiteSettings();
    }
  }, [activeSection, isAdmin]);

  // Save profile
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const updatedUser = await updateProfile(
        {
          first_name: firstName,
          last_name: lastName,
        },
        user.csrfToken
      );

      // Update user context with new values
      setUser((prev) => ({
        ...prev,
        first_name: updatedUser.first_name,
        last_name: updatedUser.last_name,
      }));

      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Failed to update profile:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(
        {
          current_password: currentPassword,
          new_password: newPassword,
        },
        user.csrfToken
      );

      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Failed to change password:", error);
      toast.error(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Site settings handlers
  const handleToggleRegistration = async (enabled: boolean) => {
    if (!siteSettings) return;

    setIsSavingSiteSettings(true);
    try {
      const updated = await updateSiteSettings(
        { allow_registration: enabled },
        user.csrfToken
      );
      setSiteSettings(updated);
      toast.success(`Registration ${enabled ? "enabled" : "disabled"} successfully`);
    } catch (error) {
      console.error("Failed to update site settings:", error);
      toast.error("Failed to update site settings");
    } finally {
      setIsSavingSiteSettings(false);
    }
  };

  if (user.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Account Settings", href: "/account" }]}>
        <div className="container max-w-7xl mx-auto px-4">
          <Skeleton className="h-8 w-64 mb-6" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  const visibleSections = sections.filter((section) => !section.adminOnly || isAdmin);

  return (
    <AppLayout breadcrumbs={[{ label: "Account Settings", href: "/account" }]}>
      <section className="py-6">
        <div className="container max-w-7xl mx-auto px-4">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Account</span>
              <ChevronRight className="size-4" />
              <span className="text-foreground">Settings</span>
            </div>
            <h1 className="mt-2 text-2xl font-semibold">Account Settings</h1>
            <p className="text-muted-foreground">
              Manage your personal information, security, and preferences
            </p>
          </div>

          <div className="flex flex-col gap-8 lg:flex-row">
            {/* Sidebar Navigation */}
            <aside className="lg:w-56 lg:shrink-0">
              <nav className="space-y-1">
                {visibleSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors cursor-pointer",
                        activeSection === section.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="size-4" />
                      {section.label}
                    </button>
                  );
                })}
              </nav>
            </aside>

            {/* Main Content */}
            <main className="min-w-0 flex-1">
              <div className="rounded-xl border bg-card shadow-sm">
                {/* Personal Info Section */}
                {activeSection === "personal" && (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold">Personal Information</h2>
                    <p className="text-sm text-muted-foreground">
                      Update your personal details
                    </p>

                    <div className="mt-6 space-y-6">
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="firstName">First name</Label>
                          <Input
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            placeholder="John"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lastName">Last name</Label>
                          <Input
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            placeholder="Doe"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="email">Email address</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="email"
                            type="email"
                            className="pl-10 bg-muted cursor-not-allowed"
                            value={user.email || ""}
                            disabled
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Email cannot be changed. Contact support if you need to update it.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6">
                      <Button
                        onClick={handleSaveProfile}
                        disabled={isSavingProfile}
                        className="cursor-pointer"
                      >
                        {isSavingProfile ? "Saving..." : "Save changes"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Security Section */}
                {activeSection === "security" && (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold">Security</h2>
                    <p className="text-sm text-muted-foreground">
                      Manage your password and security settings
                    </p>

                    <div className="mt-6 space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="currentPassword">Current password</Label>
                        <Input
                          id="currentPassword"
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Enter your current password"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New password</Label>
                        <Input
                          id="newPassword"
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Enter your new password"
                        />
                        <p className="text-xs text-muted-foreground">
                          Password must be at least 8 characters long
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm new password</Label>
                        <Input
                          id="confirmPassword"
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Confirm your new password"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 mt-6">
                      <Button
                        onClick={handleChangePassword}
                        disabled={isChangingPassword}
                        className="cursor-pointer"
                      >
                        {isChangingPassword ? "Changing..." : "Change password"}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Site Settings Section (Admin Only) */}
                {activeSection === "site" && isAdmin && (
                  <div className="p-6">
                    <h2 className="text-lg font-semibold">Site Settings</h2>
                    <p className="text-sm text-muted-foreground">
                      Configure site-wide settings and behavior
                    </p>

                    {isLoadingSiteSettings ? (
                      <div className="mt-6">
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ) : siteSettings ? (
                      <div className="mt-6 space-y-6">
                        <Card>
                          <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="allow-registration" className="text-base">
                                  Allow Registration
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  When disabled, the signup page will redirect to login.
                                  Only admins can create new accounts.
                                </p>
                              </div>
                              <Switch
                                id="allow-registration"
                                checked={siteSettings.allow_registration}
                                onCheckedChange={handleToggleRegistration}
                                disabled={isSavingSiteSettings}
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="mt-6 text-center py-8 text-muted-foreground">
                        Failed to load site settings
                      </div>
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      </section>
    </AppLayout>
  );
}
