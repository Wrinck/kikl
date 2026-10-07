import { prisma } from "@/lib/db";
import { markPaid } from "../actions";
import ConfirmButton from "@/components/ConfirmButton";

function money(k: number) {
  return (k / 100).toLocaleString("ru-RU") + " ₽";
}

export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: { user: true, plan: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Платежи</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm divide-y">
        {payments.length === 0 && (
          <p className="p-5 text-sm text-gray-500 dark:text-gray-400">Платежей пока нет</p>
        )}
        {payments.map((p) => (
          <div key={p.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">{p.user.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {p.plan.name} · {p.createdAt.toLocaleString("ru-RU")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium">{money(p.amount)}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  p.status === "SUCCEEDED"
                    ? "bg-green-100 text-green-700"
                    : p.status === "PENDING"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {p.status}
              </span>
              {p.status === "PENDING" && (
                <ConfirmButton
                  action={markPaid.bind(null, p.id)}
                  confirmText="Отметить платёж оплаченным и выдать подписку?"
                  className="bg-green-600 text-white px-3 py-1 rounded-md text-sm hover:bg-green-700"
                >
                  Выдать подписку
                </ConfirmButton>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
