"use server";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { rubInputToKopecks } from "@/lib/format";
import { formNumber, formString, toMessage, type ActionResult } from "@/lib/admin-action";
import { revalidatePath } from "next/cache";

/**
 * Ограничения тарифа — один источник правды для create и update.
 * Заменило `parseInt(formData.get("id") as string)`: теперь NaN, пустое имя,
 * отрицательная цена или срок в 0 дней не доходят до Prisma.
 */
const LIMITS = {
  nameLength: 60,
  priceMaxRub: 1_000_000,
  durationMaxDays: 3650,
  trafficMaxGb: 100_000,
} as const;

type PlanForm = {
  id: number | null;
  name: string;
  priceKopecks: number;
  durationDays: number;
  trafficGb: number;
  isActive: boolean;
};

/** Разбор FormData тарифа. Возвращает либо данные, либо текст ошибки. */
function parsePlan(formData: FormData): { data?: PlanForm; error?: string } {
  const name = formString(formData, "name", LIMITS.nameLength);
  if (!name) return { error: "Укажите название тарифа." };

  const priceKopecks = rubInputToKopecks(formData.get("price"));
  if (priceKopecks === null) return { error: "Цена должна быть числом от 0 ₽ без отрицательных значений." };
  if (priceKopecks > LIMITS.priceMaxRub * 100) {
    return { error: `Слишком большая цена: максимум ${LIMITS.priceMaxRub.toLocaleString("ru-RU")} ₽.` };
  }

  const durationDays = formNumber(formData, "durationDays", { min: 1, max: LIMITS.durationMaxDays });
  if (!durationDays) {
    return { error: `Срок действия — целое число от 1 до ${LIMITS.durationMaxDays} дней.` };
  }

  const rawTraffic = formData.get("trafficGb");
  const trafficGb =
    rawTraffic === null || String(rawTraffic).trim() === ""
      ? 0
      : formNumber(formData, "trafficGb", { min: 0, max: LIMITS.trafficMaxGb });
  if (trafficGb === null) {
    return { error: `Трафик — целое число от 0 до ${LIMITS.trafficMaxGb.toLocaleString("ru-RU")} ГБ (0 = безлимит).` };
  }

  return {
    data: {
      id: formNumber(formData, "id", { min: 1 }),
      name,
      priceKopecks,
      durationDays,
      trafficGb,
      isActive: formData.get("isActive") === "on",
    },
  };
}

export async function updatePlan(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parsePlan(formData);
  if (parsed.error || !parsed.data) return { error: parsed.error ?? "Не удалось прочитать форму." };

  const { id, ...fields } = parsed.data;
  if (!id) return { error: "Некорректный идентификатор тарифа." };

  try {
    await prisma.plan.update({
      where: { id },
      data: {
        name: fields.name,
        price: fields.priceKopecks, // рубли -> копейки (уже посчитаны при разборе)
        durationDays: fields.durationDays,
        trafficGb: fields.trafficGb,
        isActive: fields.isActive,
      },
    });
  } catch (error) {
    return { error: `Тариф не обновлён: ${toMessage(error)}` };
  }

  revalidatePlans();
  return {};
}

export async function createPlan(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const parsed = parsePlan(formData);
  if (parsed.error || !parsed.data) return { error: parsed.error ?? "Не удалось прочитать форму." };

  const { name, priceKopecks, durationDays, trafficGb } = parsed.data;

  try {
    await prisma.plan.create({
      data: { name, price: priceKopecks, durationDays, trafficGb, isActive: true },
    });
  } catch (error) {
    return { error: `Тариф не создан: ${toMessage(error)}` };
  }

  revalidatePlans();
  return {};
}

/**
 * Удаление тарифа.
 * Если тариф уже используется в подписках/платежах — он деактивируется
 * (иначе сломается история), если нет — удаляется полностью.
 * Проверка счётчиков и запись выполняются в одной транзакции, чтобы между ними
 * не мог вставнуть новый платёж (TOCTOU).
 */
export async function deletePlan(planId: number): Promise<ActionResult> {
  await requireAdmin();

  const id = Number.isInteger(planId) && planId > 0 ? planId : null;
  if (!id) return { error: "Некорректный идентификатор тарифа." };

  try {
    await prisma.$transaction(async (tx) => {
      const [subsCount, paysCount] = await Promise.all([
        tx.subscription.count({ where: { planId: id } }),
        tx.payment.count({ where: { planId: id } }),
      ]);

      if (subsCount > 0 || paysCount > 0) {
        await tx.plan.update({ where: { id }, data: { isActive: false } });
      } else {
        await tx.plan.delete({ where: { id } });
      }
    });
  } catch (error) {
    return { error: `Тариф не удалён: ${toMessage(error)}` };
  }

  revalidatePlans();
  return {};
}

/** Тарифы влияют на витрину дашборда и на обзор админки — перевалидируем оба. */
function revalidatePlans() {
  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
