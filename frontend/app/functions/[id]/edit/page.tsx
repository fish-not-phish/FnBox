"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Save, Play, Package, Lock, Settings, Clock, Rocket, StopCircle, CheckCircle, AlertCircle, Trash2 } from "lucide-react";
import { useAuthContext } from "@/store/AuthContext";
import { fetchFunctionDetail, updateFunction, testFunction, deployFunction, undeployFunction, fetchDeploymentStatus, fetchInvocations, fetchClusterLimits, deleteFunction, type FunctionDetail, type TestInvocationResult, type Invocation, type ClusterLimits } from "@/services/functions";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import Editor from "@monaco-editor/react";
import Link from "next/link";
import { ManageSecretsDrawer } from "@/components/functions/ManageSecretsDrawer";
import { ManageDepsetsDrawer } from "@/components/functions/ManageDepsetsDrawer";
import { ManageTriggersDrawer } from "@/components/functions/ManageTriggersDrawer";
import { InvocationLogsViewer } from "@/components/functions/InvocationLogsViewer";
import { FunctionLayersVisual } from "@/components/functions/FunctionLayersVisual";
import { baseUrl } from "@/constants/constants";

export default function FunctionEditPage() {
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
        { label: "Edit", href: `/functions/${id}/edit` },
      ]}
    >
      <FunctionEditorContent id={id} />
    </AppLayout>
  );
}

