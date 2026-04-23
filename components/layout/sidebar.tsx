"use client";

import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types/database";
import { SidebarNav } from "./mobile-nav-items";

export function Sidebar({
  role,
  mobileOpen = false,
  onCloseMobile,
}: {
  role: UserRole;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px] transition-opacity md:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden="true"
        onClick={onCloseMobile}
      />

      <aside
        id="mobile-navigation"
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-[min(85vw,20rem)] border-l bg-background shadow-xl transition-transform md:hidden",
          mobileOpen ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="h-full overflow-y-auto pt-[max(3.5rem,env(safe-area-inset-top))]">
          <SidebarNav role={role} onNavigate={onCloseMobile} />
        </div>
      </aside>

      <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-60 shrink-0 border-l bg-background md:block">
        <SidebarNav role={role} />
      </aside>
    </>
  );
}
