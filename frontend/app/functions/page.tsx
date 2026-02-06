"use client";

import { Search, Activity, Clock, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchFunctions, type FunctionListItem } from "@/services/functions";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreateFunctionDrawer } from "@/components/functions/CreateFunctionDrawer";

export default function FunctionsPage() {
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
      <AppLayout
        breadcrumbs={[{ label: "Functions", href: "/functions" }]}
      >
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
    <AppLayout breadcrumbs={[{ label: "Functions", href: "/functions" }]}>
      <FunctionsContent />
    </AppLayout>
  );
}

function FunctionsContent() {
  const router = useRouter();
  const { selectedTeam } = useTeamContext();
  const [functions, setFunctions] = useState<FunctionListItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch functions
  const loadFunctions = async () => {
    if (!selectedTeam) return;

    setIsLoading(true);
    try {
      const data = await fetchFunctions(selectedTeam.id);
      setFunctions(data);
    } catch (error) {
      console.error("Failed to fetch functions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFunctions();
  }, [selectedTeam]);

  // Filter functions based on search
  const filteredFunctions = useMemo(() => {
    if (!searchValue) return functions;

    return functions.filter((func) => {
      const searchLower = searchValue.toLowerCase();
      return (
        func.name.toLowerCase().includes(searchLower) ||
        func.description.toLowerCase().includes(searchLower) ||
        func.slug.toLowerCase().includes(searchLower)
      );
    });
  }, [functions, searchValue]);

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "draft":
        return "secondary";
      case "inactive":
        return "outline";
      case "error":
        return "destructive";
      default:
        return "secondary";
    }
  };

  // Get runtime display name with proper formatting
  const getRuntimeLabel = (runtime: string) => {
    const runtimeLabels: Record<string, string> = {
      // Python
      python3_14: "Python 3.14",
      "python3.14": "Python 3.14",
      python3_13: "Python 3.13",
      "python3.13": "Python 3.13",
      python3_12: "Python 3.12",
      "python3.12": "Python 3.12",
      python3_11: "Python 3.11",
      "python3.11": "Python 3.11",
      python3_10: "Python 3.10",
      "python3.10": "Python 3.10",
      python3_9: "Python 3.9",
      "python3.9": "Python 3.9",
      // Node.js
      nodejs25: "Node.js 25",
      nodejs24: "Node.js 24",
      nodejs20: "Node.js 20",
      // Ruby
      ruby3_4: "Ruby 3.4",
      "ruby3.4": "Ruby 3.4",
      // Java
      java27: "Java 27",
      // .NET
      dotnet10: ".NET 10",
      dotnet9: ".NET 9",
      dotnet8: ".NET 8",
      // Bash
      bash5: "Bash 5",
      // Go
      "go1.25": "Go 1.25",
    };
    return runtimeLabels[runtime] || runtime;
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-2xl font-semibold tracking-tight">Functions</h3>
          <p className="text-xs text-muted-foreground sm:text-sm">
            Manage your serverless functions. Deploy code that runs in response
            to events without managing infrastructure.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="relative w-full max-w-56 min-w-20">
              <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search functions"
                className="pl-7"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
            </div>
            <CreateFunctionDrawer onFunctionCreated={loadFunctions} />
          </div>

          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : filteredFunctions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Zap className="size-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchValue
                    ? "No functions found matching your search"
                    : "No functions yet. Create your first function to get started."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">
                {filteredFunctions.length}{" "}
                {filteredFunctions.length === 1 ? "function" : "functions"}
              </p>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFunctions.map((func) => (
                  <Link key={func.id} href={`/functions/${func.uuid}`}>
                    <Card className="h-full transition-colors hover:bg-accent/50 cursor-pointer">
                      <CardHeader>
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-lg line-clamp-1">
                            {func.slug}
                          </CardTitle>
                          <Badge variant={getStatusVariant(func.status)}>
                            {func.status}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2">
                          {func.description || "No description"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs">
                            <code className="px-2 py-1 rounded bg-muted text-muted-foreground">
                              {getRuntimeLabel(func.runtime)}
                            </code>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Activity className="size-3" />
                              <span>{func.invocation_count} invocations</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="size-3" />
                              <span>{formatDate(func.last_invoked_at)}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
