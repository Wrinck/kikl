/**
 * Единый селектор «текущей» подписки пользователя.
 *
 * Почему это нужно: страница пользователей брала `user.subscriptions[0]` без
 * сортировки, а server actions — `findFirst({ where: { userId } })` тоже без
 * orderBy. При двух подписках список и кнопки могли относиться к разным записям.
 * Теперь порядок один: сначала активная, затем самая поздняя по expiresAt.
 */

type SubLike = {
  id: number;
  status: string;
  expiresAt: Date | null;
};

const TIME = (value: Date | null): number => (value ? value.getTime() : 0);

export function pickCurrentSub<T extends SubLike>(subs: readonly T[]): T | null {
  if (!subs || subs.length === 0) return null;

  return [...subs].sort((a, b) => {
    const activeA = a.status === "ACTIVE" ? 1 : 0;
    const activeB = b.status === "ACTIVE" ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    return TIME(b.expiresAt) - TIME(a.expiresAt);
  })[0];
}
