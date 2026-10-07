import { prisma } from "@/lib/db";
import { deleteSubAdmin, extendUser, toggleBlock } from "../actions";
import { ActionButton, SubmitButton } from "@/components/admin/form-controls";
import { IconBan, IconTrash, IconUnlock, IconUsers } from "@/components/admin/icons";
import { EmptyState, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { formatDate, isoDate } from "@/lib/format";
import { pickCurrentSub } from "@/lib/subscription";

/**
 * Пользователи. Прежняя логика экшенов сохранена (extendUser / toggleBlock /
 * deleteSubAdmin), но:
 *  - вместо `user.subscriptions[0]` без сортировки — единый селектор текущей
 *    подписки (тот же порядок, что используют экшены: активная → самая поздняя);
 *  - deleteSubAdmin больше не вызывается через bind(): id идёт скрытым полём;
 *  - добавлены пустое состояние и pending-кнопки.
 */
export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: { subscriptions: { include: { plan: true } } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="ad-stack ad-fade">
      <PageHeader
        title="Пользователи"
        subtitle={`${users.length} аккаунтов · продление и блокировка влияют на Marzban`}
      />

      {users.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<IconUsers size={28} />}
            title="Пользователей пока нет"
            text="Регистрации из кабинета появятся в этом списке."
          />
        </Panel>
      ) : (
        <Panel>
          <ul className="ad-list">
            {users.map((user) => {
              const sub = pickCurrentSub(user.subscriptions);

              return (
                <li key={user.id} className="ad-user-row">
                  <div style={{ minWidth: 0 }}>
                    <p className="ad-cell-title">
                      {user.email}{" "}
                      {user.role === "ADMIN" && <span className="ad-tag">admin</span>}
                    </p>
                    {sub ? (
                      <p className="ad-cell-meta">
                        Тариф: {sub.plan.name} · До{" "}
                        <time dateTime={isoDate(sub.expiresAt)}>{formatDate(sub.expiresAt)}</time>
                        {sub.marzbanUsername ? (
                          <span className="ad-mono"> ({sub.marzbanUsername})</span>
                        ) : null}
                      </p>
                    ) : (
                      <p className="ad-cell-meta">Нет подписки</p>
                    )}
                  </div>

                  <div className="ad-actions">
                    {sub ? <StatusBadge status={sub.status} /> : null}

                    {sub ? (
                      <>
                        {/* Продление: форма с days + скрытым userId (поля те же, что раньше). */}
                        <form action={extendUser} className="ad-inline-form">
                          <input type="hidden" name="userId" value={user.id} />
                          {/* id подписки из строки списка — продлеваем именно её */}
                          <input type="hidden" name="subId" value={sub.id} />
                          <label className="ad-sr-only" htmlFor={`days-${user.id}`}>
                            Дней продления
                          </label>
                          <input
                            id={`days-${user.id}`}
                            name="days"
                            type="number"
                            min={1}
                            max={3650}
                            defaultValue={30}
                            className="ad-input ad-input-sm ad-input-w"
                          />
                          <SubmitButton size="sm" variant="ad-btn-primary">
                            Продлить
                          </SubmitButton>
                        </form>

                        <ActionButton
                          action={toggleBlock}
                          fieldName="userId"
                          fieldValue={user.id}
                          extraFields={{ subId: sub.id }}
                          confirmText={
                            sub.status === "ACTIVE"
                              ? "Заблокировать доступ пользователю на VPN-сервере?"
                              : "Снять блокировку и вернуть доступ?"
                          }
                          variant={sub.status === "ACTIVE" ? "ad-btn-warn" : "ad-btn-good"}
                          icon={
                            sub.status === "ACTIVE" ? <IconBan size={14} /> : <IconUnlock size={14} />
                          }
                          label={sub.status === "ACTIVE" ? "Заблокировать" : "Разблокировать"}
                        />

                        <ActionButton
                          action={deleteSubAdmin}
                          fieldName="userId"
                          fieldValue={user.id}
                          extraFields={{ subId: sub.id }}
                          confirmText="Удалить подписку пользователя? VPN-пользователь будет удалён с сервера."
                          variant="ad-btn-danger"
                          icon={<IconTrash size={14} />}
                          label="Удалить"
                        />
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
