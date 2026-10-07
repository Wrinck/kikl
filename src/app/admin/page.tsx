import { prisma } from "@/lib/db";
import ConfirmButton from "@/components/ConfirmButton";
import { resetAllStats } from "./actions";

function money(kopecks: number) {
  return (kopecks / 100).toLocaleString("ru-RU") + " ₽";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    SUCCEEDED: "bg-green-100 text-green-700",
    PENDING: "bg-yellow-100 text-yellow-700",
    CANCELED: "bg-red-100 text-red-700",
  };
  return map[status] || "bg-gray-100 text-gray-700";
}

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

  const cards = [
    { label: "Выручка за всё время", value: money(allRevenue._sum.amount ?? 0) },
    { label: "Выручка за месяц", value: money(monthRevenue._sum.amount ?? 0) },
    { label: "Активные подписки", value: String(activeSubs) },
    { label: "Пользователей", value: String(usersCount) },
    { label: "Платежи в ожидании", value: String(pendingCount) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Обзор</h1>
        <ConfirmButton
          action={resetAllStats}
          confirmText="Сбросить ВСЮ статистику? Будут удалены все платежи и подписки, VPN-пользователи будут удалены с сервера."
          className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
        >
          🗑 Сбросить всю статистику
        </ConfirmButton>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
            <p className="text-xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold mb-4">⏳ Истекают в ближайшие 3 дня</h2>
          {expiring.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Нет таких подписок</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {expiring.map((s) => (
                <li key={s.id} className="flex justify-between border-b pb-2">
                  <span>{s.user.email}</span>
                  <span className="text-red-600">
                    {s.expiresAt?.toLocaleDateString("ru-RU")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6">
          <h2 className="font-semibold mb-4">💳 Последние платежи</h2>
          <ul className="space-y-2 text-sm">
            {recent.map((p) => (
              <li key={p.id} className="flex justify-between items-center border-b pb-2">
                <div>
                  <p className="font-medium">{p.user.email}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{p.plan.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium">{money(p.amount)}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusBadge(p.status)}`}>
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
