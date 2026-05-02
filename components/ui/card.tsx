import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-5 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
