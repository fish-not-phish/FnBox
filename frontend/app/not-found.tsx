"use client";

import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl">
        <Card className="border-2 border-primary/20 shadow-lg">
          <CardContent className="p-12 text-center space-y-8">
            {/* Logo */}
            <div className="flex justify-center">
              <Image
                src="/fnbox-transparent.png"
                alt="FnBox"
                width={120}
                height={120}
                className="w-24 h-auto opacity-80"
              />
            </div>

            {/* 404 Number */}
            <div className="space-y-2">
              <h1 className="text-8xl sm:text-9xl font-bold text-primary/20">
                404
              </h1>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                Function Not Found
              </h2>
            </div>

            {/* Description */}
            <p className="text-lg text-muted-foreground max-w-md mx-auto">
              Looks like this endpoint doesn't exist in our serverless environment.
              The function you're looking for might have been deleted or never deployed.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link href="/">
                <Button size="lg" className="min-w-[160px] cursor-pointer">
                  <Home className="mr-2 h-4 w-4" />
                  Go Home
                </Button>
              </Link>
              <Button
                size="lg"
                variant="outline"
                className="min-w-[160px] cursor-pointer"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Go Back
              </Button>
            </div>

            {/* Helpful Links */}
            <div className="pt-8 border-t">
              <p className="text-sm text-muted-foreground mb-4">
                Need help? Try these:
              </p>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <Search className="h-4 w-4" />
                  View Dashboard
                </Link>
                <Link
                  href="https://github.com/fish-not-phish/fnbox"
                  target="_blank"
                  className="flex items-center gap-2 text-primary hover:underline"
                >
                  <HelpCircle className="h-4 w-4" />
                  Documentation
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
