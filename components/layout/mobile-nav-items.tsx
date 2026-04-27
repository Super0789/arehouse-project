"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowRightLeft,
  BarChart3,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  Package,
  Settings,
  SunMedium,
  Users,
  UsersRound,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const APP_LABEL = "\u0646\u0638\u0627\u0645 \u0627\u0644\u0645\u062e\u0632\u0648\u0646";
const APP_STAGE_LABEL =
  "\u0627\u0644\u0645\u0631\u062d\u0644\u0629 \u0627\u0644\u0623\u0648\u0644\u0649 \u2014 \u0627\u0644\u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u062a\u062c\u0631\u064a\u0628\u064a";

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "\u0644\u0648\u062d\u0629 \u0627\u0644\u062a\u062d\u0643\u0645",
    icon: LayoutDashboard,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/sessions/today",
    label: "\u062c\u0644\u0633\u0629 \u0627\u0644\u064a\u0648\u0645",
    icon: SunMedium,
    roles: ["admin", "supervisor"],
  },
  {
    href: "/sessions",
    label: "\u0633\u062c\u0644 \u0627\u0644\u062c\u0644\u0633\u0627\u062a",
    icon: ClipboardList,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/stock/warehouse",
    label: "\u0627\u0644\u0645\u062e\u0632\u0646 \u0627\u0644\u0631\u0626\u064a\u0633\u064a",
    icon: Warehouse,
    roles: ["admin", "viewer"],
  },
  {
    href: "/stock/transfers",
    label: "\u062a\u062d\u0648\u064a\u0644\u0627\u062a \u0627\u0644\u0645\u062e\u0632\u0648\u0646",
    icon: ArrowRightLeft,
    roles: ["admin"],
  },
  {
    href: "/stock/supervisors",
    label: "\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u0645\u0634\u0631\u0641\u064a\u0646",
    icon: Warehouse,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/items",
    label: "\u0627\u0644\u0623\u0635\u0646\u0627\u0641",
    icon: Package,
    roles: ["admin", "viewer"],
  },
  {
    href: "/teams",
    label: "\u0627\u0644\u0641\u0631\u0642",
    icon: UsersRound,
    roles: ["admin", "viewer"],
  },
  {
    href: "/promoters",
    label: "\u0627\u0644\u0645\u0631\u0648\u0651\u062c\u0648\u0646",
    icon: Users,
    roles: ["admin", "viewer"],
  },
  {
    href: "/reports",
    label: "\u0627\u0644\u062a\u0642\u0627\u0631\u064a\u0631",
    icon: BarChart3,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/admin/users",
    label: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u062e\u062f\u0645\u064a\u0646",
    icon: Settings,
    roles: ["admin"],
  },
];

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: UserRole;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV.filter((item) => item.roles.includes(role));

  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      {items.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}

      <div className="mt-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
          <Boxes className="h-3.5 w-3.5" />
          {APP_LABEL}
        </div>
        <p>{APP_STAGE_LABEL}</p>
      </div>
    </nav>
  );
}
