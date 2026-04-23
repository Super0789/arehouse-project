"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  SunMedium,
  ClipboardList,
  Users,
  UsersRound,
  Boxes,
  BarChart3,
  Settings,
  ArrowRightLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "لوحة التحكم",
    icon: LayoutDashboard,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/sessions/today",
    label: "جلسة اليوم",
    icon: SunMedium,
    roles: ["admin", "supervisor"],
  },
  {
    href: "/sessions",
    label: "سجل الجلسات",
    icon: ClipboardList,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/stock/transfers",
    label: "تحويلات المخزون",
    icon: ArrowRightLeft,
    roles: ["admin"],
  },
  {
    href: "/stock/supervisors",
    label: "مخزون المشرفين",
    icon: Warehouse,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/items",
    label: "الأصناف",
    icon: Package,
    roles: ["admin", "viewer"],
  },
  {
    href: "/teams",
    label: "الفرق",
    icon: UsersRound,
    roles: ["admin", "viewer"],
  },
  {
    href: "/promoters",
    label: "المروّجون",
    icon: Users,
    roles: ["admin", "viewer"],
  },
  {
    href: "/reports",
    label: "التقارير",
    icon: BarChart3,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/admin/users",
    label: "إدارة المستخدمين",
    icon: Settings,
    roles: ["admin"],
  },
];

export function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = NAV.filter((i) => i.roles.includes(role));

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 border-l bg-background md:block">
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
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <div className="mt-auto rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-semibold text-foreground">
            <Boxes className="h-3.5 w-3.5" />
            نظام المخزون
          </div>
          <p>المرحلة الأولى — الإصدار التجريبي</p>
        </div>
      </nav>
    </aside>
  );
}