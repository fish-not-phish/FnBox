"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTeamContext } from "@/store/TeamContext";
import { useAuthContext } from "@/store/AuthContext";
import { fetchEnhancedTeamStats, EnhancedDashboardStats } from "@/services/teams";
import {
  Code2,
  Zap,
  Rocket,
  Activity,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Timer
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";

export function DashboardContent() {
  const { user } = useAuthContext();
  const { teams, selectedTeam, isLoading } = useTeamContext();
  const router = useRouter();
  const [enhancedStats, setEnhancedStats] = useState<EnhancedDashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    // Wait for teams to load
    if (isLoading) return;

    // Redirect to onboarding if no teams
    if (teams.length === 0) {
      router.push("/onboarding");
      return;
    }
  }, [teams, isLoading, router]);

  useEffect(() => {
    async function loadStats() {
      if (!selectedTeam) return;

      setStatsLoading(true);
      try {
        const data = await fetchEnhancedTeamStats(selectedTeam.slug);
        setEnhancedStats(data);
      } catch (error) {
        console.error("Failed to fetch enhanced stats:", error);
        // Set default stats on error
        setEnhancedStats({
          stats: {
            total_functions: 0,
            total_invocations: 0,
            total_deployments: 0,
            recent_invocations: 0,
          },
          invocation_trend: [],
          top_functions: [],
          runtime_distribution: [],
          recent_activity: [],
        });
      } finally {
        setStatsLoading(false);
      }
    }

    loadStats();
  }, [selectedTeam]);

  // Show spinner while loading teams
  if (isLoading || teams.length === 0 || !selectedTeam) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Spinner />
      </div>
    );
  }

  // Extract data from enhancedStats
  const stats = enhancedStats?.stats || null;
  const invocationTrendData = enhancedStats?.invocation_trend || [];
  const functionUsageData = enhancedStats?.top_functions || [];
  const runtimeDistribution = enhancedStats?.runtime_distribution || [];
  const recentActivity = enhancedStats?.recent_activity || [];

  // Calculate derived metrics
  const totalInvocations = stats?.total_invocations || 0;
  const errorCount = invocationTrendData.reduce((sum, point) => sum + point.errors, 0);
  const successCount = totalInvocations - errorCount;
  const successRate = totalInvocations > 0 ? (successCount / totalInvocations * 100) : 0;
  const errorRate = totalInvocations > 0 ? (errorCount / totalInvocations * 100) : 0;

  // Calculate average response time from recent activity
  const avgResponseTime = recentActivity.length > 0
    ? Math.round(
        recentActivity
          .filter(item => item.duration_ms !== null)
          .reduce((sum, item) => sum + (item.duration_ms || 0), 0) /
        recentActivity.filter(item => item.duration_ms !== null).length
      )
    : 0;

  // Calculate uptime based on success rate over last 24 hours
  const recentInvocations = stats?.recent_invocations || 0;
  const recentErrors = invocationTrendData.reduce((sum, point) => sum + point.errors, 0);
  const uptime = recentInvocations > 0 ? ((recentInvocations - recentErrors) / recentInvocations * 100) : 0;

  // Chart colors using theme values
  const CHART_COLORS = {
    primary: '#52a675',      // oklch(0.648 0.2 131.684) converted to hex
    chart1: '#7ed8a8',       // oklch(0.871 0.15 154.449)
    chart2: '#45c084',       // oklch(0.723 0.219 149.579)
    chart3: '#359766',       // oklch(0.627 0.194 149.214)
    chart4: '#2a7952',       // oklch(0.527 0.154 150.069)
    destructive: '#d85a4a',  // oklch(0.577 0.245 27.325)
  };

  // Map runtime names to theme colors
  const runtimeColorMap: Record<string, string> = {
    'Python': CHART_COLORS.chart1,
    'Node.js': CHART_COLORS.chart2,
    'Ruby': CHART_COLORS.chart3,
    'Other': CHART_COLORS.chart4
  };

  return (
    <div className="container max-w-7xl mx-auto px-4">
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            {selectedTeam.name} · {selectedTeam.member_count} {selectedTeam.member_count === 1 ? "member" : "members"}
          </p>
        </div>

        {statsLoading ? (
          <div className="flex justify-center items-center min-h-[200px]">
            <Spinner />
          </div>
        ) : (
          <>
            {/* Stats Cards Row 1 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Functions
                  </CardTitle>
                  <Code2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_functions || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats?.total_deployments || 0} deployed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Invocations
                  </CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_invocations?.toLocaleString() || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    All time
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Recent Activity
                  </CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.recent_invocations || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Last 24 hours
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Active Deployments
                  </CardTitle>
                  <Rocket className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats?.total_deployments || 0}</div>
                  <p className="text-xs text-muted-foreground">
                    Currently running
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Stats Cards Row 2 */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Success Rate
                  </CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{successRate.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.floor((stats?.total_invocations || 0) * successRate / 100)} successful
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Error Rate
                  </CardTitle>
                  <XCircle className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{errorRate.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground">
                    {errorCount} failed
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Avg Response Time
                  </CardTitle>
                  <Timer className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgResponseTime}ms</div>
                  <p className="text-xs text-muted-foreground">
                    Last 24 hours
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Uptime
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{uptime.toFixed(2)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Last 24 hours
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Invocation Trend Chart */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Invocation Trend</CardTitle>
                  <CardDescription>Last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={invocationTrendData}>
                      <defs>
                        <linearGradient id="colorInvocations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.chart1} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={CHART_COLORS.chart1} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorErrors" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.destructive} stopOpacity={0.8}/>
                          <stop offset="95%" stopColor={CHART_COLORS.destructive} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="hour"
                        className="text-xs"
                        tick={{ fill: '#6b7280' }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: '#6b7280' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Area
                        type="monotone"
                        dataKey="invocations"
                        stroke={CHART_COLORS.chart1}
                        fillOpacity={1}
                        fill="url(#colorInvocations)"
                        name="Invocations"
                      />
                      <Area
                        type="monotone"
                        dataKey="errors"
                        stroke={CHART_COLORS.destructive}
                        fillOpacity={1}
                        fill="url(#colorErrors)"
                        name="Errors"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Runtime Distribution Chart */}
              <Card className="col-span-1">
                <CardHeader>
                  <CardTitle>Runtime Distribution</CardTitle>
                  <CardDescription>Functions by runtime</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={runtimeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill={CHART_COLORS.chart1}
                        dataKey="value"
                      >
                        {runtimeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={runtimeColorMap[entry.name] || CHART_COLORS.chart4} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Top Functions Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top Functions</CardTitle>
                <CardDescription>Most invoked functions in the last 7 days</CardDescription>
              </CardHeader>
              <CardContent>
                {functionUsageData.length === 0 ? (
                  <div className="flex items-center justify-center h-[300px]">
                    <p className="text-sm text-muted-foreground">No function invocations in the last 7 days</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={functionUsageData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        tick={{ fill: '#6b7280' }}
                      />
                      <YAxis
                        className="text-xs"
                        tick={{ fill: '#6b7280' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '8px'
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="invocations"
                        fill={CHART_COLORS.chart1}
                        radius={[8, 8, 0, 0]}
                        name="Invocations"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>Latest function invocations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No recent activity
                    </p>
                  ) : (
                    recentActivity.slice(0, 5).map((item, i) => {
                      const isError = item.status === 'error';
                      const timeAgo = new Date(item.created_at);
                      const minutesAgo = Math.floor((Date.now() - timeAgo.getTime()) / 1000 / 60);
                      const timeDisplay = minutesAgo < 1 ? 'just now' : minutesAgo < 60 ? `${minutesAgo}m ago` : `${Math.floor(minutesAgo / 60)}h ago`;

                      return (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-lg border">
                          <div className={`h-2 w-2 rounded-full ${isError ? 'bg-destructive' : 'bg-primary'}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.function_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {isError ? 'Failed' : 'Completed'} · {timeDisplay}
                              {item.duration_ms && ` · ${item.duration_ms}ms`}
                            </p>
                          </div>
                          {isError ? (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-primary" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/functions')}>
                <CardHeader>
                  <CardTitle className="text-lg">Create Function</CardTitle>
                  <CardDescription>Deploy a new serverless function</CardDescription>
                </CardHeader>
                <CardContent>
                  <Code2 className="h-8 w-8 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/logs')}>
                <CardHeader>
                  <CardTitle className="text-lg">View Logs</CardTitle>
                  <CardDescription>Monitor function execution logs</CardDescription>
                </CardHeader>
                <CardContent>
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </CardContent>
              </Card>

              <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => router.push('/vault')}>
                <CardHeader>
                  <CardTitle className="text-lg">Manage Secrets</CardTitle>
                  <CardDescription>Configure environment variables</CardDescription>
                </CardHeader>
                <CardContent>
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
