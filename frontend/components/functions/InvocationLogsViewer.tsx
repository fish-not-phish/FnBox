"use client";

import { useState, useEffect } from "react";
import { RefreshCw, ChevronDown, ChevronRight, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchInvocations, type Invocation } from "@/services/invocations";
import { toast } from "sonner";

interface InvocationLogsViewerProps {
  functionId: string;
}

export function InvocationLogsViewer({ functionId }: InvocationLogsViewerProps) {
  const [invocations, setInvocations] = useState<Invocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadInvocations = async () => {
    setIsLoading(true);
    try {
      const data = await fetchInvocations(functionId, 50);
      setInvocations(data);
    } catch (error) {
      console.error("Failed to fetch invocations:", error);
      toast.error("Failed to load invocation logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvocations();
  }, [functionId]);

  const toggleExpanded = (id: number) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="size-4 text-primary" />;
      case "error":
        return <XCircle className="size-4 text-destructive" />;
      case "running":
        return <Clock className="size-4 text-primary animate-spin" />;
      case "timeout":
        return <AlertCircle className="size-4 text-destructive" />;
      default:
        return <Clock className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      success: "default",
      error: "destructive",
      running: "secondary",
      timeout: "destructive",
      pending: "outline",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (invocations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Clock className="size-12 text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground text-center">
            No invocation logs yet. Test the function to see logs here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {invocations.length} most recent invocations
        </p>
        <Button size="sm" variant="outline" onClick={loadInvocations} className="cursor-pointer">
          <RefreshCw className="size-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {invocations.map((invocation) => {
          const isExpanded = expandedIds.has(invocation.id);

          return (
            <Card key={invocation.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                  onClick={() => toggleExpanded(invocation.id)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {isExpanded ? (
                      <ChevronDown className="size-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground flex-shrink-0" />
                    )}
                    {getStatusIcon(invocation.status)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">
                          {invocation.request_id}
                        </code>
                        {getStatusBadge(invocation.status)}
                        {invocation.duration_ms !== null && invocation.duration_ms !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {invocation.duration_ms}ms
                          </span>
                        )}
                        {invocation.memory_used_mb !== null && invocation.memory_used_mb !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {invocation.memory_used_mb}MB
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(invocation.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t p-4 space-y-4 bg-muted/30">
                    {/* Input Data */}
                    {invocation.input_data && Object.keys(invocation.input_data).length > 0 && (
                      <div>
                        <p className="text-xs font-medium mb-2">Input Data</p>
                        <pre className="text-xs bg-muted text-foreground p-3 rounded overflow-x-auto font-mono">
                          {JSON.stringify(invocation.input_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Output Data */}
                    {invocation.output_data && (
                      <div>
                        <p className="text-xs font-medium mb-2">Output Data</p>
                        <pre className="text-xs bg-muted text-foreground p-3 rounded overflow-x-auto font-mono">
                          {JSON.stringify(invocation.output_data, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Error Message */}
                    {invocation.error_message && (
                      <div>
                        <p className="text-xs font-medium mb-2 text-destructive">Error</p>
                        <pre className="text-xs bg-destructive/10 text-destructive p-3 rounded overflow-x-auto font-mono">
                          {invocation.error_message}
                        </pre>
                      </div>
                    )}

                    {/* Logs */}
                    {invocation.logs && (
                      <div>
                        <p className="text-xs font-medium mb-2">Execution Logs</p>
                        <pre className="text-xs bg-muted text-muted-foreground p-3 rounded overflow-x-auto font-mono whitespace-pre-wrap">
                          {invocation.logs}
                        </pre>
                      </div>
                    )}

                    {/* Timestamps */}
                    <div className="grid grid-cols-3 gap-4 pt-2 border-t">
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-xs font-medium">{formatDate(invocation.created_at)}</p>
                      </div>
                      {invocation.started_at && (
                        <div>
                          <p className="text-xs text-muted-foreground">Started</p>
                          <p className="text-xs font-medium">{formatDate(invocation.started_at)}</p>
                        </div>
                      )}
                      {invocation.completed_at && (
                        <div>
                          <p className="text-xs text-muted-foreground">Completed</p>
                          <p className="text-xs font-medium">{formatDate(invocation.completed_at)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
