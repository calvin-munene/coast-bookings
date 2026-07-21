import { cn } from "@/lib/utils";

export function StatusPill({ children }: { children: string }) {
  const key = children.toLowerCase();
  const tone = key.includes("confirm") || key.includes("checked") ? "success" : key.includes("await") || key.includes("pending") ? "warning" : "neutral";
  return <span className={cn("status-pill", tone)}>{children}</span>;
}
