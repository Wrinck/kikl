/**
 * Базовые примитивы админки (Server Components — без 'use client').
 *
 * Раньше класс-«суп» (`bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-*`)
 * повторялся 8+ раз и рассинхронизировался между темами. Теперь геометрия и цвета
 * живут в ui.css, а здесь — только структура и семантика.
 */

import { IconInbox } from "./icons";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Panel({ className = "", ...rest }: DivProps) {
  return <div className={`ad-panel ${className}`} {...rest} />;
}

export function PanelHead({
  title,
  icon,
  hint,
  actions,
}: {
  title: React.ReactNode;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ad-panel-head">
      <div style={{ minWidth: 0 }}>
        <h2 className="ad-h2" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          {title}
        </h2>
        {hint ? <p className="ad-sub">{hint}</p> : null}
      </div>
      {actions ? <div className="ad-actions">{actions}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  alert,
}: {
  label: string;
  value: React.ReactNode;
  alert?: boolean;
}) {
  return (
    <div className={`ad-panel ad-stat${alert ? " ad-stat--alert" : ""}`}>
      <p className="ad-stat-label">{label}</p>
      <p className="ad-stat-value">{value}</p>
    </div>
  );
}

const STATUS_TONE: Record<string, string> = {
  // платежи
  SUCCEEDED: "good",
  PAID: "good",
  ACTIVE: "good",
  PENDING: "warn",
  PROCESSING: "warn",
  EXPIRED: "neutral",
  CANCELED: "bad",
  FAILED: "bad",
  BANNED: "bad",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCEEDED: "Оплачен",
  PAID: "Оплачен",
  PENDING: "Ожидает",
  PROCESSING: "Обработка",
  CANCELED: "Отменён",
  FAILED: "Ошибка",
  ACTIVE: "Активна",
  EXPIRED: "Истекла",
  BANNED: "Заблокирован",
};

/** Бейдж статуса: lookup-таблица вместо трёх ветвящихся тернарников. */
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  return (
    <span className={`ad-badge ad-badge-${tone}`}>
      {label ?? STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function EmptyState({
  title,
  text,
  action,
  icon,
}: {
  title: string;
  text?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="ad-empty">
      <span className="ad-empty-icon">{icon ?? <IconInbox size={28} />}</span>
      <p className="ad-empty-title">{title}</p>
      {text ? <p className="ad-empty-text">{text}</p> : null}
      {action ? <div className="ad-actions" style={{ marginTop: 6 }}>{action}</div> : null}
    </div>
  );
}

/** Подпись поля + контрол. Даёт стабильный id для связки label↔input. */
export function Field({
  id,
  label,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`ad-field ${className}`}>
      <label className="ad-label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} style={{ fontSize: 12, color: "var(--ink-subtle)", margin: 0 }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="ad-row">
      <div style={{ minWidth: 0 }}>
        <h1 className="ad-h1">{title}</h1>
        {subtitle ? <p className="ad-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ad-actions">{actions}</div> : null}
    </div>
  );
}
