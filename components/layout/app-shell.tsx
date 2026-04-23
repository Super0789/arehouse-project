"use client";

import * as React from "react";
import type { UserProfile } from "@/lib/types/database";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AppShell({
  profile,
  email,
  children,
}: {
  profile: UserProfile;
  email: string;
  children: React.ReactNode;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  return (
    <div className="min-h-screen bg-muted/30">
      <Topbar
        profile={profile}
        email={email}
        onMenuToggle={() => setMobileMenuOpen((open) => !open)}
        mobileMenuOpen={mobileMenuOpen}
      />
      <div className="flex">
        <Sidebar
          role={profile.role}
          mobileOpen={mobileMenuOpen}
          onCloseMobile={() => setMobileMenuOpen(false)}
        />
        <main className="min-w-0 flex-1 p-3 pb-6 sm:p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
