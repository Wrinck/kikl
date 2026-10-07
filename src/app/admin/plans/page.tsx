import { prisma } from "@/lib/db";
import { createPlan, deletePlan, updatePlan } from "./actions";
import { ActionButton, SubmitButton } from "@/components/admin/form-controls";
import { IconLayers, IconPlus, IconTrash } from "@/components/admin/icons";
import { EmptyState, Field, PageHeader, Panel, PanelHead } from "@/components/admin/ui";
import { formatMoney, formatTraffic, kopecksToRubInput } from "@/lib/format";

/**
 * Тарифы. Логика экшенов (updatePlan / createPlan / deletePlan) не тронута:
 * те же имена, те же поля формы, то же поведение «удалить или деактивировать».
 * Изменён только слой отображения + убран bind() (скрытое поле id вместо него).
 */
export default async function AdminPlansPage() {
  const plans = await prisma.plan.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="ad-stack ad-fade">
      <PageHeader title="Тарифы и цены" subtitle="Изменения сразу видны пользователям в кабинете" />

      <Panel>
        <PanelHead title="Действующие тарифы" icon={<IconLayers size={16} />} hint="Цена в рублях хранится в копейках" />

        {plans.length === 0 ? (
          <EmptyState title="Тарифов нет" text="Создайте первый тариф формой ниже." />
        ) : (
          <ul className="ad-plan-list">
            {plans.map((plan) => (
              <li key={plan.id} className="ad-plan-item">
                {/* Одна форма на тариф — как раньше; id уезжает скрытым полем. */}
                <form action={updatePlan} className="ad-form-grid">
                  <input type="hidden" name="id" value={plan.id} />

                  <Field id={`plan-name-${plan.id}`} label="Название" className="ad-span-2">
                    <input
                      id={`plan-name-${plan.id}`}
                      name="name"
                      defaultValue={plan.name}
                      maxLength={60}
                      required
                      className="ad-input"
                    />
                  </Field>

                  <Field id={`plan-price-${plan.id}`} label="Цена, ₽">
                    <input
                      id={`plan-price-${plan.id}`}
                      name="price"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={kopecksToRubInput(plan.price)}
                      required
                      className="ad-input"
                    />
                  </Field>

                  <Field id={`plan-days-${plan.id}`} label="Дней">
                    <input
                      id={`plan-days-${plan.id}`}
                      name="durationDays"
                      type="number"
                      min={1}
                      max={3650}
                      defaultValue={plan.durationDays}
                      required
                      className="ad-input"
                    />
                  </Field>

                  <Field id={`plan-traffic-${plan.id}`} label="Трафик, ГБ" hint="0 — безлимит">
                    <input
                      id={`plan-traffic-${plan.id}`}
                      name="trafficGb"
                      type="number"
                      min={0}
                      max={100000}
                      defaultValue={plan.trafficGb}
                      className="ad-input"
                    />
                  </Field>

                  <div className="ad-plan-side">
                    <label className="ad-check" htmlFor={`plan-active-${plan.id}`}>
                      <input id={`plan-active-${plan.id}`} name="isActive" type="checkbox" defaultChecked={plan.isActive} />
                      Активен
                    </label>
                    <p className="ad-cell-meta">В базе: {formatMoney(plan.price)} · {formatTraffic(plan.trafficGb)}</p>
                  </div>

                  <div className="ad-actions">
                    <SubmitButton variant="ad-btn-primary" size="sm">
                      Сохранить
                    </SubmitButton>
                  </div>
                </form>

                <ActionButton
                  action={deletePlan}
                  fieldName="planId"
                  fieldValue={plan.id}
                  confirmText="Удалить тариф? Если он уже используется в подписках или платежах — он будет просто деактивирован."
                  variant="ad-btn-danger"
                  icon={<IconTrash size={14} />}
                  label="Удалить"
                />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        <PanelHead title="Новый тариф" icon={<IconPlus size={16} />} hint="Заполните и добавьте в список" />
        <form action={createPlan} className="ad-panel-pad ad-form-grid">
          <Field id="new-plan-name" label="Название" className="ad-span-2">
            <input
              id="new-plan-name"
              name="name"
              placeholder="3 Месяца / Безлимит"
              maxLength={60}
              required
              className="ad-input"
            />
          </Field>

          <Field id="new-plan-price" label="Цена, ₽">
            <input id="new-plan-price" name="price" type="number" min={0} step="1" placeholder="499" required className="ad-input" />
          </Field>

          <Field id="new-plan-days" label="Дней">
            <input id="new-plan-days" name="durationDays" type="number" min={1} max={3650} placeholder="90" required className="ad-input" />
          </Field>

          <Field id="new-plan-traffic" label="Трафик, ГБ" hint="0 — безлимит">
            <input id="new-plan-traffic" name="trafficGb" type="number" min={0} max={100000} placeholder="0" className="ad-input" />
          </Field>

          <div className="ad-actions">
            <SubmitButton variant="ad-btn-good" icon={<IconPlus size={15} />}>
              Добавить тариф
            </SubmitButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}
