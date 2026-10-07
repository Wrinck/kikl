/**
 * Служебная обёртка для server actions: превращает экшен, принимающий FormData,
 * в экшен с id в сигнатуре (как было раньше) и сообщает админу результат тостом.
 *
 * Логика самого экшена не меняется — меняются только способ передать id
 * (скрытое поле формы вместо `action={fn.bind(null, id)}`) и способ показать
 * ошибку (тост вместо молчаливого `return`).
 */

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/admin-action";

type ActionFn = (formData: FormData) => ActionResult | Promise<ActionResult>;

/** Экшен для `<form action={...}>`: читает id из скрытого поля. */
export function withFormId(
  action: (id: number, formData?: FormData) => ActionResult | Promise<ActionResult>,
  paramName: string,
  redirectTo: string,
): ActionFn {
  return async (formData: FormData) => {
    const rawId = Number(formData.get(paramName));
    const result = await action(Number.isFinite(rawId) ? rawId : NaN, formData);
    finish(result, redirectTo);
  };
}

/**
 * Экшен без параметров (например, полный сброс).
 *
 * ВАЖНО: возвращает обычную функцию-обработчик, а НЕ серверный экшен. Её можно
 * вызывать только из клиентского компонента (ConfirmButton) — обёртка принимает её
 * как пропс `action`. Сам серверный экшен при этом не меняется.
 */
export function withVoidAction(action: () => ActionResult | Promise<ActionResult>, redirectTo: string): ActionFn {
  return async () => {
    finish(await action(), redirectTo);
  };
}

/** Экшен, принимающий id напрямую (markPaid / deletePlan / deleteSubAdmin). */
export function withIdAction(
  action: (id: number) => ActionResult | Promise<ActionResult>,
  paramName: string,
  redirectTo: string,
): ActionFn {
  return async (formData: FormData) => {
    const rawId = Number(formData.get(paramName));
    finish(await action(Number.isFinite(rawId) ? rawId : NaN), redirectTo);
  };
}

/**
 * Показываем результат и обновляем страницу.
 * redirect() нужен именно для того, чтобы серверные данные перечитались: без него
 * админ видел бы старый список после «Продлить»/«Оплатить».
 */
function finish(result: ActionResult | void, redirectTo: string) {
  const message = result && typeof result === "object" ? result.error : undefined;
  const url = new URL(redirectTo, "http://internal");
  if (message) {
    url.searchParams.set("msg", message);
  } else {
    url.searchParams.set("ok", "1");
  }

  // pathname + search — относительный адрес, чтобы не ломать basePath/locale.
  redirect(`${url.pathname}${url.search}`);
}
