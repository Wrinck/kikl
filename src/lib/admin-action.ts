/**
 * Тип результата server action + мелкая утилита.
 *
 * Логика (какие поля принимает форма, что пишет в БД) не меняется — меняется
 * только способ сообщить админу о результате: вместо молчаливого `return`
 * экшен возвращает текст ошибки/уведомления, а layout показывает его тостом.
 */

/** `{ error?: string }` — undefined означает «успешно». */
export type ActionResult = { error?: string };

export const NO_RESULT: ActionResult = {};

/** Приводит любую ошибку к человекочитаемой строке. */
export function toMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Не удалось выполнить действие. Попробуйте ещё раз.";
}

/** Чтение FormData с валидацией — замена `parseInt(x as string)` без radix и NaN-проверки. */
export function formNumber(
  formData: FormData,
  name: string,
  opts: { fallback?: number; min?: number; max?: number; int?: boolean } = {},
): number | null {
  const raw = formData.get(name);
  if (raw === null || raw === "") return opts.fallback ?? null;

  const n = typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return opts.fallback ?? null;

  const value = opts.int === false ? n : Math.trunc(n);
  if (opts.min !== undefined && value < opts.min) return null;
  if (opts.max !== undefined && value > opts.max) return null;
  return value;
}

export function formString(formData: FormData, name: string, maxLen = 120): string {
  const raw = formData.get(name);
  return String(raw ?? "").trim().slice(0, maxLen);
}
