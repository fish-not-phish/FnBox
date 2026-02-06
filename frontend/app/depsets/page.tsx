"use client";

import { Search, Package, Trash2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchDepsets, deleteDepset, type DepsetListItem } from "@/services/depsets";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateDepsetDrawer } from "@/components/depsets/CreateDepsetDrawer";
import { EditDepsetDrawer } from "@/components/depsets/EditDepsetDrawer";
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

export default function DepsetsPage() {
  const { user } = useAuthContext();
  const router = useRouter();

  // Auth check
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading) {
    return (
      <AppLayout breadcrumbs={[{ label: "Dependencies", href: "/depsets" }]}>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Dependencies", href: "/depsets" }]}>
      <DepsetsContent />
    </AppLayout>
  );
}

function DepsetsContent() {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [depsets, setDepsets] = useState<DepsetListItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [depsetToDelete, setDepsetToDelete] = useState<DepsetListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [depsetToEdit, setDepsetToEdit] = useState<DepsetListItem | null>(null);

  // Fetch depsets
  const loadDepsets = async () => {
    if (!selectedTeam) return;

    setIsLoading(true);
    try {
      const data = await fetchDepsets(selectedTeam.id);
      setDepsets(data);
    } catch (error) {
      console.error("Failed to fetch depsets:", error);
      toast.error("Failed to load depsets");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDepsets();
  }, [selectedTeam]);

  // Filter depsets based on search
  const filteredDepsets = useMemo(() => {
    if (!searchValue.trim()) return depsets;

    const searchLower = searchValue.toLowerCase();
    return depsets.filter(
      (depset) =>
        depset.name.toLowerCase().includes(searchLower) ||
        depset.description.toLowerCase().includes(searchLower) ||
        depset.runtime_type.toLowerCase().includes(searchLower)
    );
  }, [depsets, searchValue]);

  // Handle delete
  const handleDelete = async () => {
    if (!depsetToDelete || !user.csrfToken || !selectedTeam) return;

    setIsDeleting(true);
    try {
      await deleteDepset(selectedTeam.id, depsetToDelete.slug, user.csrfToken);
      toast.success("Dependency set deleted successfully");
      setDepsetToDelete(null);
      loadDepsets();
    } catch (error) {
      console.error("Failed to delete depset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to delete depset");
    } finally {
      setIsDeleting(false);
    }
  };

  // Get runtime label
  const getRuntimeLabel = (runtimeType: string, runtimeVersion: string) => {
    if (runtimeType === "python") return `Python ${runtimeVersion}`;
    if (runtimeType === "nodejs") return `Node.js ${runtimeVersion}`;
    if (runtimeType === "ruby") return `Ruby ${runtimeVersion}`;
    return `${runtimeType} ${runtimeVersion}`;
  };

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dependency Sets</h1>
        <p className="text-muted-foreground">
          Manage reusable dependency sets for your functions. Similar to AWS Lambda layers.
        </p>
      </div>

      {/* Actions bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search depsets..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9"
          />
        </div>
        <CreateDepsetDrawer onDepsetCreated={loadDepsets} />
      </div>

      {/* Depsets grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : filteredDepsets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">
              {searchValue ? "No depsets found" : "No dependency sets yet"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchValue
                ? "Try adjusting your search"
                : "Create your first dependency set to get started"}
            </p>
            {!searchValue && <CreateDepsetDrawer onDepsetCreated={loadDepsets} />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDepsets.map((depset) => (
            <Card key={depset.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1 flex-1">
                    <CardTitle className="text-lg">{depset.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {getRuntimeLabel(depset.runtime_type, depset.runtime_version)}
                      </Badge>
                      {depset.is_public && (
                        <Badge variant="outline" className="text-xs">
                          Public
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {depset.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {depset.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {depset.package_count} {depset.package_count === 1 ? "package" : "packages"}
                  </span>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 cursor-pointer"
                    onClick={() => setDepsetToEdit(depset)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="cursor-pointer"
                    onClick={() => setDepsetToDelete(depset)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit drawer */}
      {depsetToEdit && (
        <EditDepsetDrawer
          depset={depsetToEdit}
          onDepsetUpdated={() => {
            loadDepsets();
            setDepsetToEdit(null);
          }}
          onClose={() => setDepsetToEdit(null)}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!depsetToDelete} onOpenChange={(open) => !open && setDepsetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dependency set?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{depsetToDelete?.name}"? This will remove it from all
              functions using it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
