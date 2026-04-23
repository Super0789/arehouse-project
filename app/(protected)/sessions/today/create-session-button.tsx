"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createTodaySession } from "./actions";

export function CreateSessionButton({ supervisorId }: { supervisorId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleClick = async () => {
    setLoading(true);
    const res = await createTodaySession(supervisorId);
    setLoading(false);
    if (res.ok) {
      toast({
        variant: "success",
        title: "تم بدء الجلسة",
        description: "يمكنك الآن إدخال كميات التوزيع.",
      });
      router.refresh();
    } else {
      toast({
        variant: "destructive",
        title: "تعذّر بدء الجلسة",
        description: res.error,
      });
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <PlayCircle className="h-4 w-4" />
      )}
      بدء جلسة اليوم
    </Button>
  );
}