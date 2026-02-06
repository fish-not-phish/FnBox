"use client";

import { Search, Lock, Trash2, Shield } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchSecrets, deleteSecret, type SecretListItem } from "@/services/vault";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreateSecretDrawer } from "@/components/vault/CreateSecretDrawer";
import { EditSecretDrawer } from "@/components/vault/EditSecretDrawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export default function VaultPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  // Auth check only
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Vault", href: "/vault" }]}>
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-10 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Vault", href: "/vault" }]}>
      <VaultContent />
    </AppLayout>
  );
}

function VaultContent() {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [secrets, setSecrets] = useState<SecretListItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [secretToDelete, setSecretToDelete] = useState<SecretListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch secrets
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

  useEffect(() => {
    loadSecrets();
  }, [selectedTeam]);

  // Filter secrets based on search
  const filteredSecrets = useMemo(() => {
    if (!searchValue) return secrets;

    return secrets.filter((secret) => {
      const searchLower = searchValue.toLowerCase();
      return (
        secret.key.toLowerCase().includes(searchLower) ||
        secret.description.toLowerCase().includes(searchLower)
      );
    });
  }, [secrets, searchValue]);

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Handle delete
  const handleDelete = async () => {
    if (!secretToDelete || !user.csrfToken) return;

    setIsDeleting(true);
    try {
      await deleteSecret(secretToDelete.uuid, user.csrfToken);
      toast.success("Secret deleted successfully");
      setSecretToDelete(null);
      loadSecrets();
    } catch (error) {
      console.error("Failed to delete secret:", error);
      toast.error("Failed to delete secret");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Shield className="size-8 text-primary" />
            <h3 className="text-2xl font-semibold tracking-tight">Vault</h3>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Securely store encrypted secrets and environment variables. Secrets are encrypted at rest
            and injected as environment variables into your functions at runtime.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-56 min-w-20">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search secrets"
                className="pl-7"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            <CreateSecretDrawer onSecretCreated={loadSecrets} />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : filteredSecrets.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Lock className="size-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchValue
                    ? "No secrets found matching your search"
                    : "No secrets yet. Create your first secret to get started."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">
                {filteredSecrets.length}{" "}
                {filteredSecrets.length === 1 ? "secret" : "secrets"}
              </p>

              <div className="space-y-2">
                {filteredSecrets.map((secret) => (
                  <Card key={secret.id} className="hover:bg-accent/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Lock className="size-4 text-muted-foreground flex-shrink-0" />
                            <CardTitle className="text-lg font-mono">{secret.key}</CardTitle>
                          </div>
                          <CardDescription className="line-clamp-2">
                            {secret.description || "No description"}
                          </CardDescription>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <EditSecretDrawer secret={secret} onSecretUpdated={loadSecrets} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="cursor-pointer"
                            onClick={() => setSecretToDelete(secret)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Created {formatDate(secret.created_at)}</span>
                        <span>•</span>
                        <span>by {secret.created_by_username || "User removed"}</span>
                        {secret.updated_at !== secret.created_at && (
                          <>
                            <span>•</span>
                            <span>Updated {formatDate(secret.updated_at)}</span>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!secretToDelete} onOpenChange={() => setSecretToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Secret</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the secret <strong>{secretToDelete?.key}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
