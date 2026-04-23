"use client";

import { LogOut, User as UserIcon, ShieldCheck, Eye, Users } from "lucide-react";
import type { UserProfile, UserRole } from "@/lib/types/database";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const ROLE_AR: Record<UserRole, string> = {
  admin: "مدير النظام",
  supervisor: "مشرف",
  viewer: "مشاهد",
};

const ROLE_ICON: Record<UserRole, React.ComponentType<{ className?: string }>> =
  {
    admin: ShieldCheck,
    supervisor: Users,
    viewer: Eye,
  };

export function UserMenu({
  profile,
  email,
}: {
  profile: UserProfile;
  email: string;
}) {
  const RoleIcon = ROLE_ICON[profile.role];
  const initial = (profile.full_name || email || "?").trim().charAt(0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-full border bg-background px-2 py-1 text-sm hover:bg-accent"
          aria-label="قائمة المستخدم"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
          <span className="hidden max-w-[140px] truncate sm:inline">
            {profile.full_name}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-[220px]" align="end">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{profile.full_name}</span>
            <span dir="ltr" className="text-xs text-muted-foreground">
              {email}
            </span>
            <Badge variant="secondary" className="mt-1 w-fit gap-1">
              <RoleIcon className="h-3 w-3" />
              {ROLE_AR[profile.role]}
            </Badge>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="ms-2 h-4 w-4" />
          الملف الشخصي
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/api/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full cursor-pointer text-destructive">
              <LogOut className="ms-2 h-4 w-4" />
              تسجيل الخروج
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}