"use client";

/**
 * Кнопка подтверждения + кнопка отправки формы.
 *
 * Оба компонента — маленькие клиентские «островки» (nextjs/client-use-client-boundary):
 * серверные компоненты не умеют ни useFormStatus, ни confirm().
 *
 * ConfirmButton сохраняет прежнее поведение: показывает window.confirm(confirmText)
 * и только затем вызывает исходный action. Отличия:
 *  - id действия передаётся скрытым полём формы вместо `fn.bind(null, id)`;
 *  - кнопка блокируется на время отправки (защита от двойного клика → дублей тарифов);
 *  - есть focus-visible / disabled состояния.
 */

import { useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

/** Экшены админки принимают FormData и возвращают `{ error?: string }`. */
type ActionFn = (formData: FormData) => { error?: string } | void | Promise<{ error?: string } | void>;

/**
 * Клиентский «островок»: показывает confirm(), блокирует кнопку на время отправки
 * и выводит ошибку экшена. Сам server action передаётся сверху пропсом `action`
 * (в серверных компонентах это разрешено), поэтому логика мутаций не меняется.
 */
export function ConfirmButton({
  action,
  confirmText,
  label,
  children,
  variant = "",
  size = "sm",
  icon,
  title,
}: {
  action: ActionFn;
  confirmText: string;
  /** Текст на кнопке. */
  label: React.ReactNode;
  /** Служебное содержимое формы: скрытые поля id и т.п. */
  children?: React.ReactNode;
  /** "" | "ad-btn-primary" | "ad-btn-danger" | "ad-btn-good" | "ad-btn-warn" | "ad-btn-ghost" */
  variant?: string;
  size?: "sm" | "md";
  icon?: React.ReactNode;
  /** aria-label / title для кнопок без текста. */
  title?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Без preventDefault форма ушла бы на GET /... и ничего бы не сделала.
    event.preventDefault();
    if (!window.confirm(confirmText)) return;

    const formData = new FormData(event.currentTarget);
    setError(null);

    startTransition(async () => {
      try {
        const result = await action(formData);
        if (result && typeof result === "object" && result.error) setError(result.error);
      } catch (err) {
        // Не глотаем ошибку: показываем её так же, как alert в прежнем коде.
        setError(err instanceof Error ? err.message : "Не удалось выполнить действие");
      }
    });
  }

  const cls = ["ad-btn", size === "sm" ? "ad-btn-sm" : "", variant].filter(Boolean).join(" ");

  return (
    <>
      <form onSubmit={handleSubmit} className="ad-inline-form">
        {/* Скрытые поля (id тарифа/пользователя) приходят от родителя в children. */}
        {children}
        <button
          type="submit"
          className={cls}
          disabled={pending}
          aria-label={title}
          aria-busy={pending}
          title={error ?? title}
        >
          {pending ? <span className="ad-spin" aria-hidden /> : icon}
          {label}
        </button>
      </form>
      {error ? (
        <p className="ad-note ad-note-error" role="alert" style={{ marginTop: 8 }}>
          {error}
        </p>
      ) : null}
    </>
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

/**
 * Обёртка для вызова server action из серверного компонента.
 *
 * Почему это нужно: `"use server"` запрещает вызывать экшен напрямую — его можно
 * только передать в форму (или в пропс клиентского компонента). Прежний код делал
 * `action={fn.bind(null, id)}`, и bind() на серверном экшене — ошибка сборки.
 * Здесь id уезжает скрытым полём формы, а обёртка живёт в "use client" острове.
 */
export function ActionButton({
  action,
  fieldName = "id",
  fieldValue,
  extraFields,
  ...rest
}: {
  action: ActionFn;
  /** Имя скрытого поля, из которого экшен читает id (planId / userId / paymentId). */
  fieldName: string;
  fieldValue: string | number;
  /** Дополнительные скрытые поля, если экшен читает их из FormData. */
  extraFields?: Record<string, string | number>;
} & Omit<React.ComponentProps<typeof ConfirmButton>, "action" | "children">) {
  return (
    <ConfirmButton {...rest} action={action}>
      <input type="hidden" name={fieldName} value={fieldValue} />
      {Object.entries(extraFields ?? {}).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </ConfirmButton>
  );
}

/**
 * Кнопка-подтверждение для экшена без параметров (например, полный сброс статистики).
 */
export function VoidActionButton({
  action,
  ...rest
}: Omit<React.ComponentProps<typeof ConfirmButton>, "action" | "children"> & {
  action: ActionFn;
}) {
  return <ConfirmButton {...rest} action={action} />;
}
