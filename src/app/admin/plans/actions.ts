"use server";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function updatePlan(formData: FormData) {
  await requireAdmin();

  const id = parseInt(formData.get("id") as string);
  const priceRub = parseFloat(formData.get("price") as string);

  await prisma.plan.update({
    where: { id },
    data: {
      name: formData.get("name") as string,
      price: Math.round(priceRub * 100), // рубли -> копейки
      durationDays: parseInt(formData.get("durationDays") as string),
      trafficGb: parseInt(formData.get("trafficGb") as string) || 0,
      isActive: formData.get("isActive") === "on",
    },
  });

  revalidatePath("/admin/plans");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}

export async function createPlan(formData: FormData) {
  await requireAdmin();

  const priceRub = parseFloat(formData.get("price") as string);

  await prisma.plan.create({
    data: {
      name: formData.get("name") as string,
      price: Math.round(priceRub * 100),
      durationDays: parseInt(formData.get("durationDays") as string),
      trafficGb: parseInt(formData.get("trafficGb") as string) || 0,
      isActive: true,
    },
  });

  revalidatePath("/admin/plans");
  revalidatePath("/dashboard");
}

// Удаление тарифа.
// Если тариф уже используется в подписках/платежах — он деактивируется
// (иначе сломается история), если нет — удаляется полностью.
export async function deletePlan(planId: number) {
  await requireAdmin();

  const [subsCount, paysCount] = await Promise.all([
    prisma.subscription.count({ where: { planId } }),
    prisma.payment.count({ where: { planId } }),
  ]);

  if (subsCount > 0 || paysCount > 0) {
    await prisma.plan.update({ where: { id: planId }, data: { isActive: false } });
  } else {
    await prisma.plan.delete({ where: { id: planId } });
  }

  revalidatePath("/admin/plans");
  revalidatePath("/dashboard");
}
