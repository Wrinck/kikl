import { prisma } from "@/lib/db";
import { markPaid } from "../actions";
import { ActionButton } from "@/components/admin/form-controls";
import { IconCard, IconCheck } from "@/components/admin/icons";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { formatDateTime, formatMoney, isoDate } from "@/lib/format";

/**
 * Платежи. Запрос и логика выдачи подписки (markPaid) не изменены: тот же
 * `take: 100`, то же условие PENDING. Убран bind() — id платежа идёт скрытым полём.
 */
export default async function AdminPaymentsPage() {
  const payments = await prisma.payment.findMany({
    include: { user: true, plan: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="ad-stack ad-fade">
      <PageHeader
        title="Платежи"
        subtitle={`Последние ${payments.length} операций · ручная выдача только для статуса «Ожидает»`}
      />

      <Panel>
        {payments.length === 0 ? (
          <EmptyState
            icon={<IconCard size={28} />}
            title="Платежей пока нет"
            text="Оплаты из кабинета появятся здесь автоматически."
          />
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table">
              <caption className="ad-sr-only">Список платежей</caption>
              <thead>
                <tr>
                  <th scope="col">Пользователь</th>
                  <th scope="col">Тариф</th>
                  <th scope="col">Дата</th>
                  <th scope="col" className="ad-num">
                    Сумма
                  </th>
                  <th scope="col">Статус</th>
                  <th scope="col">
                    <span className="ad-sr-only">Действия</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="ad-cell-title">{p.user.email}</span>
                    </td>
                    <td className="ad-cell-meta">{p.plan.name}</td>
                    <td className="ad-cell-meta">
                      <time dateTime={isoDate(p.createdAt)}>{formatDateTime(p.createdAt)}</time>
                    </td>
                    <td className="ad-num">{formatMoney(p.amount)}</td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>
                      {p.status === "PENDING" ? (
                        <ActionButton
                          action={markPaid}
                          fieldName="paymentId"
                          fieldValue={p.id}
                          confirmText="Отметить платёж оплаченным и выдать подписку?"
                          variant="ad-btn-good"
                          icon={<IconCheck size={14} />}
                          label="Выдать подписку"
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
