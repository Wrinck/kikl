import { prisma } from "@/lib/db";
import { updatePlan, createPlan, deletePlan } from "./actions";
import ConfirmButton from "@/components/ConfirmButton";

export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Тарифы и цены</h1>

      <div className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6 space-y-5">
        {plans.map((plan) => (
          <form
            key={plan.id}
            action={updatePlan}
            className="grid grid-cols-2 md:grid-cols-6 gap-3 items-end border-b pb-5"
          >
            <input type="hidden" name="id" value={plan.id} />

            <label className="md:col-span-2 text-sm">
              Название
              <input
                name="name"
                defaultValue={plan.name}
                className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Цена, ₽
              <input
                name="price"
                type="number"
                step="1"
                defaultValue={plan.price / 100}
                className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Дней
              <input
                name="durationDays"
                type="number"
                defaultValue={plan.durationDays}
                className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2"
              />
            </label>

            <label className="text-sm">
              Трафик, ГБ (0 = ∞)
              <input
                name="trafficGb"
                type="number"
                defaultValue={plan.trafficGb}
                className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2"
              />
            </label>

            <div className="flex items-center gap-3">
              <label className="text-sm flex items-center gap-2">
                <input name="isActive" type="checkbox" defaultChecked={plan.isActive} />
                Активен
              </label>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700">
                Сохранить
              </button>
              <ConfirmButton
                action={deletePlan.bind(null, plan.id)}
                confirmText="Удалить тариф? Если он уже используется в подписках или платежах — он будет просто деактивирован."
                className="bg-red-600 text-white px-4 py-2 rounded-md text-sm hover:bg-red-700"
              >
                Удалить
              </ConfirmButton>
            </div>
          </form>
        ))}
      </div>

      <form
        action={createPlan}
        className="bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-6 grid grid-cols-2 md:grid-cols-5 gap-3 items-end"
      >
        <label className="text-sm">
          Название
          <input name="name" placeholder="3 Месяца / Безлимит" className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2" />
        </label>
        <label className="text-sm">
          Цена, ₽
          <input name="price" type="number" placeholder="499" className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2" />
        </label>
        <label className="text-sm">
          Дней
          <input name="durationDays" type="number" placeholder="90" className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2" />
        </label>
        <label className="text-sm">
          Трафик, ГБ (0 = ∞)
          <input name="trafficGb" type="number" placeholder="0" className="mt-1 w-full border dark:border-gray-700 dark:bg-gray-800 dark:text-white rounded-md px-3 py-2" />
        </label>
        <button className="bg-green-600 text-white px-4 py-2 rounded-md text-sm hover:bg-green-700">
          + Добавить тариф
        </button>
      </form>
    </div>
  );
}
