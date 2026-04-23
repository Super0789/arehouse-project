import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ToastProvider } from "@/components/ui/use-toast";
import type { UserProfile } from "@/lib/types/database";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserProfile>();

  if (!profile) {
    return (
      <div className="min-h-screen bg-muted/40">
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
            <h1 className="mb-2 text-lg font-semibold">حسابك غير مفعّل</h1>
            <p className="text-sm text-muted-foreground">
              لم يتم ربط حسابك بأي ملف مستخدم. يرجى التواصل مع مسؤول النظام.
            </p>
            <form action="/api/auth/signout" method="post" className="mt-4">
              <button
                type="submit"
                className="text-sm font-medium text-primary hover:underline"
              >
                تسجيل الخروج
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <div className="min-h-screen bg-muted/30">
        <Topbar profile={profile} email={user.email ?? ""} />
        <div className="flex">
          <Sidebar role={profile.role} />
          <main className="flex-1 p-4 md:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
