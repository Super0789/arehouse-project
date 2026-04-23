import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ItemsTable } from "@/components/items/items-table";
import type { Item } from "@/lib/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "الأصناف | نظام إدارة المخزون الترويجي",
};

export default async function ItemsPage() {
  const profile = await getCurrentProfile();

  if (profile.role === "supervisor") {
    return (
      <div className="mx-auto max-w-2xl">
        <Alert variant="destructive">
          <AlertTitle>غير مصرّح</AlertTitle>
          <AlertDescription>
            هذه الشاشة متاحة لمدير النظام أو حساب المشاهدة فقط.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const canEdit = profile.role === "admin";
  const supabase = createClient();
  const { data } = await supabase.from("items").select("*").order("item_name");
  const items = (data ?? []) as Item[];

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">الأصناف الترويجية</h1>
        <p className="text-sm text-muted-foreground">
          إدارة كتالوج الأصناف التي يتم توزيعها على المروّجين.
        </p>
      </div>
      <ItemsTable items={items} canEdit={canEdit} />
    </div>
  );
}
