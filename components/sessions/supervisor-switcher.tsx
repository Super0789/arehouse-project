"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Users2 } from "lucide-react";
import type { Supervisor } from "@/lib/types/database";

interface Props {
  supervisors: (Supervisor & { team_name: string })[];
  currentId: string | null;
}

export function SupervisorSwitcher({ supervisors, currentId }: Props) {
  const router = useRouter();
  const params = useSearchParams();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const next = new URLSearchParams(params.toString());
    if (value) next.set("supervisorId", value);
    else next.delete("supervisorId");
    router.push(`?${next.toString()}`);
  };

  return (
    <div className="flex items-center gap-2 rounded-lg border bg-background p-2">
      <Users2 className="h-4 w-4 text-muted-foreground" />
      <label htmlFor="supervisor-switch" className="text-sm font-medium">
        عرض جلسة المشرف:
      </label>
      <select
        id="supervisor-switch"
        value={currentId ?? ""}
        onChange={handleChange}
        className="min-w-[200px] rounded-md border bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <option value="">— اختر مشرفاً —</option>
        {supervisors.map((s) => (
          <option key={s.id} value={s.id}>
            {s.full_name} — {s.team_name}
          </option>
        ))}
      </select>
    </div>
  );
}