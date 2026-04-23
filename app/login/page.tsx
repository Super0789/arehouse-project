import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "تسجيل الدخول | نظام إدارة المخزون الترويجي",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-muted/40">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow">
              <span className="text-xl font-bold">PI</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">
              نظام إدارة المخزون الترويجي
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              سجّل الدخول للوصول إلى لوحة التحكم
            </p>
          </div>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            مشكلة في الدخول؟ يرجى التواصل مع مسؤول النظام.
          </p>
        </div>
      </div>
    </div>
  );
}