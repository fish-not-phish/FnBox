"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Activity,
  Zap,
  Database,
  Lock,
  Code2,
  Settings,
  Edit,
  CheckCircle,
  AlertCircle,
  Rocket,
} from "lucide-react";
import { useAuthContext } from "@/store/AuthContext";
import { fetchFunctionDetail, fetchDeploymentStatus, type FunctionDetail } from "@/services/functions";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { baseUrl } from "@/constants/constants";

export default function FunctionDetailPage() {
  const { user } = useAuthContext();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Auth check
  useEffect(() => {
    if (!user.isLoading && !user.isLoggedIn) {
      router.push("/login");
    }
  }, [user, router]);

  if (user.isLoading) {
    return (
      <AppLayout
        breadcrumbs={[
          { label: "Functions", href: "/functions" },
          { label: "Loading...", href: "#" },
        ]}
      >
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      breadcrumbs={[
        { label: "Functions", href: "/functions" },
        { label: id, href: `/functions/${id}` },
      ]}
    >
      <FunctionDetailContent id={id} />
    </AppLayout>
  );
}

function FunctionDetailContent({ id }: { id: string }) {
  const router = useRouter();
  const [func, setFunc] = useState<FunctionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch function details
  useEffect(() => {
    const loadFunction = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFunctionDetail(id);
        setFunc(data);
      } catch (err) {
        console.error("Failed to fetch function:", err);
        setError("Failed to load function details");
      } finally {
        setIsLoading(false);
      }
    };

    loadFunction();
  }, [id]);

  // Poll deployment status when deploying or undeploying
  useEffect(() => {
    if (!func || (func.status !== "deploying" && func.status !== "undeploying")) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const status = await fetchDeploymentStatus(id);

        // Update function state with new status
        setFunc((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: status.status,
            vm_id: status.vm_id,
            vm_ip: status.vm_ip,
            vm_status: status.vm_status,
            last_deployed_at: status.last_deployed_at,
          };
        });

        // Stop polling when deployment completes or fails
        if (status.status === "active" || status.status === "draft" || status.status === "error") {
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Failed to fetch deployment status:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [func?.status, id]);

  // Get status badge variant
  const getStatusVariant = (status: string) => {
    switch (status) {
      case "active":
        return "default";
      case "deploying":
      case "undeploying":
        return "secondary";
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

  // Check if function is deployed (check for both K8s and legacy VM deployments)
  const isDeployed = func?.status === "active" && (func?.deployment_name || func?.vm_id);
  const isDeploying = func?.status === "deploying";
  const isUndeploying = func?.status === "undeploying";
  const hasError = func?.status === "error";

  // Get Monaco language based on runtime
  const getEditorLanguage = (runtime: string): string => {
    if (runtime.startsWith("python")) return "python";
    if (runtime.startsWith("nodejs")) return "javascript";
    if (runtime.startsWith("go")) return "go";
    if (runtime.startsWith("dotnet")) return "csharp";
    return "python";
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !func) {
    return (
      <div className="container max-w-7xl mx-auto px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Zap className="size-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {error || "Function not found"}
            </p>
            <Button
              variant="outline"
              className="mt-4 cursor-pointer"
              onClick={() => router.push("/functions")}
            >
              <ArrowLeft className="size-4 mr-2" />
              Back to Functions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="cursor-pointer"
          onClick={() => router.push("/functions")}
        >
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
      </div>

      {/* Deployment Status Banner */}
      {isDeploying || isUndeploying ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Clock className="size-4 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {isDeploying ? "Function Deploying..." : "Function Undeploying..."}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isDeploying ? "Setting up VM and configuring runtime" : "Stopping VM and cleaning up resources"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : hasError ? (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-4 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Deployment Error
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Function deployment failed. Check logs or try deploying again from the edit page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : isDeployed ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="size-2 bg-primary rounded-full animate-pulse" />
                <CheckCircle className="size-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  Function Deployed & Running
                </p>
                <div className="flex items-center gap-4 mt-1">
                  {func.deployment_name && (
                    <p className="text-xs text-muted-foreground">
                      Deployment: <code className="bg-muted px-1.5 py-0.5 rounded">{func.deployment_name}</code>
                    </p>
                  )}
                  {func.service_name && (
                    <p className="text-xs text-muted-foreground">
                      Service: <code className="bg-muted px-1.5 py-0.5 rounded">{func.service_name}</code>
                    </p>
                  )}
                  {func.k8s_namespace && (
                    <p className="text-xs text-muted-foreground">
                      Namespace: <code className="bg-muted px-1.5 py-0.5 rounded">{func.k8s_namespace}</code>
                    </p>
                  )}
                  {/* Legacy VM fields (for backward compatibility) */}
                  {func.vm_id && (
                    <p className="text-xs text-muted-foreground">
                      VM: <code className="bg-muted px-1.5 py-0.5 rounded">{func.vm_id}</code>
                    </p>
                  )}
                  {func.last_deployed_at && (
                    <p className="text-xs text-muted-foreground">
                      Deployed: {formatDate(func.last_deployed_at)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-secondary border-border">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Rocket className="size-4 text-secondary-foreground" />
              <div>
                <p className="text-sm font-medium text-secondary-foreground">
                  Function Not Deployed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deploy this function from the edit page to enable invocation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Title and Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{func.slug}</h1>
            <Badge
              variant={getStatusVariant(func.status)}
              className={
                func.status === 'active' ? 'bg-green-600' :
                func.status === 'deploying' || func.status === 'undeploying' ? 'bg-blue-600' :
                func.status === 'error' ? 'bg-red-600' : ''
              }
            >
              {func.status}
            </Badge>
            {func.is_public && <Badge variant="outline">Public</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {func.description || "No description provided"}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Team: {func.team_name}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>Created {formatDate(func.created_at)}</span>
            <Separator orientation="vertical" className="h-4" />
            <span>by {func.created_by_username || "User removed"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => router.push(`/functions/${func.uuid}/edit`)}
          >
            <Edit className="size-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invocations</CardTitle>
            <Activity className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{func.invocation_count}</div>
            <p className="text-xs text-muted-foreground">
              Last: {formatDate(func.last_invoked_at)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory</CardTitle>
            <Zap className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{func.memory_mb} MB</div>
            <p className="text-xs text-muted-foreground">Allocated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Timeout</CardTitle>
            <Clock className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{func.timeout_seconds}s</div>
            <p className="text-xs text-muted-foreground">Maximum</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Runtime</CardTitle>
            <Code2 className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{func.runtime}</div>
            <p className="text-xs text-muted-foreground">Version</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="code" className="w-full">
        <TabsList>
          <TabsTrigger value="code">Code</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Function Code</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="border-t">
                <Editor
                  height="600px"
                  language={getEditorLanguage(func.runtime)}
                  value={func.code}
                  theme="vs-dark"
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    contextmenu: false,
                    domReadOnly: true,
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>
                Function settings and deployment information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Function Slug</p>
                    <p className="text-sm text-muted-foreground">{func.slug}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Runtime</p>
                    <p className="text-sm text-muted-foreground">{func.runtime}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-medium mb-1">UUID</p>
                    <p className="text-sm text-muted-foreground">
                      <code className="break-all">{func.uuid}</code>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Memory Limit</p>
                    <p className="text-sm text-muted-foreground">
                      {func.memory_mb} MB
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">vCPU</p>
                    <p className="text-sm text-muted-foreground">
                      {func.vcpu_count}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Timeout</p>
                    <p className="text-sm text-muted-foreground">
                      {func.timeout_seconds} seconds
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Last Deployed</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(func.last_deployed_at)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Visibility</p>
                    <p className="text-sm text-muted-foreground">
                      {func.is_public ? "Public" : "Private"}
                    </p>
                  </div>
                  {func.is_public && (
                    <div className="col-span-2">
                      <p className="text-sm font-medium mb-1">Public URL</p>
                      <p className="text-sm text-muted-foreground">
                        <code className="break-all bg-muted px-1.5 py-0.5 rounded">
                          {baseUrl}functions/{func.uuid}/invoke
                        </code>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Database className="size-4" />
                  <CardTitle>Dependency Sets</CardTitle>
                </div>
                <CardDescription>
                  Python packages available to this function
                </CardDescription>
              </CardHeader>
              <CardContent>
                {func.depset_count === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No dependency sets attached
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{func.depset_count}</Badge>
                    <span className="text-sm">
                      {func.depset_count === 1 ? "depset" : "depsets"} attached
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Lock className="size-4" />
                  <CardTitle>Secrets</CardTitle>
                </div>
                <CardDescription>
                  Environment variables injected at runtime
                </CardDescription>
              </CardHeader>
              <CardContent>
                {func.secret_count === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No secrets attached
                  </p>
                ) : (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{func.secret_count}</Badge>
                    <span className="text-sm">
                      {func.secret_count === 1 ? "secret" : "secrets"} attached
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
