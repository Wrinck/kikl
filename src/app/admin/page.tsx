import { prisma } from "@/lib/db";
import { VoidActionButton } from "@/components/admin/form-controls";
import { IconCard, IconClock, IconRefresh, IconTrash, IconUsers } from "@/components/admin/icons";
import {
  EmptyState,
  PageHeader,
  Panel,
  PanelHead,
  StatCard,
  StatusBadge,
} from "@/components/admin/ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { resetAllStats } from "./actions";

/**
 * Обзор: прежние запросы и прежняя логика — изменён только слой отображения.
 * Семь запросов остаются в одном Promise.all (nextjs/parallel-fetching).
 */
export default async function AdminOverviewPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const soon = new Date(Date.now() + 3 * 86400000);

  const [allRevenue, monthRevenue, activeSubs, usersCount, pendingCount, expiring, recent] =
    await Promise.all([
      prisma.payment.aggregate({ where: { status: "SUCCEEDED" }, _sum: { amount: true } }),
      prisma.payment.aggregate({
        where: { status: "SUCCEEDED", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      prisma.subscription.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.payment.count({ where: { status: "PENDING" } }),
      prisma.subscription.findMany({
        where: { status: "ACTIVE", expiresAt: { lte: soon } },
        include: { user: true },
        orderBy: { expiresAt: "asc" },
        take: 10,
      }),
      prisma.payment.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: true, plan: true },
      }),
    ]);

  return (
    <div className="ad-stack ad-fade">
      <PageHeader
        title="Обзор"
        subtitle={`${formatDate(monthStart)} — начало отчётного месяца`}
        actions={
          // Danger zone: необратимая операция отделена от контента и подтверждается текстом.
          <VoidActionButton
            action={resetAllStats}
            confirmText="Сбросить ВСЮ статистику? Будут удалены все платежи и подписки, VPN-пользователи будут удалены с сервера."
            variant="ad-btn-danger"
            size="md"
            icon={<IconTrash size={15} />}
            label="Сбросить всю статистику"
          />
        }
      />

      <div className="ad-grid-stats">
        <StatCard label="Выручка за всё время" value={formatMoney(allRevenue._sum.amount ?? 0)} />
        <StatCard label="Выручка за месяц" value={formatMoney(monthRevenue._sum.amount ?? 0)} />
        <StatCard label="Активные подписки" value={String(activeSubs)} />
        <StatCard label="Пользователей" value={String(usersCount)} />
        <StatCard label="Платежи в ожидании" value={String(pendingCount)} alert={pendingCount > 0} />
      </div>

      <div className="ad-cols-2">
        <Panel>
          <PanelHead
            title="Истекают в ближайшие 3 дня"
            icon={<IconClock size={16} />}
            hint="Активные подписки, которые скоро остановятся"
          />
          {expiring.length === 0 ? (
            <EmptyState title="Нет истекающих подписок" text="В ближайшие три дня всё спокойно." />
          ) : (
            <ul className="ad-list">
              {expiring.map((s) => (
                <li key={s.id} className="ad-list-item">
                  <span className="ad-cell-title">{s.user.email}</span>
                  <time className="ad-num" dateTime={s.expiresAt?.toISOString()}>
                    {formatDate(s.expiresAt)}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <PanelHead
            title="Последние платежи"
            icon={<IconCard size={16} />}
            hint="10 последних операций"
          />
          {recent.length === 0 ? (
            <EmptyState
              icon={<IconRefresh size={28} />}
              title="Платежей пока нет"
              text="Как только поступит первая оплата, она появится здесь."
            />
          ) : (
            <ul className="ad-list">
              {recent.map((p) => (
                <li key={p.id} className="ad-list-item">
                  <div style={{ minWidth: 0 }}>
                    <p className="ad-cell-title">{p.user.email}</p>
                    <p className="ad-cell-meta">
                      {p.plan.name} · {formatDateTime(p.createdAt)}
                    </p>
                  </div>
                  <div className="ad-actions" style={{ gap: 10 }}>
                    <span className="ad-num">{formatMoney(p.amount)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <p className="ad-note">
        <IconUsers size={16} />
        Управление подписками — в разделе «Пользователи», выдача оплат — в разделе «Платежи».
      </p>
    </div>
  );
}
