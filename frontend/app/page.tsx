"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "@/store/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Zap,
  Boxes,
  Code2,
  Users,
  Gauge,
  Lock,
  ArrowRight,
  Terminal,
  CheckCircle2
} from "lucide-react";

export default function Home() {
  const { user } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    // Redirect authenticated users to dashboard
    if (!user.isLoading && user.isLoggedIn) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Show spinner while checking auth or redirecting authenticated users
  if (user.isLoading || user.isLoggedIn) {
    return (
      <div className="h-[100dvh] w-full flex justify-center items-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10" />

        <div className="container relative mx-auto px-4 py-24 sm:py-32">
          <div className="mx-auto max-w-4xl text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/fnbox-transparent.png"
                alt="FnBox"
                width={500}
                height={500}
                className="w-40 h-auto sm:w-120"
              />
            </div>

            {/* Badge */}
            <Badge variant="outline" className="px-4 py-1.5 text-sm font-medium">
              <Zap className="mr-2 h-3.5 w-3.5 text-primary" />
              Self-Hosted Function as a Service
            </Badge>

            {/* Heading */}
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              Serverless Functions
              <span className="block text-primary mt-2">On Your Terms</span>
            </h1>

            {/* Description */}
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Deploy Python, Node.js, and Ruby functions to your own infrastructure.
              No vendor lock-in, no cold starts, just pure performance with Kubernetes-powered execution.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
              <Link href="/signup">
                <Button size="lg" className="min-w-[180px] h-12 text-base cursor-pointer">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="min-w-[180px] h-12 text-base cursor-pointer">
                  Sign In
                </Button>
              </Link>
            </div>

            {/* Quick stats */}
            <div className="grid grid-cols-3 gap-8 pt-12 border-t">
              <div>
                <div className="text-3xl font-bold text-primary">7</div>
                <div className="text-sm text-muted-foreground">Runtimes</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">100%</div>
                <div className="text-sm text-muted-foreground">Self-Hosted</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-primary">Fast</div>
                <div className="text-sm text-muted-foreground">Cold Starts</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Everything You Need
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Built for developers who want control without complexity
            </p>
          </div>

          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Lightning Fast</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Kubernetes-powered execution with no cold starts. Your functions are always warm and ready.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 2 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Code2 className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Multi-Runtime</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Support for Python 3.9-3.13, Node.js 20/24/25, and Ruby 3.4 with automatic resource management.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 3 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Boxes className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Dependency Management</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Create reusable dependency sets and attach them to any function. No more package management headaches.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 4 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Lock className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Secure Vault</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Encrypted secrets management with environment variable injection at runtime.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 5 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Team Collaboration</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Built-in team management with role-based access control and shared resources.
                  </p>
                </CardContent>
              </Card>

              {/* Feature 6 */}
              <Card className="border-l-2 border-l-primary hover:shadow-lg transition-shadow">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Gauge className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="text-xl font-semibold">Real-Time Monitoring</h3>
                  </div>
                  <p className="text-muted-foreground">
                    Complete visibility with execution logs, performance metrics, and detailed analytics.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Code Example Section */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-5xl">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text */}
              <div className="space-y-6">
                <Badge variant="outline" className="w-fit">
                  <Terminal className="mr-2 h-3.5 w-3.5" />
                  Simple API
                </Badge>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Deploy in Seconds
                </h2>
                <p className="text-lg text-muted-foreground">
                  Write your function code, configure dependencies, and deploy.
                  FnBox handles the infrastructure complexity.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      No Docker knowledge required
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      Automatic resource allocation
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <span className="text-muted-foreground">
                      Built-in testing interface
                    </span>
                  </li>
                </ul>
              </div>

              {/* Right: Code */}
              <Card className="border-2 border-primary/20">
                <CardContent className="p-0">
                  <div className="bg-secondary/50 px-4 py-3 border-b flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-destructive/60" />
                      <div className="h-3 w-3 rounded-full bg-yellow-500/60" />
                      <div className="h-3 w-3 rounded-full bg-primary/60" />
                    </div>
                    <span className="text-xs text-muted-foreground ml-2">handler.py</span>
                  </div>
                  <pre className="p-6 overflow-x-auto">
                    <code className="text-sm font-mono">
{`def handler(event, context):
    """Simple serverless function"""
    name = event.get('name', 'World')

    return {
        'message': f'Hello, {name}!',
        'status': 'success'
    }`}
                    </code>
                  </pre>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 sm:py-32">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-4xl">
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
              <CardContent className="p-12 text-center space-y-6">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to Get Started?
                </h2>
                <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                  Deploy your first function in minutes. No credit card required.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Link href="/signup">
                    <Button size="lg" className="min-w-[180px] h-12 text-base cursor-pointer">
                      Create Free Account
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="https://github.com/anthropics/fnbox" target="_blank">
                    <Button size="lg" variant="outline" className="min-w-[180px] h-12 text-base cursor-pointer">
                      View on GitHub
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/fnbox-transparent.png"
                alt="FnBox"
                width={100}
                height={100}
                className="w-10 h-auto"
              />
              <span className="font-semibold text-lg">FnBox</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Self-hosted serverless functions platform
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
