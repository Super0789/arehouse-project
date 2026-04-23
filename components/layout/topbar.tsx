import Link from "next/link";
import { Menu, X } from "lucide-react";
import type { UserProfile } from "@/lib/types/database";
import { UserMenu } from "./user-menu";
import { formatDateArabic } from "@/lib/utils";

const APP_NAME =
  "\u0646\u0638\u0627\u0645 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u062e\u0632\u0648\u0646 \u0627\u0644\u062a\u0631\u0648\u064a\u062c\u064a";
const MENU_LABEL = "\u0627\u0644\u0642\u0627\u0626\u0645\u0629";

export function Topbar({
  profile,
  email,
  onMenuToggle,
  mobileMenuOpen = false,
}: {
  profile: UserProfile;
  email: string;
  onMenuToggle?: () => void;
  mobileMenuOpen?: boolean;
}) {
  return (
    <header className="sticky top-0 z-[60] h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-full items-center justify-between px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-md hover:bg-accent active:scale-[0.98] md:hidden"
            aria-label={MENU_LABEL}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={onMenuToggle}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <span className="text-sm font-bold">PI</span>
            </div>
            <span className="hidden truncate text-sm font-semibold min-[381px]:inline">
              {APP_NAME}
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden text-xs text-muted-foreground md:inline">
            {formatDateArabic(new Date())}
          </span>
          <UserMenu profile={profile} email={email} />
        </div>
      </div>
    </header>
  );
}
