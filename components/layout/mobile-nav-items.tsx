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

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…",
    icon: LayoutDashboard,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/sessions/today",
    label: "Ø¬Ù„Ø³Ø© Ø§Ù„ÙŠÙˆÙ…",
    icon: SunMedium,
    roles: ["admin", "supervisor"],
  },
  {
    href: "/sessions",
    label: "Ø³Ø¬Ù„ Ø§Ù„Ø¬Ù„Ø³Ø§Øª",
    icon: ClipboardList,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/stock/transfers",
    label: "ØªØ­ÙˆÙŠÙ„Ø§Øª Ø§Ù„Ù…Ø®Ø²ÙˆÙ†",
    icon: ArrowRightLeft,
    roles: ["admin"],
  },
  {
    href: "/stock/supervisors",
    label: "Ù…Ø®Ø²ÙˆÙ† Ø§Ù„Ù…Ø´Ø±ÙÙŠÙ†",
    icon: Warehouse,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/items",
    label: "Ø§Ù„Ø£ØµÙ†Ø§Ù",
    icon: Package,
    roles: ["admin", "viewer"],
  },
  {
    href: "/teams",
    label: "Ø§Ù„ÙØ±Ù‚",
    icon: UsersRound,
    roles: ["admin", "viewer"],
  },
  {
    href: "/promoters",
    label: "Ø§Ù„Ù…Ø±ÙˆÙ‘Ø¬ÙˆÙ†",
    icon: Users,
    roles: ["admin", "viewer"],
  },
  {
    href: "/reports",
    label: "Ø§Ù„ØªÙ‚Ø§Ø±ÙŠØ±",
    icon: BarChart3,
    roles: ["admin", "supervisor", "viewer"],
  },
  {
    href: "/admin/users",
    label: "Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…ÙŠÙ†",
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
          Ù†Ø¸Ø§Ù… Ø§Ù„Ù…Ø®Ø²ÙˆÙ†
        </div>
        <p>Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„Ø£ÙˆÙ„Ù‰ â€” Ø§Ù„Ø¥ØµØ¯Ø§Ø± Ø§Ù„ØªØ¬Ø±ÙŠØ¨ÙŠ</p>
      </div>
    </nav>
  );
}
