import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
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
            <h1 className="mb-2 text-lg font-semibold">Ø­Ø³Ø§Ø¨Ùƒ ØºÙŠØ± Ù…ÙØ¹Ù‘Ù„</h1>
            <p className="text-sm text-muted-foreground">
              Ù„Ù… ÙŠØªÙ… Ø±Ø¨Ø· Ø­Ø³Ø§Ø¨Ùƒ Ø¨Ø£ÙŠ Ù…Ù„Ù Ù…Ø³ØªØ®Ø¯Ù…. ÙŠØ±Ø¬Ù‰ Ø§Ù„ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ù…Ø³Ø¤ÙˆÙ„ Ø§Ù„Ù†Ø¸Ø§Ù….
            </p>
            <form action="/api/auth/signout" method="post" className="mt-4">
              <button
                type="submit"
                className="text-sm font-medium text-primary hover:underline"
              >
                ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <AppShell profile={profile} email={user.email ?? ""}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
