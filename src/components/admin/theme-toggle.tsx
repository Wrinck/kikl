"use client";

/**
 * Переключатель светлой/тёмной темы.
 *
 * Сохраняет совместимость с сервером: класс по-прежнему ставится на <html>,
 * и имя класса — то же самое, `dark`, что использовал прежний `dark:` префикс
 * Tailwind. Поэтому ThemeToggle из старого проекта можно не трогать: если он
 * добавляет/убирает `.dark`, новая тема подхватит это автоматически.
 *
 * Если компонент отсутствует в проекте (импорт `@/components/ThemeToggle` не
 * резолвится) — layout использует эту замену; достаточно удалить старый файл.
 */

import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "@/components/admin/icons";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

function systemTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // Явный класс вместо «авто» — иначе prefers-color-scheme будет переопределять выбор.
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export default function AdminThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      /* localStorage заблокирован (приватный режим) — работаем от системной темы */
    }

    const next: Theme = stored === "light" || stored === "dark" ? stored : systemTheme();
    apply(next);
    setTheme(next);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* не критично: выбор просто не сохранится между сессиями */
    }
  }

  // До гидратации рисуем нейтральную кнопку-заглушку, чтобы не было скачка разметки.
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      className="ad-btn ad-btn-icon ad-btn-sm"
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      aria-pressed={isDark}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
    >
      {isDark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}
