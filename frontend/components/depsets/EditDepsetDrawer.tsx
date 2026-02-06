"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  fetchDepsetDetail,
  updateDepset,
  type DepsetListItem,
  type UpdateDepsetData,
  type DepsetPackageInput,
} from "@/services/depsets";
import { Card, CardContent } from "@/components/ui/card";

interface EditDepsetDrawerProps {
  depset: DepsetListItem;
  onDepsetUpdated?: () => void;
  onClose?: () => void;
}

interface PackageRow {
  id: string;
  package_name: string;
  version_spec: string;
}

export function EditDepsetDrawer({ depset, onDepsetUpdated, onClose }: EditDepsetDrawerProps) {
  const { user } = useAuthContext();
  const { selectedTeam } = useTeamContext();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [runtimeType, setRuntimeType] = useState("python");
  const [runtimeVersion, setRuntimeVersion] = useState("3.11");
  const [packages, setPackages] = useState<PackageRow[]>([]);

  // Load depset details
  useEffect(() => {
    const loadDetails = async () => {
      if (!selectedTeam) return;

      setIsLoading(true);
      try {
        const details = await fetchDepsetDetail(selectedTeam.id, depset.slug);
        setName(details.name);
        setDescription(details.description);
        setRuntimeType(details.runtime_type);
        setRuntimeVersion(details.runtime_version);

        // Convert packages to rows
        if (details.packages.length > 0) {
          setPackages(
            details.packages.map((pkg) => ({
              id: crypto.randomUUID(),
              package_name: pkg.package_name,
              version_spec: pkg.version_spec,
            }))
          );
        } else {
          setPackages([{ id: crypto.randomUUID(), package_name: "", version_spec: "" }]);
        }
      } catch (error) {
        console.error("Failed to load depset details:", error);
        toast.error("Failed to load depset details");
      } finally {
        setIsLoading(false);
      }
    };

    loadDetails();
  }, [depset.slug, selectedTeam]);

  const addPackage = () => {
    setPackages([...packages, { id: crypto.randomUUID(), package_name: "", version_spec: "" }]);
  };

  const removePackage = (id: string) => {
    if (packages.length === 1) {
      toast.error("At least one package is required");
      return;
    }
    setPackages(packages.filter((pkg) => pkg.id !== id));
  };

  const updatePackageRow = (id: string, field: keyof PackageRow, value: string) => {
    setPackages(
      packages.map((pkg) => (pkg.id === id ? { ...pkg, [field]: value } : pkg))
    );
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

    // Validate packages
    const validPackages = packages.filter((pkg) => pkg.package_name.trim());
    if (validPackages.length === 0) {
      toast.error("At least one package is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const data: UpdateDepsetData = {
        name,
        description,
        runtime_type: runtimeType,
        runtime_version: runtimeVersion,
        packages: validPackages.map((pkg, index) => ({
          package_name: pkg.package_name.trim(),
          version_spec: pkg.version_spec.trim(),
          order: index,
        })),
      };

      await updateDepset(selectedTeam.id, depset.slug, data, user.csrfToken);
      toast.success("Dependency set updated successfully");

      // Notify parent component
      if (onDepsetUpdated) {
        onDepsetUpdated();
      }
    } catch (error) {
      console.error("Failed to update depset:", error);
      toast.error(error instanceof Error ? error.message : "Failed to update depset");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get runtime version options based on type
  const getRuntimeVersionOptions = () => {
    if (runtimeType === "python") {
      return ["3.13", "3.12", "3.11", "3.10", "3.9"];
    }
    if (runtimeType === "nodejs") {
      return ["25", "24", "20"];
    }
    if (runtimeType === "ruby") {
      return ["3.4"];
    }
    return ["3.11"];
  };

  return (
    <Drawer open={true} onOpenChange={(open) => !open && onClose?.()} direction="right">
      <DrawerContent className="h-screen top-0 right-0 left-auto mt-0 w-[500px] rounded-none">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <DrawerHeader>
              <DrawerTitle>Edit Dependency Set</DrawerTitle>
              <DrawerDescription>
                Update the dependency set configuration and packages.
              </DrawerDescription>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4">
              <div className="space-y-4 pb-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Data Science Libraries"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Common data science packages for ML workloads"
                  rows={2}
                  disabled={isSubmitting}
                />
              </div>

              {/* Runtime Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="runtime-type">Runtime Type</Label>
                  <Select
                    value={runtimeType}
                    onValueChange={(value) => {
                      setRuntimeType(value);
                      // Reset version to first option when changing type based on new runtime
                      const getFirstVersion = (type: string) => {
                        if (type === "python") return "3.13";
                        if (type === "nodejs") return "25";
                        if (type === "ruby") return "3.4";
                        return "3.11";
                      };
                      setRuntimeVersion(getFirstVersion(value));
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="runtime-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="nodejs">Node.js</SelectItem>
                      <SelectItem value="ruby">Ruby</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="runtime-version">Runtime Version</Label>
                  <Select
                    value={runtimeVersion}
                    onValueChange={setRuntimeVersion}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="runtime-version">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getRuntimeVersionOptions().map((version) => (
                        <SelectItem key={version} value={version}>
                          {version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Packages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    Packages <span className="text-destructive">*</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="cursor-pointer"
                    onClick={addPackage}
                    disabled={isSubmitting}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Package
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Add packages with optional version numbers (e.g., 2.0.0, 1.5.2). If version is left empty, the latest version available will be installed.
                </p>

                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {packages.map((pkg, index) => (
                    <Card key={pkg.id}>
                      <CardContent className="p-3">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <Input
                              placeholder="Package name (e.g., requests, pandas)"
                              value={pkg.package_name}
                              onChange={(e) =>
                                updatePackageRow(pkg.id, "package_name", e.target.value)
                              }
                              disabled={isSubmitting}
                            />
                            <Input
                              placeholder="Version (optional, e.g., 2.28.0 or 1.5.0)"
                              value={pkg.version_spec}
                              onChange={(e) =>
                                updatePackageRow(pkg.id, "version_spec", e.target.value)
                              }
                              disabled={isSubmitting}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removePackage(pkg.id)}
                            disabled={isSubmitting || packages.length === 1}
                            className="mt-1 cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
              </div>
            </div>

            <DrawerFooter>
              <Button type="submit" disabled={isSubmitting || !name.trim()} className="cursor-pointer">
                {isSubmitting ? "Updating..." : "Update Depset"}
              </Button>
              <DrawerClose asChild>
                <Button variant="outline" disabled={isSubmitting} className="cursor-pointer">
                  Cancel
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </form>
        )}
      </DrawerContent>
    </Drawer>
  );
}
