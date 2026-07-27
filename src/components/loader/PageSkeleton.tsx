import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface PageSkeletonProps {
  variant?: "cards" | "table" | "chart";
  className?: string;
}

export default function PageSkeleton({ variant = "cards", className }: PageSkeletonProps) {
  if (variant === "table") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="card p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-6 w-1/4" />
          </div>
          <div className="space-y-3">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="grid grid-cols-6 gap-4 py-3 last:pb-0">
                <Skeleton className="h-4 col-span-2 rounded-md" />
                <Skeleton className="h-4 col-span-1 rounded-md" />
                <Skeleton className="h-4 col-span-1 rounded-md" />
                <Skeleton className="h-4 col-span-2 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (variant === "chart") {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="card p-4">
          <div className="mb-4 flex items-center justify-between gap-4">
            <Skeleton className="h-6 w-1/4" />
            <Skeleton className="h-6 w-1/5" />
          </div>
          <Skeleton className="h-72 rounded-[28px]" />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-48 rounded-[28px]" />
          <Skeleton className="h-48 rounded-[28px]" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {[...Array(3)].map((_, index) => (
        <div key={index} className="card p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Skeleton className="h-5 w-32 rounded-full" />
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="h-14 w-1/2 rounded-[18px]" />
          <div className="mt-5 flex gap-3">
            <Skeleton className="h-10 w-10 rounded-[18px]" />
            <Skeleton className="h-10 w-20 rounded-[18px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
