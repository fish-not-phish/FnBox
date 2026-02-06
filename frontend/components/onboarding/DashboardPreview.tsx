"use client";

import { motion } from "framer-motion";
import { ChevronLeft, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DashboardPreviewProps {
  teamName?: string;
}

export function DashboardPreview({ teamName }: DashboardPreviewProps) {
  const displayName = teamName || "Your Team";

  return (
    <motion.div
      style={{
        transformOrigin: "-20% -10%",
      }}
      animate={{
        scale: 1.5,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 40,
      }}
      className="flex h-full w-5xl overflow-hidden rounded-xl border"
    >
      {/* Sidebar */}
      <div className="h-full flex-2/7 shrink-0 overflow-hidden bg-muted">
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="size-8 shrink-0 overflow-hidden rounded-md bg-primary" />
            <p className="truncate overflow-hidden font-semibold">{displayName}</p>
          </div>
          <ChevronLeft className="size-4" />
        </div>
        <ul className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, index) => (
            <li
              key={`sidebar-tab-${index}`}
              className="h-9 rounded-lg border bg-background/50 hover:shadow-md"
            />
          ))}
        </ul>
      </div>

      {/* Main content */}
      <div className="flex flex-5/7 shrink-0 flex-col justify-between p-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="size-9 rounded-lg border bg-muted/50" />
              <div className="h-9 w-64 rounded-lg border bg-muted/50" />
              <div className="flex items-center gap-2">
                {Array.from({ length: 2 }).map((_, index) => (
                  <div
                    key={`icon-btn-${index}`}
                    className="size-9 rounded-lg border"
                  />
                ))}
              </div>
            </div>
            <Button variant="outline" className="cursor-pointer">
              <span className="block h-5 w-20 rounded-md bg-muted/50" />
              <Plus />
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {[10, 40, 30, 60].map((width, index) => (
                    <TableHead
                      key={`th-${index}`}
                      style={{ width }}
                      className="h-9 border-r last:border-r-0"
                    />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 8 }).map((_, rowIndex) => (
                  <TableRow
                    key={`row-${rowIndex}`}
                    className="even:bg-muted/20"
                  >
                    {Array.from({ length: 4 }).map((_, colIndex) => (
                      <TableCell
                        key={`cell-${rowIndex}-${colIndex}`}
                        className="h-9 border-r last:border-r-0"
                      />
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={`icon-btn-${index}`}
              className="size-9 rounded-lg border bg-muted/50"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
