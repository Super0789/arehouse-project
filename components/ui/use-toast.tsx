"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "default" | "success" | "destructive";

export interface ToastOptions {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface Ctx {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = React.createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const toast = React.useCallback((opts: ToastOptions) => {
    const id = Date.now() + Math.random();
    const duration = opts.duration ?? 4000;
    setToasts((xs) => [...xs, { id, ...opts }]);
    window.setTimeout(() => {
      setToasts((xs) => xs.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const dismiss = (id: number) =>
    setToasts((xs) => xs.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex flex-col items-start gap-2 sm:left-auto sm:right-4 sm:max-w-sm">
        {toasts.map((t) => {
          const variant = t.variant ?? "default";
          const Icon =
            variant === "success"
              ? CheckCircle2
              : variant === "destructive"
                ? XCircle
                : Info;
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full items-start gap-3 rounded-lg border bg-background p-3 shadow-lg",
                variant === "success" && "border-emerald-200 bg-emerald-50",
                variant === "destructive" && "border-rose-200 bg-rose-50",
              )}
            >
              <Icon
                className={cn(
                  "mt-0.5 h-5 w-5 shrink-0",
                  variant === "success" && "text-emerald-600",
                  variant === "destructive" && "text-rose-600",
                  variant === "default" && "text-muted-foreground",
                )}
              />
              <div className="min-w-0 flex-1">
                {t.title && (
                  <p className="text-sm font-semibold">{t.title}</p>
                )}
                {t.description && (
                  <p className="text-xs text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded p-1 hover:bg-black/5"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}