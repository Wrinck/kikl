import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors">
      <header className="bg-gray-900 border-b border-gray-800 text-white sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-6">
            <Link href="/admin" className="flex items-center gap-2 font-bold">
              <img src="/comet.svg" alt="Gerlio" className="h-8 w-8" />
              Админ-панель
            </Link>
            <nav className="flex gap-5 text-sm">
              <Link href="/admin" className="text-gray-300 hover:text-white">Обзор</Link>
              <Link href="/admin/plans" className="text-gray-300 hover:text-white">Тарифы</Link>
              <Link href="/admin/users" className="text-gray-300 hover:text-white">Пользователи</Link>
              <Link href="/admin/payments" className="text-gray-300 hover:text-white">Платежи</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white">← В кабинет</Link>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
