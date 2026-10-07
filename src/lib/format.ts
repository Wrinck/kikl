/**
 * Единые форматтеры для админки.
 * Раньше money() была объявлена дважды (page.tsx и payments/page.tsx), а даты
 * выводились через toLocaleString без <time>. Теперь — один источник правды.
 */

const RUB_LOCALE = "ru-RU";

/** Копейки → «1 234 ₽». Деньги всегда храним в копейках (integer). */
export function formatMoney(kopecks: number | null | undefined): string {
  const value = Number.isFinite(kopecks as number) ? (kopecks as number) : 0;
  return `${(value / 100).toLocaleString(RUB_LOCALE)} ₽`;
}

/** Копейки → строка рублей для value в input[type="number"] (с копеек-точностью). */
export function kopecksToRubInput(kopecks: number | null | undefined): string {
  const value = Number.isFinite(kopecks as number) ? (kopecks as number) : 0;
  return (value / 100).toFixed(2).replace(/\.00$/, "");
}

/** Рубли (строка из формы) → целые копейки. NaN/отрицательные → null. */
export function rubInputToKopecks(raw: unknown): number | null {
  const n =
    typeof raw === "number" ? raw : parseFloat(String(raw ?? "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function formatDate(date: Date | null | undefined): string {
  return date ? date.toLocaleDateString(RUB_LOCALE) : "—";
}

export function formatDateTime(date: Date | null | undefined): string {
  return date ? date.toLocaleString(RUB_LOCALE) : "—";
}

/** ISO-строка для атрибута datetime у <time>. */
export function isoDate(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString() : undefined;
}

export function formatCount(value: number | null | undefined): string {
  return (Number.isFinite(value as number) ? (value as number) : 0).toLocaleString(RUB_LOCALE);
}

/** Трафик: 0 означает «безлимит» (см. тарифы). */
export function formatTraffic(gb: number | null | undefined): string {
  if (!gb || gb <= 0) return "∞";
  return `${gb.toLocaleString(RUB_LOCALE)} ГБ`;
}
