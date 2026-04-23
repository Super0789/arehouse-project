import Link from "next/link";
import { Menu } from "lucide-react";
import type { UserProfile } from "@/lib/types/database";
import { UserMenu } from "./user-menu";
import { formatDateArabic } from "@/lib/utils";

export function Topbar({
  profile,
  email,
}: {
  profile: UserProfile;
  email: string;
}) {
  return (
    <header className="sticky top-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-full items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent md:hidden"
            aria-label="القائمة"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">PI</span>
            </div>
            <span className="hidden text-sm font-semibold sm:inline">
              نظام إدارة المخزون الترويجي
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline">
            {formatDateArabic(new Date())}
          </span>
          <UserMenu profile={profile} email={email} />
        </div>
      </div>
    </header>
  );
}