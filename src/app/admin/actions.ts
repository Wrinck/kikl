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
import { formNumber, toMessage, type ActionResult } from "@/lib/admin-action";
import { revalidatePath } from "next/cache";

/**
 * Наборы путей для перевалидации (было: один и тот же список копировался в каждом
 * экшене по 3-4 раза и легко устаревал).
 */
const SCOPES = {
  overview: ["/admin", "/dashboard"],
  users: ["/admin/users", "/dashboard"],
  payments: ["/admin/payments", "/admin", "/dashboard"],
} as const;

function revalidate(...scopes: Array<readonly string[]>) {
  const seen = new Set<string>();
  for (const scope of scopes) {
    for (const path of scope) {
      if (seen.has(path)) continue;
      seen.add(path);
      revalidatePath(path);
    }
  }
}

/**
 * Утилита «удалить с Marzban» без `catch {}`.
 * Прежнее молчаливое глотание означало: строку из БД удалили, а VPN-аккаунт
 * остался живым на сервере. Теперь ошибка возвращается вызывающему коду — он сам
 * решает, продолжать операцию или остановиться.
 */
async function removeMarzbanUser(username: string | null): Promise<string | null> {
  if (!username) return null;
  try {
    await deleteMarzbanUser(username);
    return null;
  } catch (error) {
    console.error("[admin] не удалось удалить пользователя Marzban:", username, error);
    return toMessage(error);
  }
}

/**
 * ПОЛНЫЙ СБРОС статистики: платежи + подписки + пользователи в Marzban.
 * Логика прежняя, но удаление из БД выполняется только после успешной очистки
 * Marzban и обёрнуто в транзакцию.
 */
export async function resetAllStats(): Promise<ActionResult> {
  await requireAdmin();

  const subs = await prisma.subscription.findMany({ select: { marzbanUsername: true } });
  const usernames = subs
    .map((s) => s.marzbanUsername)
    .filter((v): v is string => typeof v === "string" && v.length > 0);

  // Последовательные awaited в цикле -> пакетные батчи по 10 запросов.
  const CHUNK_SIZE = 10;
  const failures: string[] = [];

  for (let i = 0; i < usernames.length; i += CHUNK_SIZE) {
    const chunk = usernames.slice(i, i + CHUNK_SIZE);
    const results = await Promise.all(chunk.map(removeMarzbanUser));
    results.forEach((err, index) => {
      if (err) failures.push(`${chunk[index]}: ${err}`);
    });
  }

  if (failures.length > 0) {
    return {
      error:
        `Marzban не ответил для ${failures.length} аккаунтов, поэтому данные в базе сохранены. ` +
        `Проверьте доступность сервера и повторите. Первый ответ: ${failures[0]}`,
    };
  }

  // Целостность: либо удалены обе таблицы, либо ни одна.
  await prisma.$transaction([prisma.payment.deleteMany(), prisma.subscription.deleteMany()]);

  revalidate(SCOPES.overview, SCOPES.users, SCOPES.payments);
  return {};
}

/** Продлить пользователя вручную на N дней. Принимает FormData (userId, days). */
export async function extendUser(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const userId = formNumber(formData, "userId", { min: 1 });
  const days = formNumber(formData, "days", { fallback: 30, min: 1, max: 3650 });

  if (!userId) return { error: "Не указан пользователь." };
  if (!days) return { error: "Укажите срок продления: от 1 до 3650 дней." };

  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { expiresAt: "desc" },
  });
  if (!sub?.marzbanUsername) {
    return { error: "У пользователя нет подписки на VPN-сервере — продлить нечего." };
  }

  try {
    const updated = await extendMarzbanUser(sub.marzbanUsername, days);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: "ACTIVE",
        expiresAt: updated.expire ? new Date(updated.expire * 1000) : null,
        subscriptionUrl: updated.subscription_url ?? sub.subscriptionUrl,
      },
    });
  } catch (error) {
    return { error: `Продление не выполнено: ${toMessage(error)}` };
  }

  revalidate(SCOPES.users);
  return {};
}

/** Заблокировать / разблокировать. Принимает FormData (userId). */
export async function toggleBlock(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const userId = formNumber(formData, "userId", { min: 1 });
  if (!userId) return { error: "Не указан пользователь." };

  const sub = await prisma.subscription.findFirst({
    where: { userId },
    orderBy: { expiresAt: "desc" },
  });
  if (!sub?.marzbanUsername) {
    return { error: "У пользователя нет подписки на VPN-сервере — менять статус негде." };
  }

  const blocking = sub.status === "ACTIVE";

  try {
    if (blocking) {
      await disableMarzbanUser(sub.marzbanUsername);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "EXPIRED" } });
    } else {
      await enableMarzbanUser(sub.marzbanUsername);
      await prisma.subscription.update({ where: { id: sub.id }, data: { status: "ACTIVE" } });
    }
  } catch (error) {
    return {
      error: `${blocking ? "Блокировка" : "Разблокировка"} не выполнена: ${toMessage(error)}`,
    };
  }

  revalidate(SCOPES.users);
  return {};
}

/** Удалить подписку пользователя (и VPN-аккаунт на сервере). */
export async function deleteSubAdmin(userId: number): Promise<ActionResult> {
  await requireAdmin();

  const cleanUserId = Number.isInteger(userId) && userId > 0 ? userId : null;
  if (!cleanUserId) return { error: "Некорректный идентификатор пользователя." };

  const sub = await prisma.subscription.findFirst({
    where: { userId: cleanUserId },
    orderBy: { expiresAt: "desc" },
  });
  if (!sub) return { error: "Подписка не найдена — возможно, она уже удалена." };

  const marzbanError = await removeMarzbanUser(sub.marzbanUsername);
  if (marzbanError) {
    return {
      error: `VPN-аккаунт не удалён с сервера (${marzbanError}), запись в базе сохранена.`,
    };
  }

  await prisma.subscription.delete({ where: { id: sub.id } });

  revalidate(SCOPES.users);
  return {};
}

/** Отметить висящий платёж оплаченным и выдать подписку. */
export async function markPaid(paymentId: number): Promise<ActionResult> {
  await requireAdmin();

  const cleanPaymentId = Number.isInteger(paymentId) && paymentId > 0 ? paymentId : null;
  if (!cleanPaymentId) return { error: "Некорректный идентификатор платежа." };

  const payment = await prisma.payment.findUnique({ where: { id: cleanPaymentId } });
  if (!payment) return { error: "Платёж не найден." };
  if (payment.status !== "PENDING") {
    return { error: "Платёж уже обработан — выдавать подписку не нужно." };
  }

  try {
    // Помечаем оплаченным и активируем подписку; если активация упадёт, статус
    // откатим, чтобы не осталось «оплаченного» платежа без подписки.
    await prisma.payment.update({ where: { id: cleanPaymentId }, data: { status: "SUCCEEDED" } });
    await activateSubscription(payment.userId, payment.planId);
  } catch (error) {
    await prisma.payment
      .update({ where: { id: cleanPaymentId }, data: { status: "PENDING" } })
      .catch((rollbackError) =>
        console.error("[admin] откат статуса платежа не удался:", rollbackError),
      );

    return {
      error: `Подписка не выдана: ${toMessage(error)}. Статус платежа возвращён в «Ожидает».`,
    };
  }

  revalidate(SCOPES.payments);
  return {};
}
