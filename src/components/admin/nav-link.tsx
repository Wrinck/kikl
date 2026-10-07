"use client";

/**
 * Ссылка навигации с активным состоянием.
 * Раньше все четыре пункта выгляли одинаково (только hover) и админ не видел,
 * где находится. Активный пункт определяется по usePathname() + aria-current.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  /** true — совпадение только полного пути (для /admin). */
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className="ad-navlink"
      data-active={active ? "true" : "false"}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
