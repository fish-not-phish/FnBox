"use client";

import { useEffect, useState } from "react";
import { Package, Code2, Box } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchDepsets, fetchDepsetDetail, type DepsetDetail } from "@/services/depsets";

interface FunctionLayersVisualProps {
  depsetIds: number[];
  functionName: string;
  runtime: string;
  teamId: number;
}

export function FunctionLayersVisual({
  depsetIds,
  functionName,
  runtime,
  teamId,
}: FunctionLayersVisualProps) {
  const [depsets, setDepsets] = useState<DepsetDetail[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDepsets = async () => {
      if (depsetIds.length === 0) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // First, fetch all depsets for the team to get their slugs
        const allDepsets = await fetchDepsets(teamId);

        // Filter to only the depsets we need
        const relevantDepsets = allDepsets.filter(d => depsetIds.includes(d.id));

        // Fetch detailed info for each depset
        const depsetDetailsPromises = relevantDepsets.map(async (depset) => {
          try {
            return await fetchDepsetDetail(teamId, depset.slug);
          } catch (error) {
            console.error(`Failed to fetch depset ${depset.slug}:`, error);
            return null;
          }
        });

        const depsetDetails = await Promise.all(depsetDetailsPromises);

        // Filter out any failed fetches and maintain order based on depsetIds
        const orderedDepsets = depsetIds
          .map(id => depsetDetails.find(d => d?.id === id))
          .filter((d): d is DepsetDetail => d !== null && d !== undefined);

        setDepsets(orderedDepsets);
      } catch (error) {
        console.error("Failed to load depsets:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDepsets();
  }, [depsetIds, teamId]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Box className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Runtime Stack</span>
        </div>
        <span className="text-xs text-muted-foreground font-mono">
          {depsetIds.length + 1} {depsetIds.length + 1 === 1 ? 'component' : 'components'}
        </span>
      </div>

      <div className="relative space-y-0">
        {/* Dependency Sets */}
        {depsets.length > 0 ? (
          depsets.map((depset, index) => (
            <div key={depset.id} className="relative">
              <Card className="border-l-2 border-l-primary/50 bg-gradient-to-r from-secondary/50 to-transparent hover:from-secondary transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="p-2 rounded-md bg-secondary shrink-0">
                        <Package className="size-4 text-secondary-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">{depset.name}</span>
                          <Badge variant="outline" className="text-xs font-mono shrink-0">#{depsets.length - index}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {depset.packages.length > 0 ? (
                            depset.packages.slice(0, 5).map((pkg) => (
                              <Badge key={pkg.id} variant="secondary" className="text-xs font-mono">
                                {pkg.package_name}
                              </Badge>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground">No packages</p>
                          )}
                          {depset.packages.length > 5 && (
                            <Badge variant="secondary" className="text-xs">
                              +{depset.packages.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {index < depsets.length && (
                <div className="absolute left-6 top-full w-0.5 h-2 bg-gradient-to-b from-border to-transparent" />
              )}
            </div>
          ))
        ) : depsetIds.length > 0 ? (
          <div className="relative">
            <Card className="border-l-2 border-l-primary/50 bg-gradient-to-r from-secondary/50 to-transparent">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-secondary">
                    <Package className="size-4 text-secondary-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">Loading dependencies...</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="absolute left-6 top-full w-0.5 h-2 bg-gradient-to-b from-border to-transparent" />
          </div>
        ) : (
          <div className="relative">
            <Card className="border-dashed border-2 bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 opacity-50">
                  <div className="p-2 rounded-md bg-muted">
                    <Package className="size-4 text-muted-foreground" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-muted-foreground">No dependencies attached</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click "Manage Stack" to add packages
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="absolute left-6 top-full w-0.5 h-2 bg-gradient-to-b from-border to-transparent" />
          </div>
        )}

        {/* Function (Bottom) */}
        <Card className="border-l-2 border-l-primary bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-md bg-primary/10">
                  <Code2 className="size-4 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{functionName}</span>
                    <Badge className="text-xs font-mono bg-primary text-primary-foreground">{runtime}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Function handler & application code
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded-md p-3">
        <div className="text-muted-foreground mt-0.5">ℹ</div>
        <p>
          {depsetIds.length > 0
            ? 'Dependencies are resolved top-down during runtime initialization'
            : 'Add dependency sets to include external packages in your execution environment'}
        </p>
      </div>
    </div>
  );
}
