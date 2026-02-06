"use client";

import { FileText, Search, CheckCircle, XCircle, Clock, Timer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthContext } from "@/store/AuthContext";
import { useTeamContext } from "@/store/TeamContext";
import { fetchTeamLogs, type LogItem } from "@/services/logs";
import { AppLayout } from "@/components/layout/sidebar/AppLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";

export default function LogsPage() {
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
      <AppLayout breadcrumbs={[{ label: "Logs", href: "/logs" }]}>
        <div className="container max-w-7xl mx-auto px-4">
          <div className="space-y-6">
            <div className="space-y-4">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-96" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-10 w-56" />
              <div className="space-y-2">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={[{ label: "Logs", href: "/logs" }]}>
      <LogsContent />
    </AppLayout>
  );
}

function LogsContent() {
  const { selectedTeam } = useTeamContext();
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [searchValue, setSearchValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch logs
  const loadLogs = async () => {
    if (!selectedTeam) return;

    setIsLoading(true);
    try {
      const data = await fetchTeamLogs(selectedTeam.id);
      setLogs(data);
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [selectedTeam]);

  // Filter logs based on search
  const filteredLogs = useMemo(() => {
    if (!searchValue) return logs;

    return logs.filter((log) => {
      const searchLower = searchValue.toLowerCase();
      return (
        log.function_name.toLowerCase().includes(searchLower) ||
        log.request_id.toLowerCase().includes(searchLower) ||
        log.status.toLowerCase().includes(searchLower) ||
        log.logs.toLowerCase().includes(searchLower)
      );
    });
  }, [logs, searchValue]);

  // Format date
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Get status badge variant and icon
  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case "success":
        return "default";
      case "error":
        return "destructive";
      case "timeout":
        return "destructive";
      case "pending":
        return "secondary";
      case "running":
        return "outline";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "success":
        return <CheckCircle className="size-4" />;
      case "error":
      case "timeout":
        return <XCircle className="size-4" />;
      case "pending":
        return <Clock className="size-4" />;
      case "running":
        return <Timer className="size-4 animate-pulse" />;
      default:
        return <Clock className="size-4" />;
    }
  };

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <FileText className="size-8 text-primary" />
            <h3 className="text-2xl font-semibold tracking-tight">Logs</h3>
          </div>
          <p className="text-xs text-muted-foreground sm:text-sm">
            View execution logs and invocation history for all functions in your team.
          </p>
        </div>

        <div className="space-y-4">
          <div className="relative w-full max-w-56 min-w-20">
            <Search className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs"
              className="pl-7"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="size-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground text-center">
                  {searchValue
                    ? "No logs found matching your search"
                    : "No invocation logs yet. Deploy and test your functions to see logs here."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <p className="text-xs font-semibold text-muted-foreground">
                {filteredLogs.length} {filteredLogs.length === 1 ? "log" : "logs"}
              </p>

              <div className="space-y-2">
                {filteredLogs.map((log) => (
                  <Collapsible key={log.id}>
                    <Card className="hover:bg-accent/50 transition-colors">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              {getStatusIcon(log.status)}
                              <Link
                                href={`/functions/${log.function_uuid}`}
                                className="hover:underline"
                              >
                                <CardTitle className="text-lg">
                                  {log.function_name}
                                </CardTitle>
                              </Link>
                              <Badge variant={getStatusVariant(log.status)}>
                                {log.status}
                              </Badge>
                            </div>
                            <CardDescription className="font-mono text-xs">
                              Request ID: {log.request_id}
                            </CardDescription>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="cursor-pointer">
                              View Logs
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0 space-y-3">
                        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                          <span>Invoked {formatDate(log.created_at)}</span>
                          {log.duration_ms !== null && (
                            <>
                              <span>•</span>
                              <span>Duration: {log.duration_ms}ms</span>
                            </>
                          )}
                          {log.memory_used_mb !== null && (
                            <>
                              <span>•</span>
                              <span>Memory: {log.memory_used_mb}MB</span>
                            </>
                          )}
                        </div>

                        {log.error_message && (
                          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                            <p className="text-xs font-semibold text-destructive mb-1">
                              Error
                            </p>
                            <p className="text-xs text-destructive/90 font-mono">
                              {log.error_message}
                            </p>
                          </div>
                        )}

                        <CollapsibleContent>
                          <div className="space-y-3 mt-3">
                            {/* Input Data */}
                            {log.input_data && (
                              <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                                <p className="text-xs font-semibold text-primary mb-2">
                                  Input Data
                                </p>
                                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words text-foreground/80">
                                  {JSON.stringify(log.input_data, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Output Data */}
                            {log.output_data && (
                              <div className="bg-accent border border-border rounded-md p-3">
                                <p className="text-xs font-semibold text-accent-foreground mb-2">
                                  Output Data
                                </p>
                                <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words text-accent-foreground/80">
                                  {JSON.stringify(log.output_data, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* Execution Logs */}
                            <div className="bg-muted rounded-md p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                Execution Logs
                              </p>
                              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words">
                                {log.logs || "No logs available"}
                              </pre>
                            </div>
                          </div>
                        </CollapsibleContent>
                      </CardContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
