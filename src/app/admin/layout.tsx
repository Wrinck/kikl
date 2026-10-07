import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import "./ui.css";
import { IconArrowLeft, IconGauge } from "@/components/admin/icons";
import { NavLink } from "@/components/admin/nav-link";
import { ActionToast } from "@/components/admin/action-toast";
import ThemeToggleFallback from "@/components/admin/theme-toggle";

/**
 * Каркас админки: liquid-glass шапка + навигация с активным разделом.
 *
 * Совместимость с сервером сохранена:
 *  - `requireAdmin()` вызывается ровно как раньше (первая строка, тот же импорт);
 *  - если в проекте есть старый `@/components/ThemeToggle`, достаточно вернуть
 *    импорт к нему: новый переключатель использует тот же класс `.dark` на <html>.
 */
const NAV = [
  { href: "/admin", label: "Обзор", exact: true },
  { href: "/admin/plans", label: "Тарифы" },
  { href: "/admin/users", label: "Пользователи" },
  { href: "/admin/payments", label: "Платежи" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="ad-root">
      <header className="ad-header">
        <div className="ad-header-in">
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, minWidth: 0 }}>
            <Link href="/admin" className="ad-brand">
              <span className="ad-brand-mark" aria-hidden>
                <IconGauge size={18} />
              </span>
              Админ-панель
            </Link>
            <nav className="ad-nav" aria-label="Разделы админки">
              {NAV.map((item) => (
                <NavLink key={item.href} href={item.href} exact={item.exact}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="ad-header-end">
            <ThemeToggleFallback />
            <Link href="/dashboard" className="ad-back">
              <IconArrowLeft size={15} />В кабинет
            </Link>
          </div>
        </div>
      </header>

      <main className="ad-main">{children}</main>
      <ActionToast />
    </div>
  );
}
