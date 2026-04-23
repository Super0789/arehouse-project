import {
  Boxes,
  PackageCheck,
  PackageMinus,
  TrendingDown,
  TriangleAlert,
  Users2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatNumber } from "@/lib/utils";
import type { DashboardKpis } from "@/lib/queries/dashboard";

const cards = [
  {
    key: "totalDistributed" as const,
    label: "الموزّع اليوم",
    icon: PackageCheck,
    tone: "text-blue-600 bg-blue-50",
  },
  {
    key: "totalRemaining" as const,
    label: "المتبقي مع المروّجين",
    icon: PackageMinus,
    tone: "text-amber-600 bg-amber-50",
  },
  {
    key: "totalConsumption" as const,
    label: "الاستهلاك اليوم",
    icon: TrendingDown,
    tone: "text-emerald-600 bg-emerald-50",
  },
  {
    key: "activeTeams" as const,
    label: "الفرق النشطة اليوم",
    icon: Users2,
    tone: "text-indigo-600 bg-indigo-50",
  },
  {
    key: "lowStockAlerts" as const,
    label: "تنبيهات مخزون منخفض",
    icon: TriangleAlert,
    tone: "text-rose-600 bg-rose-50",
  },
];

export function KpiCards({ kpis }: { kpis: DashboardKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => {
        const Icon = c.icon;
        const value = kpis[c.key];
        return (
          <Card key={c.key}>
            <CardContent className="flex items-center gap-3 p-4">
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                  c.tone,
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {c.label}
                </p>
                <p className="text-2xl font-bold tabular-nums tracking-tight">
                  {formatNumber(value)}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function KpiCardsFallback() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-11 w-11 shrink-0 rounded-lg bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
              <div className="h-6 w-16 rounded bg-muted animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Icon re-export in case a parent page wants it with the same sizing.
export { Boxes };