function FunctionEditorContent({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [func, setFunc] = useState<FunctionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Editor state
  const [code, setCode] = useState("");
  const [testData, setTestData] = useState(`{
  "message": "Hello from test!",
  "user": {
    "id": 123,
    "name": "Alice"
  },
  "items": ["apple", "banana", "orange"]
}`);
  const [activeTab, setActiveTab] = useState("code");
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestInvocationResult | null>(null);

  // Configuration state
  const [memoryMb, setMemoryMb] = useState(128);
  const [vcpuCount, setVcpuCount] = useState(1);
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [isPublic, setIsPublic] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  // Cluster limits state
  const [clusterLimits, setClusterLimits] = useState<ClusterLimits | null>(null);

  // Deployment state
  const [isDeploying, setIsDeploying] = useState(false);
  const [isUndeploying, setIsUndeploying] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete confirmation state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Check if function is deployed or in transition (and thus should be read-only)
  // For K8s deployments, check deployment_name; for legacy, check vm_id
  const isDeployed = !!((func?.status === "active" && (func?.deployment_name || func?.vm_id)) || func?.status === "deploying" || func?.status === "undeploying");

  // Fetch function details
  useEffect(() => {
    const loadFunction = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchFunctionDetail(id);
        setFunc(data);
        setCode(data.code);
        setMemoryMb(data.memory_mb);
        setVcpuCount(data.vcpu_count);
        setTimeoutSeconds(data.timeout_seconds);
        setIsPublic(data.is_public);
      } catch (err) {
        console.error("Failed to fetch function:", err);
        setError("Failed to load function");
      } finally {
        setIsLoading(false);
      }
    };

    loadFunction();
  }, [id]);

  // Fetch cluster limits
  useEffect(() => {
    const loadLimits = async () => {
      try {
        const limits = await fetchClusterLimits();
        setClusterLimits(limits);
      } catch (err) {
        console.error("Failed to fetch cluster limits:", err);
        // Fallback to default limits
        setClusterLimits({
          memory_mb: { min: 64, max: 4096 },
          vcpu_count: { min: 0.05, max: 2 },
          timeout_seconds: { min: 1, max: 3600 },
        });
      }
    };

    loadLimits();
  }, []);

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
            deployment_name: status.deployment_name,
            service_name: status.service_name,
            k8s_namespace: status.k8s_namespace,
            vm_id: status.vm_id,
            vm_ip: status.vm_ip,
            vm_status: status.vm_status,
            last_deployed_at: status.last_deployed_at,
          };
        });

        // Stop polling when deployment completes or fails
        if (status.status === "active") {
          toast.success("Function deployed successfully!");
          setIsDeploying(false);
          clearInterval(pollInterval);
        } else if (status.status === "draft") {
          toast.success("Function undeployed successfully!");
          setIsUndeploying(false);
          clearInterval(pollInterval);
        } else if (status.status === "error") {
          toast.error("Deployment failed. Check logs for details.");
          setIsDeploying(false);
          setIsUndeploying(false);
          clearInterval(pollInterval);
        }
      } catch (err) {
        console.error("Failed to fetch deployment status:", err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [func?.status, id]);

  // Get Monaco language based on runtime
  const getEditorLanguage = (runtime: string): string => {
    if (runtime.startsWith("python")) return "python";
    if (runtime.startsWith("nodejs")) return "javascript";
    if (runtime.startsWith("golang") || runtime.startsWith("go")) return "go";
    if (runtime.startsWith("dotnet")) return "csharp";
    if (runtime.startsWith("ruby")) return "ruby";
    if (runtime.startsWith("rust")) return "rust";
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

  // Handle save
  const handleSave = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateFunction(
        id,
        { code },
        user.csrfToken
      );
      setFunc(updated);
      toast.success("Function saved successfully");
    } catch (err) {
      console.error("Failed to save function:", err);
      toast.error("Failed to save function");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle test
  const handleTest = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Parse test data
      let eventData: Record<string, any> = {};
      try {
        eventData = JSON.parse(testData);
      } catch (parseErr) {
        toast.error("Invalid JSON in test data");
        setIsTesting(false);
        return;
      }

      // Trigger async test
      await testFunction(id, eventData, user.csrfToken);
      toast.info("Test started. Checking results...");

      // Poll for test results
      const startTime = Date.now();
      const maxWaitTime = 60000; // 60 seconds max
      const pollInterval = setInterval(async () => {
        try {
          const invocations = await fetchInvocations(id, 1);

          if (invocations && invocations.length > 0) {
            const latestInvocation = invocations[0];

            // Check if test completed
            if (latestInvocation.status === 'success' || latestInvocation.status === 'error') {
              clearInterval(pollInterval);

              // Convert to TestInvocationResult format
              setTestResult({
                success: latestInvocation.status === 'success',
                result: latestInvocation.output_data,
                error: latestInvocation.error_message,
                execution_time_ms: latestInvocation.duration_ms || 0,
              });

              if (latestInvocation.status === 'success') {
                toast.success(`Test completed in ${latestInvocation.duration_ms?.toFixed(2)}ms`);
              } else {
                toast.error("Test failed");
              }

              setIsTesting(false);
            }
          }

          // Timeout after max wait time
          if (Date.now() - startTime > maxWaitTime) {
            clearInterval(pollInterval);
            toast.error("Test timed out");
            setIsTesting(false);
          }
        } catch (pollErr) {
          console.error("Failed to poll test results:", pollErr);
        }
      }, 2000); // Poll every 2 seconds

    } catch (err) {
      console.error("Failed to start test:", err);
      toast.error("Failed to start test");
      setIsTesting(false);
    }
  };

  // Handle configuration save
  const handleSaveConfig = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    setIsSavingConfig(true);
    try {
      const updated = await updateFunction(
        id,
        {
          memory_mb: memoryMb,
          vcpu_count: vcpuCount,
          timeout_seconds: timeoutSeconds,
          is_public: isPublic,
        },
        user.csrfToken
      );
      setFunc(updated);
      toast.success("Configuration saved successfully");
    } catch (err) {
      console.error("Failed to save configuration:", err);
      toast.error("Failed to save configuration");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Handle deploy
  const handleDeploy = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    setIsDeploying(true);
    try {
      // Auto-save code before deploying
      toast.info("Saving code before deployment...");
      const updated = await updateFunction(
        id,
        { code },
        user.csrfToken
      );
      setFunc(updated);

      // Now deploy
      await deployFunction(id, user.csrfToken);
      toast.info("Deployment started. This may take up to 30 seconds...");
      // Update function status to deploying to trigger polling
      setFunc((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "deploying" };
      });
    } catch (err) {
      console.error("Failed to deploy function:", err);
      toast.error(err instanceof Error ? err.message : "Failed to deploy function");
      setIsDeploying(false);
    }
    // Note: isDeploying will be set to false by the polling effect when complete
  };

  // Handle undeploy
  const handleUndeploy = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    setIsUndeploying(true);
    try {
      await undeployFunction(id, user.csrfToken);
      toast.info("Undeployment started. This may take up to 30 seconds...");
      // Update function status to undeploying to trigger polling
      setFunc((prev) => {
        if (!prev) return prev;
        return { ...prev, status: "undeploying" };
      });
    } catch (err) {
      console.error("Failed to undeploy function:", err);
      toast.error(err instanceof Error ? err.message : "Failed to undeploy function");
      setIsUndeploying(false);
    }
    // Note: isUndeploying will be set to false by the polling effect when complete
  };

  // Handle delete button click
  const handleDeleteClick = () => {
    // Check if function is deployed
    if (func && func.status === 'active') {
      toast.error("Function must be undeployed before deletion");
      return;
    }

    // Open confirmation dialog
    setShowDeleteDialog(true);
    setDeleteConfirmText("");
  };

  // Handle confirmed delete
  const handleConfirmDelete = async () => {
    if (!user.csrfToken) {
      toast.error("No CSRF token available");
      return;
    }

    // Verify the confirmation text matches
    if (deleteConfirmText !== func?.slug) {
      toast.error("Confirmation text does not match");
      return;
    }

    setIsDeleting(true);
    setShowDeleteDialog(false);
    try {
      await deleteFunction(id, user.csrfToken);
      toast.success("Function deleted successfully");
      // Redirect to functions list
      router.push("/functions");
    } catch (err) {
      console.error("Failed to delete function:", err);
      toast.error(err instanceof Error ? err.message : "Failed to delete function");
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-7xl mx-auto px-4 space-y-6">
        <Skeleton className="h-10 w-32" />
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="col-span-1 lg:col-span-3">
            <Skeleton className="h-[600px] w-full" />
          </div>
          <div className="col-span-1 lg:col-span-1">
            <Skeleton className="h-[300px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !func) {
    return (
      <div className="container max-w-7xl mx-auto px-4">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">{error || "Function not found"}</p>
            <Button variant="outline" className="mt-4 cursor-pointer" onClick={() => router.push("/functions")}>
              <ArrowLeft className="size-4 mr-2" />
              Back to Functions
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-7xl mx-auto px-4 space-y-4 overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="cursor-pointer" onClick={() => router.push("/functions")}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {func.status === 'active' || func.status === 'deploying' || func.status === 'undeploying' ? (
            <Button
              variant="destructive"
              size="sm"
              className="cursor-pointer"
              disabled={isUndeploying || isDeploying || func.status === 'deploying' || func.status === 'undeploying'}
              onClick={handleUndeploy}
            >
              <StopCircle className="size-4 mr-2" />
              {isUndeploying || func.status === 'undeploying' ? "Undeploying..." : "Undeploy"}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="cursor-pointer"
              disabled={isDeploying || isUndeploying}
              onClick={handleDeploy}
            >
              <Rocket className="size-4 mr-2" />
              {isDeploying || func.status === 'deploying' ? "Deploying..." : "Deploy"}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            disabled={isSaving || isTesting || func.status !== 'active' || !func.deployment_name}
            onClick={() => {
              handleTest();
              setActiveTab("test");
            }}
            title={func.status !== 'active' || !func.deployment_name ? "Function must be deployed to test" : ""}
          >
            <Play className="size-4 mr-2" />
            {isTesting ? "Testing..." : "Test"}
          </Button>
          <Button size="sm" disabled={isSaving || isTesting || isDeployed} onClick={handleSave}>
            <Save className="size-4 mr-2" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button
            className="cursor-pointer"
            variant="outline"
            size="sm"
            disabled={isDeleting || func.status === 'active' || func.status === 'deploying' || func.status === 'undeploying'}
            onClick={handleDeleteClick}
            title={func.status === 'active' ? "Function must be undeployed before deletion" : "Delete function permanently"}
          >
            <Trash2 className="size-4 mr-2" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      {/* Deployment Status Banner */}
      {func.status === 'deploying' || func.status === 'undeploying' ? (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <Clock className="size-4 text-primary animate-spin" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {func.status === 'deploying' ? "Deploying Function..." : "Undeploying Function..."}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {func.status === 'deploying' ? "Creating Kubernetes deployment and configuring runtime" : "Removing Kubernetes resources and cleaning up"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : func.status === 'error' ? (
        <Card className="bg-destructive/5 border-destructive/20">
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="size-4 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Deployment Error
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Function deployment failed. Check logs for details or try deploying again.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : func.status === 'active' && (func.deployment_name || func.vm_id) ? (
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
                <div className="flex flex-wrap items-center gap-4 mt-1">
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
              <span className="text-secondary-foreground">⚠</span>
              <div>
                <p className="text-sm font-medium text-secondary-foreground">
                  Function Not Deployed
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Deploy the function to enable testing and invocation
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Section: Function Info */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Left: Function Name & Visual Layers (3/4) */}
        <div className="col-span-1 lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <CardTitle className="text-2xl">{func.slug}</CardTitle>
                  <Badge>{func.runtime}</Badge>
                  <Badge
                    variant={func.status === 'active' ? 'default' : 'secondary'}
                    className={
                      func.status === 'active' ? 'bg-green-600' :
                      func.status === 'deploying' || func.status === 'undeploying' ? 'bg-blue-600' :
                      func.status === 'error' ? 'bg-red-600' : ''
                    }
                  >
                    {func.status}
                  </Badge>
                </div>
                <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setActiveTab("config")}>
                  Manage Stack
                </Button>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-4">
              <FunctionLayersVisual
                depsetIds={func.depset_ids}
                functionName={func.slug}
                runtime={func.runtime}
                teamId={func.team_id}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right: Function Details (1/4) */}
        <div className="col-span-1 lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Function Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Last Modified</p>
                <p className="text-sm font-medium">{formatDate(func.updated_at)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Description</p>
                <p className="text-sm">{func.description || "No description"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Invocation URL</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block break-all">
                  {baseUrl}functions/{func.uuid}/invoke
                </code>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Team</p>
                <p className="text-sm">{func.team_name}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground mb-2">Deployment Status</p>
                {func.deployment_name && func.status === 'active' ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="size-2 bg-primary rounded-full" />
                      <Badge variant="default" className="text-xs">Deployed</Badge>
                    </div>
                    <div className="text-xs space-y-1">
                      <p className="text-muted-foreground break-all">
                        VM ID: <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">{func.deployment_name}</code>
                      </p>
                      {func.vm_ip && (
                        <p className="text-muted-foreground break-all">
                          VM IP: <code className="text-xs bg-muted px-1 py-0.5 rounded break-all">{func.vm_ip}</code>
                        </p>
                      )}
                      {func.last_deployed_at && (
                        <p className="text-muted-foreground">
                          Deployed: {formatDate(func.last_deployed_at)}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="size-2 bg-muted-foreground rounded-full" />
                    <Badge variant="secondary" className="text-xs">Not Deployed</Badge>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Section */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="border-b px-4">
            <TabsList className="h-12 w-full sm:w-auto">
              <TabsTrigger value="code">Code Editor</TabsTrigger>
              <TabsTrigger value="test">Test Invocation</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="code" className="p-0 m-0">
            {isDeployed && (
              <div className="bg-primary/5 border-b border-primary/20 p-4">
                <p className="text-sm text-foreground">
                  <strong>Function is deployed.</strong> Undeploy the function to make changes to code or settings.
                </p>
              </div>
            )}
            <div className="border-t overflow-hidden w-full">
              <Editor
                height="60vh"
                width="100%"
                language={getEditorLanguage(func.runtime)}
                value={code}
                onChange={(value) => setCode(value || "")}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: "on",
                  rulers: [],
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  readOnly: isDeployed,
                  wordWrap: "on",
                  wrappingStrategy: "advanced",
                }}
              />
            </div>
          </TabsContent>

          <TabsContent value="test" className="p-4 space-y-4">
            <div>
              <h3 className="text-sm font-medium mb-2">Test Input Data (JSON)</h3>
              <p className="text-xs text-muted-foreground mb-3">
                This JSON becomes the <code className="text-xs bg-muted px-1 rounded">event</code> parameter in your handler.
                Access values with <code className="text-xs bg-muted px-1 rounded">event.get("key")</code> or <code className="text-xs bg-muted px-1 rounded">event["key"]</code>.
              </p>
              <div className="border rounded-lg overflow-hidden w-full">
                <Editor
                  height="300px"
                  width="100%"
                  language="json"
                  value={testData}
                  onChange={(value) => setTestData(value || "{}")}
                  theme="vs-dark"
                  options={{
                    minimap: { enabled: false },
                    fontSize: 14,
                    lineNumbers: "on",
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    wordWrap: "on",
                  }}
                />
              </div>
            </div>
            <div className="border rounded-lg p-4 bg-muted/50">
              <p className="text-sm font-medium mb-2">Test Results</p>
              {!testResult ? (
                <p className="text-xs text-muted-foreground">Run a test to see results here</p>
              ) : testResult.success ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                      Success
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {testResult.execution_time_ms?.toFixed(2)}ms
                    </span>
                  </div>
                  <pre className="text-xs bg-background p-2 rounded border overflow-auto max-h-96">
                    {JSON.stringify(testResult.result, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                    Error
                  </Badge>
                  <p className="text-xs text-destructive">{testResult.error}</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="config" className="p-4 space-y-6">
            {isDeployed && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                <p className="text-sm text-foreground">
                  <strong>Function is deployed.</strong> Undeploy the function to make changes to code or settings.
                </p>
              </div>
            )}

            {/* Function Settings */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Function Settings</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure runtime parameters and behavior
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="memory">Memory</Label>
                  <Select
                    value={memoryMb.toString()}
                    onValueChange={(value) => setMemoryMb(parseInt(value))}
                    disabled={isDeployed}
                  >
                    <SelectTrigger id="memory" disabled={isDeployed}>
                      <SelectValue placeholder="Select memory" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="128">128 MB</SelectItem>
                      <SelectItem value="256">256 MB</SelectItem>
                      <SelectItem value="512">512 MB</SelectItem>
                      <SelectItem value="1024">1 GB (1024 MB)</SelectItem>
                      <SelectItem value="2048">2 GB (2048 MB)</SelectItem>
                      <SelectItem value="4096">4 GB (4096 MB)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    RAM allocated to function (max: {clusterLimits?.memory_mb.max || 4096}MB)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vcpu">vCPUs</Label>
                  <Select
                    value={vcpuCount.toString()}
                    onValueChange={(value) => setVcpuCount(parseFloat(value))}
                    disabled={isDeployed}
                  >
                    <SelectTrigger id="vcpu" disabled={isDeployed}>
                      <SelectValue placeholder="Select vCPUs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25 vCPU</SelectItem>
                      <SelectItem value="0.5">0.5 vCPU</SelectItem>
                      <SelectItem value="1">1 vCPU</SelectItem>
                      <SelectItem value="2">2 vCPUs</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Number of virtual CPUs (max: {clusterLimits?.vcpu_count.max || 2} cores)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeout">Timeout</Label>
                  <Select
                    value={timeoutSeconds.toString()}
                    onValueChange={(value) => setTimeoutSeconds(parseInt(value))}
                    disabled={isDeployed}
                  >
                    <SelectTrigger id="timeout" disabled={isDeployed}>
                      <SelectValue placeholder="Select timeout" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 seconds</SelectItem>
                      <SelectItem value="10">10 seconds</SelectItem>
                      <SelectItem value="30">30 seconds</SelectItem>
                      <SelectItem value="60">1 minute (60s)</SelectItem>
                      <SelectItem value="120">2 minutes (120s)</SelectItem>
                      <SelectItem value="300">5 minutes (300s)</SelectItem>
                      <SelectItem value="600">10 minutes (600s)</SelectItem>
                      <SelectItem value="900">15 minutes (900s)</SelectItem>
                      <SelectItem value="1800">30 minutes (1800s)</SelectItem>
                      <SelectItem value="3600">1 hour (3600s)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Maximum execution time (max: {clusterLimits?.timeout_seconds.max || 3600}s)
                  </p>
                </div>
                <div className="space-y-2 col-span-1 md:col-span-3">
                  <Label>Runtime</Label>
                  <Input
                    value={func?.runtime || ""}
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <p className="text-xs text-muted-foreground">
                    Runtime cannot be changed after creation
                  </p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="is-public"
                    checked={isPublic}
                    onCheckedChange={(checked) => setIsPublic(checked as boolean)}
                    disabled={isDeployed}
                  />
                  <div className="flex-1">
                    <Label
                      htmlFor="is-public"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Make Public
                    </Label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Allow this function to be invoked via URL without authentication.
                      Only deployed public functions can be invoked externally.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <Button
                  size="sm"
                  className="cursor-pointer"
                  onClick={handleSaveConfig}
                  disabled={isSavingConfig || isDeployed}
                >
                  <Settings className="size-4 mr-2" />
                  {isSavingConfig ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>

            <Separator />

            {/* Depsets */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Dependency Sets</h3>
                  <p className="text-xs text-muted-foreground">
                    Attach dependency sets to include packages
                    {(func.runtime.startsWith('bash') || func.runtime.startsWith('java') || func.runtime.startsWith('dotnet') || func.runtime.startsWith('go')) &&
                      ' (not supported for this runtime)'}
                  </p>
                </div>
                <ManageDepsetsDrawer
                  functionId={id}
                  currentDepsetIds={func.depset_ids}
                  functionRuntime={func.runtime}
                  disabled={isDeployed || func.runtime.startsWith('bash') || func.runtime.startsWith('java') || func.runtime.startsWith('dotnet') || func.runtime.startsWith('go')}
                  onDepsetsUpdated={async () => {
                    const data = await fetchFunctionDetail(id);
                    setFunc(data);
                  }}
                />
              </div>
              {func.depset_count === 0 ? (
                <div className="border rounded-lg p-8 text-center">
                  <Package className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No dependency sets attached</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {func.depset_count} depset{func.depset_count !== 1 ? "s" : ""} attached
                </div>
              )}
            </div>

            <Separator />

            {/* Secrets */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1 mr-4">
                  <h3 className="text-sm font-medium">Secrets</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    Inject environment variables from vault
                  </p>
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2 space-y-1">
                    <p className="font-medium">Access secrets in your code:</p>
                    {func.runtime.startsWith('python') && (
                      <code className="block">import os; api_key = os.getenv(&apos;API_KEY&apos;)</code>
                    )}
                    {func.runtime.startsWith('nodejs') && (
                      <code className="block">const apiKey = process.env.API_KEY</code>
                    )}
                    {func.runtime.startsWith('ruby') && (
                      <code className="block">api_key = ENV[&apos;API_KEY&apos;]</code>
                    )}
                    {func.runtime.startsWith('java') && (
                      <code className="block">String apiKey = System.getProperty(&apos;API_KEY&apos;);</code>
                    )}
                    {func.runtime.startsWith('dotnet') && (
                      <code className="block">var apiKey = Environment.GetEnvironmentVariable(&apos;API_KEY&apos;)</code>
                    )}
                    {func.runtime.startsWith('bash') && (
                      <code className="block">api_key=$API_KEY</code>
                    )}
                    {func.runtime.startsWith('go') && (
                      <code className="block">apiKey := os.Getenv(&apos;API_KEY&apos;)</code>
                    )}
                  </div>
                </div>
                <ManageSecretsDrawer
                  functionId={id}
                  currentSecretIds={func.secret_ids}
                  disabled={isDeployed}
                  onSecretsUpdated={async () => {
                    const data = await fetchFunctionDetail(id);
                    setFunc(data);
                  }}
                />
              </div>
              {func.secret_count === 0 ? (
                <div className="border rounded-lg p-8 text-center">
                  <Lock className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No secrets attached</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {func.secret_count} secret{func.secret_count !== 1 ? "s" : ""} attached
                </div>
              )}
            </div>

            <Separator />

            {/* Triggers */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-medium">Triggers</h3>
                  <p className="text-xs text-muted-foreground">
                    Configure scheduled and HTTP triggers
                  </p>
                </div>
                <ManageTriggersDrawer
                  functionId={id}
                  disabled={isDeployed}
                  onTriggersUpdated={async () => {
                    const data = await fetchFunctionDetail(id);
                    setFunc(data);
                  }}
                />
              </div>
              {func.trigger_count === 0 ? (
                <div className="border rounded-lg p-8 text-center">
                  <Clock className="size-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No triggers configured</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  {func.trigger_count} trigger{func.trigger_count !== 1 ? "s" : ""} configured
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="p-4">
            <InvocationLogsViewer functionId={id} />
          </TabsContent>
        </Tabs>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Function</DialogTitle>
            <DialogDescription>
              This action cannot be undone. This will permanently delete the function{" "}
              <span className="font-semibold text-foreground">{func?.slug}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-delete">
                Type <span className="font-mono font-semibold">{func?.slug}</span> to confirm
              </Label>
              <Input
                id="confirm-delete"
                placeholder={func?.slug}
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="cursor-pointer"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
            >
              Cancel
            </Button>
            <Button
              className="cursor-pointer"
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={deleteConfirmText !== func?.slug || isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete Function"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
