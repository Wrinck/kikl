"use server";

import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/db";
import {
  deleteMarzbanUser,
  extendMarzbanUser,
  disableMarzbanUser,
  enableMarzbanUser,
} from "@/lib/marzban";
import { activateSubscription } from "@/lib/activate";
import { revalidatePath } from "next/cache";

// 🗑 ПОЛНЫЙ СБРОС статистики: платежи + подписки + пользователи в Marzban
export async function resetAllStats() {
  await requireAdmin();

  const subs = await prisma.subscription.findMany();
  for (const s of subs) {
    if (s.marzbanUsername) {
      try { await deleteMarzbanUser(s.marzbanUsername); } catch {}
    }
  }

  await prisma.payment.deleteMany();
  await prisma.subscription.deleteMany();

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/payments");
  revalidatePath("/dashboard");
}

// Продлить пользователя вручную на N дней
export async function extendUser(formData: FormData) {
  await requireAdmin();
  const userId = parseInt(formData.get("userId") as string);
  const days = parseInt(formData.get("days") as string) || 30;

  const sub = await prisma.subscription.findFirst({ where: { userId } });
  if (!sub?.marzbanUsername) return;

  const updated = await extendMarzbanUser(sub.marzbanUsername, days);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      status: "ACTIVE",
      expiresAt: updated.expire ? new Date(updated.expire * 1000) : null,
      subscriptionUrl: updated.subscription_url ?? sub.subscriptionUrl,
    },
  });

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
}

// Заблокировать / разблокировать
export async function toggleBlock(formData: FormData) {
  await requireAdmin();
  const userId = parseInt(formData.get("userId") as string);

  const sub = await prisma.subscription.findFirst({ where: { userId } });
  if (!sub?.marzbanUsername) return;

  if (sub.status === "ACTIVE") {
    await disableMarzbanUser(sub.marzbanUsername);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
  } else {
    await enableMarzbanUser(sub.marzbanUsername);
    await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } });
  }

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
}

// Удалить подписку пользователя
export async function deleteSubAdmin(userId: number) {
  await requireAdmin();

  const sub = await prisma.subscription.findFirst({ where: { userId } });
  if (!sub) return;

  if (sub.marzbanUsername) {
    try { await deleteMarzbanUser(sub.marzbanUsername); } catch {}
  }
  await prisma.subscription.delete({ where: { id: sub.id } });

  revalidatePath("/admin/users");
  revalidatePath("/dashboard");
}

// Отметить висящий платёж оплаченным и выдать подписку
export async function markPaid(paymentId: number) {
  await requireAdmin();

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== "PENDING") return;

  await prisma.payment.update({ where: { id: paymentId }, data: { status: "SUCCEEDED" } });
  await activateSubscription(payment.userId, payment.planId);

  revalidatePath("/admin/payments");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
}
