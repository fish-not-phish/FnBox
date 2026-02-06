import { cn } from "@/lib/utils";

interface BackgroundPatternProps {
  className?: string;
}

export const BackgroundPattern = ({ className }: BackgroundPatternProps) => {
  return (
    <div className={cn("fixed inset-0 z-0 pointer-events-none", className)}>
      {/* Top Fade Grid Pattern */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,_var(--muted)_1px,_transparent_1px),linear-gradient(to_bottom,_var(--muted)_1px,_transparent_1px)] bg-[length:32px_32px]"
        style={{
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 50% 0%, #000 60%, transparent 100%)",
        }}
      />
    </div>
  );
};
