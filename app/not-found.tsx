import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <div className="max-w-md rounded-lg border bg-card p-8 text-center shadow-sm">
        <h1 className="mb-2 text-3xl font-bold">404</h1>
        <p className="mb-4 text-muted-foreground">
          الصفحة المطلوبة غير موجودة.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          العودة إلى لوحة التحكم
        </Link>
      </div>
    </div>
  );
}