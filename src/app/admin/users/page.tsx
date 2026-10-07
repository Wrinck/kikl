import { prisma } from "@/lib/db";
import { extendUser, toggleBlock, deleteSubAdmin } from "../actions";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    include: { subscriptions: { include: { plan: true } } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Пользователи</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm divide-y">
        {users.map((user) => {
          const sub = user.subscriptions[0];
          return (
            <div key={user.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {user.email}{" "}
                  {user.role === "ADMIN" && (
                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full">admin</span>
                  )}
                </p>
                {sub ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
                    Тариф: {sub.plan.name} · Статус:{" "}
                    <span className={sub.status === "ACTIVE" ? "text-green-600" : "text-red-600"}>
                      {sub.status}
                    </span>{" "}
                    · До: {sub.expiresAt ? sub.expiresAt.toLocaleDateString("ru-RU") : "—"}
                    {sub.marzbanUsername && (
                      <span className="ml-2 font-mono text-xs text-gray-400">
                        ({sub.marzbanUsername})
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Нет подписки</p>
                )}
              </div>

              {sub && (
                <div className="flex flex-wrap items-center gap-2">
                  <form action={extendUser} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={user.id} />
                    <input
                      name="days"
                      type="number"
                      defaultValue={30}
                      className="w-20 border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-2 py-1 text-sm"
                    />
                    <button className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700">
                      Продлить
                    </button>
                  </form>

                  <form action={toggleBlock}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button className="bg-yellow-500 text-white px-3 py-1 rounded-md text-sm hover:bg-yellow-600">
                      {sub.status === "ACTIVE" ? "Заблокировать" : "Разблокировать"}
                    </button>
                  </form>

                  <ConfirmButton
                    action={deleteSubAdmin.bind(null, user.id)}
                    confirmText="Удалить подписку пользователя? VPN-пользователь будет удалён с сервера."
                    className="bg-red-600 text-white px-3 py-1 rounded-md text-sm hover:bg-red-700"
                  >
                    Удалить
                  </ConfirmButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
