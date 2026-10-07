"use client";

/**
 * Кнопка подтверждения + кнопка отправки формы.
 *
 * Оба компонента — маленькие клиентские «островки» (nextjs/client-use-client-boundary):
 * серверные компоненты не умеют ни useFormStatus, ни confirm().
 *
 * ConfirmButton сохраняет прежнее поведение: показывает window.confirm(confirmText)
 * и только затем вызывает исходный action. Отличия:
 *  - action вызывается как нативная submit-функция формы, а не из onClick
 *    (поэтому больше не нужен `action={fn.bind(null, id)}` — id передаётся скрытым полем);
 *  - кнопка блокируется на время отправки (защита от двойного клика → дублей тарифов);
 *  - есть focus-visible / disabled состояния.
 */

import { useEffect, useRef, useTransition } from "react";
import { useFormStatus } from "react-dom";

/** Экшены админки принимают FormData и возвращают `{ error?: string }`. */
type ActionFn = (formData: FormData) => { error?: string } | void | Promise<{ error?: string } | void>;

export function ConfirmButton({
  action,
  confirmText,
  children,
  variant = "",
  size = "sm",
  icon,
  title,
}: {
  action: ActionFn;
  confirmText: string;
  children: React.ReactNode;
  /** "" | "ad-btn-primary" | "ad-btn-danger" | "ad-btn-good" | "ad-btn-warn" | "ad-btn-ghost" */
  variant?: string;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  /** aria-label для кнопок без текста. */
  title?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const actionRef = useRef<ActionFn | null>(null);
  const [isPending, startTransition] = useTransition();

  // Держим актуальную версию экшена в ref, чтобы обработчик submit не замыкался
  // на устаревшей функции между рендерами.
  useEffect(() => {
    actionRef.current = action;
  }, [action]);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fn = actionRef.current;
    if (!fn) return;

    const data = new FormData(event.currentTarget);
    if (!window.confirm(confirmText)) return;

    startTransition(async () => {
      try {
        const result = await fn(data);
        if (result && typeof result === "object" && result.error) {
          window.alert(result.error);
        }
      } catch (error) {
        // Не глотаем ошибку — показываем её так же, как это делал бы alert в старом коде.
        window.alert(error instanceof Error ? error.message : "Не удалось выполнить действие");
      }
    });
  }

  const cls = ["ad-btn", size === "sm" ? "ad-btn-sm" : "", variant].filter(Boolean).join(" ");

  return (
    <form ref={formRef} onSubmit={handleSubmit} style={{ display: "contents" }}>
      {/* Скрытые поля (id тарифа/пользователя) добавляет родитель через children. */}
      <button type="submit" className={cls} disabled={isPending} aria-label={title} aria-busy={isPending}>
        {isPending ? <span className="ad-spin" aria-hidden /> : icon}
        {children}
      </button>
    </form>
  );
}

/**
 * Нативная submit-кнопка с индикатором загрузки (nextjs/action-pending-states).
 * Обязательна: раньше форма не показывала ни pending, ни результат.
 */
export function SubmitButton({
  children,
  variant = "",
  size = "md",
  icon,
  className = "",
}: {
  children: React.ReactNode;
  variant?: string;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();

  const cls = ["ad-btn", size === "sm" ? "ad-btn-sm" : "", variant, className].filter(Boolean).join(" ");

  return (
    <button type="submit" className={cls} disabled={pending} aria-busy={pending}>
      {pending ? <span className="ad-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
}
