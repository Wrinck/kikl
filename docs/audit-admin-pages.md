# Аудит страниц `src/app/admin` по изученным скиллам

Дата: 2026-10-08. Язык отчёта: RU (lang_chat = Ru).

Применённые инструкции:
- `.agent/skills/frontend-design-skills/` → `SKILL.md`, `product-ui-patterns.md`, `anti-patterns.md`, `code-style.md`, `accessibility.md`, `checklist.md`
- `.agent/skills/agent-skills/` → `nextjs`, `react-best-practices`, `typescript`, `tailwind`, `ui-design`, `zod`, `refactor`, `code-reviewer`

Проверяемые файлы (7, 571 строка):

| Файл | Строк | Роль |
|---|---|---|
| `src/app/admin/layout.tsx` | 33 | шапка + навигация |
| `src/app/admin/page.tsx` | 116 | обзор/метрики |
| `src/app/admin/users/page.tsx` | 82 | пользователи |
| `src/app/admin/plans/page.tsx` | 107 | тарифы (CRUD) |
| `src/app/admin/payments/page.tsx` | 60 | платежи |
| `src/app/admin/actions.ts` | 106 | server actions |
| `src/app/admin/plans/actions.ts` | 67 | server actions тарифов |

Важно: в репозитории **нет** `package.json`, `tsconfig.json`, а также файлов, на которые указывает код (`@/lib/admin`, `@/lib/db`, `@/lib/marzban`, `@/lib/activate`, `@/components/ConfirmButton`, `@/components/ThemeToggle`). Проверить сборку/tsc локально невозможно — выводы сделаны по исходникам. Это само по себе находка №0 (см. §6).

---

## 1. Вердикт

Функционально админка рабочая и логичная: все страницы — Server Components с параллельными запросами, во всех мутациях есть `requireAdmin()` и `revalidatePath()`. Но по качеству это «внутренний черновик»:

- **Безопасность:** деструктивные операции не имеют CSRF-защиты, rate-limit и подтверждения для самого опасного действия; ошибки глотаются.
- **UX:** нет ни одного состояния отправки формы, нет toast/feedback, нет пустых состояний для двух списков, нет скелетонов.
- **Дизайн-система:** примитивные Tailwind-цвета вместо токенов, инлайн-повторы утилит (utility soup), emoji вместо иконок, отсутствие active/hover/focus-visible у навигации.
- **Типизация:** `as string` + `parseInt` без radix + NaN нигде не обрабатывается.

Оценка по чек-листу `frontend-design-skills/checklist.md`: провалено 11 пунктов из 17 проверенных (ещё 4 ⚠️) (см. §5).

---

## 2. Критично (безопасность / корректность данных)

### 2.1. Деструктивные server actions без CSRF-токена и ограничения
`actions.ts:17 resetAllStats`, `deleteSubAdmin`, `toggleBlock`, `markPaid`; `plans/actions.ts updatePlan/createPlan/deletePlan`.

Все они принимают только `FormData`/скаляр и выполняют запись. В Next.js App Router action вызывается POST-запросом с любого стороннего сайта (form submission), если нет проверки origin/токена. `resetAllStats` удаляет **все** платежи и подписки и снимает VPN-юзеров с Marzban — это полная потеря бизнес-данных одним кликом.

`code-reviewer` (Security Code Review: OWASP, CSRF) + `nextjs/action-server-action-forms`.

Минимальное исправление:
```ts
// lib/admin.ts — добавить проверку origin + токен сессии
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL!;

export async function requireAdmin(formData?: FormData) {
  if (formData) {
    const origin = formData.get("__origin"); // скрытое поле со window.location.origin
    if (origin !== ORIGIN) throw new Error("Bad origin");
  }
  const session = await auth();
  if (session?.user?.role !== "ADMIN") throw new Error("Forbidden"); // not return null
}
```
Плюс: `middleware.ts` с защитой `/admin/*` (сейчас его нет в дереве), rate-limit на `resetAllStats`, и отдельный «danger zone» с вводом слова `RESET` вместо одной кнопки.

### 2.2. Глотание ошибок — прямое нарушение `code-style.md §3 «Slop error handling»`
```ts
try { await deleteMarzbanUser(s.marzbanUsername); } catch {}   // actions.ts:21, :95
```
❌ «Empty `catch {}` blocks» из списка мгновенного отказа. Последствие: `resetAllStats` удаляет строки из БД даже когда Marzban недоступен → на сервере остаются живые VPN-аккаунты без записи в БД (утечка доступа).

Также ❌ «Validation that returns early with no error message»:
```ts
const sub = await prisma.subscription.findFirst({ where: { userId } });
if (!sub?.marzbanUsername) return;   // extendUser / toggleBlock — молча ничего не делает
```
Пользователь нажимает «Продлить», страница перезагружается, ничего не изменилось, объяснения нет.

Исправление: возвращать состояние из экшена (`{ ok: false, error: string }`) и показывать его (см. 3.1), а сетевые сбои — логировать и прерывать операцию, а не продолжать удаление.

### 2.3. Нет транзакций там, где их требует целостность
- `markPaid` (`actions.ts:99-106`): `payment.update(SUCCEEDED)` → `activateSubscription(...)`. Если вторая часть упадёт, платёж «оплачен», а подписки нет.
- `resetAllStats`: два `deleteMany` без `$transaction`.
- `deletePlan`: проверка счётчиков и затем `update`/`delete` — TOCTOU-гонка (новый платёж между проверкой и удалением → FK ошибка или потеря истории).

`nextjs/action-*` + `code-style.md §7 «Errors are values / never swallow»`. Исправление: `prisma.$transaction([...])` либо `prisma.$transaction(async tx => ...)`.

### 2.4. Отсутствие какой-либо валидации и типизации входа
`plans/actions.ts`:
```ts
const id = parseInt(formData.get("id") as string);          // NaN → Prisma бросит obscure error
const priceRub = parseFloat(formData.get("price") as string);
price: Math.round(priceRub * 100),                          // NaN → NaN в БД
durationDays: parseInt(formData.get("durationDays") as string),  // NaN / отрицательное / 0
name: formData.get("name") as string,                       // "" или 10 000 символов
```
`trafficGb: parseInt(...) || 0` маскирует только NaN, но пропускает `-500`.

Нарушения: `code-style.md §3 Slop logic` («`parseInt(x)` without radix»), `typescript/safety-strict-null-checks`, `ui-design/form-*` (валидация и actionable errors), `zod/parse-use-safeparse` + `schema-coercion-for-form-data`.

Исправление (единая схема для create/update):
```ts
import { z } from "zod";

const planSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  name: z.string().trim().min(1, "Укажите название").max(60),
  price: z.coerce.number().min(0, "Цена не может быть отрицательной").max(1_000_000),
  durationDays: z.coerce.number().int().min(1, "Срок — минимум 1 день").max(3650),
  trafficGb: z.coerce.number().int().min(0).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

export async function updatePlan(formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = planSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues.map(i => i.message).join(" · ") };
  }
  const d = parsed.data;
  await prisma.plan.update({
    where: { id: d.id! },
    data: { name: d.name, price: Math.round(d.price * 100), durationDays: d.durationDays,
            trafficGb: d.trafficGb, isActive: d.isActive },
  });
  revalidatePath("/admin/plans");
  return { ok: true };
}
```
Отдельно: деньги хранить в копейках как **integer**, парсить через `z.coerce.number().int()` после умножения, и не принимать `NaN`.

### 2.5. Логика выбора подписки: `subscriptions[0]` без сортировки
`users/page.tsx:14` — `include: { subscriptions: ... }`, затем `const sub = user.subscriptions[0]`. Порядок не гарантирован; при нескольких подписках админ видит и редактирует случайную. `extendUser`/`toggleBlock`/`deleteSubAdmin` тоже берут `findFirst({ where: { userId } })` без `orderBy` — три разных места могут выбрать разные записи.

`refactor/name-consistent-vocabulary` + корректность: вынести один источник правды:
```ts
// lib/subscription.ts
export function pickCurrentSub(subs: Subscription[]) {
  return [...subs].sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0] ?? null;
}
```
И передавать `subId`, а не `userId`, в экшены.

---

## 3. Высокий приоритет (Next.js / React best practices)

### 3.1. Ни одна форма не показывает pending/результат
`nextjs/action-pending-states` (`useFormStatus`), `action-error-handling` (`useActionState`), `action-optimistic-updates`.

В `plans/page.tsx` 3 нативные `<form action={...}>` с кнопками «Сохранить»/«+ Добавить тариф», в `users/page.tsx` — «Продлить»/«Заблокировать». После клика: ноль индикации, кнопка остаётся доступной для повторных нажатий (double-submit создаст дубль-тариф), результат неизвестен.

Рецепт:
```tsx
// components/SubmitButton.tsx
"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className={cn(className, pending && "opacity-50 cursor-progress")}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}
```
Для форм с валидацией — `useActionState(action, initialState)` + вывод `state.error` под полем (`ui-design/form-write-actionable-error-messages`). Для «Продлить/Заблокировать» — `useOptimistic`, чтобы строка менялась мгновенно.

### 3.2. `ConfirmButton action={fn.bind(null, id)}` — антипаттерн
`plans/page.tsx:70`, `users/page.tsx:68`, `payments/page.tsx:47`.
`.bind()` в RSC создаёт новую bound-функцию на каждый рендер и обходит типизацию аргумента (сервер не знает, что `planId` — число из доверенного источника). Надёжнее — скрытое поле:
```tsx
<form action={deletePlan}>
  <input type="hidden" name="planId" value={plan.id} />
  <ConfirmButton confirmText="...">Удалить</ConfirmButton>
</form>
```
и `deletePlan(formData: FormData)` с `z.coerce.number()` внутри.

### 3.3. Нет `loading.tsx` / `error.tsx` / `not-found.tsx`
`nextjs/stream-loading-tsx`, `stream-error-tsx`, `stream-skeleton-matching`, `server-error-handling`. Проверено grep'ом: таких файлов в дереве нет. Обзор с 7 запросов (`page.tsx:22-45`) без Suspense = белая страница на время выборки; любая Prisma-ошибка = дефолтный экран Next.js. Плюс `checklist.md §Edge Cases`: «Loading state visible», «Error state visible».

Добавить `src/app/admin/loading.tsx` со скелетоном, повторяющим геометрию карточек метрик, и `src/app/admin/error.tsx` ("use client") с кнопкой «Повторить».

### 3.4. Нет пустых состояний там, где они обязательны
`product-ui-patterns.md §3 Empty states` + anti-pattern «❌ Empty state that says "No data" (meaningless)».
- `page.tsx:100` «Последние платежи» — при пустой таблице выводится **ничего** (пустой `<ul>`).
- `users/page.tsx` — при нуле пользователей остаётся пустая белая карточка.
- Единственное упоминание пустоты — `payments/page.tsx:22` «Платежей пока нет» (текст без действия, нарушает «One sentence + one action»).

Шаблон: SVG-каркас 64px + заголовок («Платежей ещё нет») + строка контекста + одно действие («Открыть тарифы»).

### 3.5. N+1, последовательные awaited в цикле, отсутствие пагинации
- `users/page.tsx:7-10` — `user.findMany({ include: { subscriptions: { include: { plan } } } })` без `take`: при росте базы страница тянет всех юзеров со всеми подписками.
- `payments/page.tsx` — жёсткий `take: 100` без навигации (данные старше 100 записей недостижимы).
- `resetAllStats` — `for (const s of subs) { await deleteMarzbanUser(...) }` — последовательные HTTP-вызовы в цикле. Нарушение `typescript/async-avoid-loop-await` и `react-best-practices/async-parallel`.

Решение: батч через `p-limit` (чанки по 10) + URL-driven пагинация и поиск (`nuqs` + `zod` для searchParams, `tanstack-table` для таблиц) — скиллы уже лежат в `.agent/skills`.

### 3.6. Дублирование логики и «magic numbers»
- `money()` объявлена дважды (`page.tsx:5`, `payments/page.tsx:5`) → `refactor/name-consistent-vocabulary`, DRY: `lib/format.ts`.
- `statusBadge` в `page.tsx:9` и inline-тройной тернарник в `payments/page.tsx:34-42` — две реализации одного и того же. `refactor/cond-lookup-table`.
- `3 * 86400000` (`soon`) — `refactor/name-avoid-encodings`: `const EXPIRING_WINDOW_DAYS = 3; addDays(new Date(), EXPIRING_WINDOW_DAYS)`.
- Классы карточки `bg-white dark:bg-gray-900 rounded-xl border shadow-sm p-*` повторяются 8 раз → вынести `<Panel>`/`<StatCard>` (`tailwind/comp-*`, `design-system-patterns`).

---

## 4. Дизайн и доступность (frontend-design-skills)

### 4.1. Антипаттерны из `SKILL.md §3 AI Slop — Instant Rejection List`
| Найдено | Где | Правило |
|---|---|---|
| Emoji как иконки в продуктовом UI: `🗑 Сбросить…`, `⏳ Истекают…`, `💳 Последние платежи` | `page.tsx:63,77,94`; комментарий `actions.ts:14` | «❌ Emoji as icons in product UI» → inline SVG из одного набора (`suggest-lucide-icons`) |
| `rounded-full` на бейджах статусов + `bg-*-100 text-*-700` | `page.tsx:11-15`, `payments/page.tsx:34-42` | `product-ui-patterns §5`: badge = `--r-sm`, pill — только для тегов |
| Utility soup, 14+ утилит на элемент, без извлечения | `plans/page.tsx:26,38,49` (инпуты), `users/page.tsx:55` | «❌ Tailwind utility soup … no extraction, no semantic naming» |
| Цвета «на глаз» (`blue-600`, `green-600`, `yellow-500`, `red-600`) | `plans/page.tsx:72,103`, `users/page.tsx:57,64,69` | «❌ colors not in the token system»; нужен **1 accent + семантические good/warn/bad** |
| `transition-colors` на корне layout | `layout.tsx:9` | checklist §Motion: «No `transition: all`»; transition без длительности = default 150ms на всём |
| Разделители вместо воздуха | `page.tsx:83,99` (`border-b pb-2`) | checklist §Layout: «Sections separated by whitespace, not dividers» |

### 4.2. Токены вместо палитры Tailwind
`tailwind/theme-semantic-tokens` + `frontend-design-skills/color.md` («All colors come from the token system — no random hex»). Сейчас 26×`dark:` и 18×`gray-` только в `plans/page.tsx` — тёмная тема собирается вручную и потому рассинхронизируется. Показательный баг:

```tsx
// users/page.tsx:27
<p className="text-sm text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-1">
```
Два конфликтующих `dark:`-класса на одном элементе — применяется последний (`gray-500`), т.е. в тёмной теме текст станет **темнее**, чем в светлой (провал контраста). Прямое следствие отсутствия токенов.

Целевая система (`globals.css`):
```css
@theme {
  --color-surface: oklch(0.98 0.002 250);
  --color-panel: oklch(1 0 0);
  --color-ink: oklch(0.24 0.02 260);
  --color-ink-muted: oklch(0.51 0.02 260);
  --color-hairline: oklch(0.9 0.005 260);
  --color-accent: oklch(0.55 0.21 265);
  --color-good: oklch(0.65 0.16 155);
  --color-warn: oklch(0.75 0.15 85);
  --color-bad: oklch(0.6 0.21 27);
}
.dark {
  --color-surface: oklch(0.19 0.01 265); --color-panel: oklch(0.23 0.012 265);
  --color-ink: oklch(0.93 0.005 265);   --color-ink-muted: oklch(0.68 0.01 265);
  --color-hairline: oklch(0.32 0.01 265);
}
```
Разметка становится `bg-surface text-ink border-hairline` без единого `dark:`.

### 4.3. Навигация: нет активного состояния, только hover
`layout.tsx:16-19` — четыре `<Link className="text-gray-300 hover:text-white">`. `product-ui-patterns §1 Sidebar`: «Active state (background tint or left accent border)». Админ не видит, где находится. Нужен клиентский `NavLink` c `usePathname()` (маленький `'use client'`-островок — `nextjs/client-use-client-boundary`), с `aria-current="page"` и accent-подчёркиванием. `focus-visible` колец нет ни у одной ссылки.

### 4.4. Семантика вместо `<div>`-соупа
- Платежи и пользователи свёрстаны лентой карточек, тогда как `product-ui-patterns §7 Tables` для admin-панелей предписывает `<table>`: mono-cap заголовки, 48px строки, числа mono + right-aligned, row hover. Деньги сейчас не используют табличные цифры → checklist §Typography: «Tabular figures for data».
- Нет `<section>`, `<time datetime>` (только `toLocaleString`), нет `<caption>` — `ui-design/access-semantic-html`.
- `<img src="/comet.svg" alt="Gerlio">` вместо `next/image` (`layout.tsx:13`) — `nextjs/build-*`, `ui-design/cwv-optimize-lcp`; alt описывает бренд, а не функцию: логотип декоративный рядом с текстом → `alt=""`.
- `<button>` без явного `type="submit"` внутри форм (`plans/page.tsx:72,103`).

### 4.5. Мелочи качества («Craft in the details»)
- Числовые инпуты без `min`/`step`/`inputMode` → мобильная клавиатура и штурвал мыши портят цены (`ui-design/form-*`).
- Цена в рублях с `step="1"` при хранении в копейках: нельзя ввести 99.90 ₽.
- Нет `aria-live`/toast: `product-ui-patterns §10 Notifications` — подтверждение обязательно для admin-операций.
- Touch targets `px-3 py-1` (~28px) < 44×44 (`ui-design/access-target-size`).
- Нет `@media (prefers-reduced-motion)` и вообще motion-системы (`motion.md`).

---

## 5. Прогон `frontend-design-skills/checklist.md` (релевантные пункту для app-UI)

| Пункт | Статус | Комментарий |
|---|---|---|
| Все цвета из токенов, нет случайных | ❌ | gray/blue/green/yellow/red напрямую |
| Dark mode: не чистый чёрный/белый | ⚠️ | `dark:bg-gray-950` почти чёрный + конфликт `dark:` (`users/page.tsx:27`) |
| Focus-visible виден и спроектирован | ❌ | ни одного `focus-visible` в 5 файлах |
| Buttons: default/hover/focus/active/disabled | ❌ | только hover |
| Inputs: default/hover/focus/error/disabled | ❌ | только базовый border |
| Touch targets ≥44px | ❌ | 28–36px |
| Иконки из одного набора | ❌ | emoji вместо SVG |
| Таблицы: distinct header, mono numbers, row hover | ❌ | ленты div'ов |
| Empty states объясняют, что делать | ❌ | 2 списка пусты «в тишину» |
| Error messages human & actionable | ❌ | ошибок как класса UI нет |
| Loading state visible | ❌ | нет `loading.tsx` |
| Error state visible | ❌ | нет `error.tsx` |
| Long text doesn't break layout | ⚠️ | email/имя тарифа без `truncate` + `min-w-0` |
| Sections separated by whitespace, not dividers | ⚠️ | повсеместные `border-b` |
| One accent color <10% pixels | ✅ | акцент = синий, дозированно |
| No purple-blue gradients / glassmorphism | ✅ | отсутствуют |
| Semantic HTML | ⚠️ | `<nav>/<main>` есть, `<section>/<table>/<time>` нет |

Итог: 2 ✅, 4 ⚠️, 11 ❌ из 17.

---

## 6. Инфраструктурные находки

1. В `/workspace` нет `package.json`/`tsconfig.json`/`next.config.*`, `prisma/schema.prisma`, `src/lib/*`, `src/components/*`; README содержит только `# kikl`. Код ссылается на 6 отсутствующих модулей → аудит нельзя подтвердить сборкой. Перед рефакторингом нужно восстановить полный проект.
2. Нет `middleware.ts` — защита `/admin/*` держится на `await requireAdmin()` в layout и в каждом экшене. Двойная проверка (экшены) есть — это правильно, но middleware желателен как первый барьер.
3. `revalidatePath` раскидан вручную (4 вызова в `resetAllStats`, 3 в `markPaid`). `nextjs/cache-revalidate-tag`: теги `billing`/`plans`/`users` вместо перечисления путей — меньше риска забыть.
4. Нет тестов. `code-style.md §10` — минимум: unit-тесты zod-схем тарифов и селектора «текущая подписка».

---

## 7. План работ (порядок фиксов)

**P0 — безопасность/целостность (день 1)**
1. `requireAdmin(formData?)` + origin/CSRF-проверка; `throw` вместо silent `return`.
2. Zod-схемы для всех экшенов (`planSchema`, `extendSchema`, `idSchema`), `safeParse`, возврат `ActionState`.
3. Убрать `catch {}`: логировать и останавливать `resetAllStats` при сбое Marzban; `$transaction` в `markPaid`/`resetAllStats`; `deletePlan` — FK-safe внутри транзакции.
4. Danger-zone для сброса: ввод контрольного слова + перечисление последствий; rate-limit.
5. Единый селектор текущей подписки; экшены работают по `subId`.

**P1 — UX-состояния (день 2)**
6. `SubmitButton` (`useFormStatus`), `useActionState` + сообщения под полями, `useOptimistic` для блокировки/продления.
7. Toast-контейнер (`role="status" aria-live="polite"`) для успеха/ошибки.
8. `loading.tsx` (скелетон метрик) и `error.tsx` с retry.
9. Empty states по `product-ui-patterns §3` для платежей, пользователей, истекающих подписок.

**P2 — дизайн-система (дни 3–4)**
10. Семантические токены в `@theme` + `.dark` переопределения; удалить все `dark:` из страниц; починить `users/page.tsx:27`.
11. Компоненты `Panel`, `StatCard`, `Field`, `StatusBadge`, `IconButton`, `NavLink(active)`; один набор inline-SVG вместо emoji.
12. `<table>` для платежей/пользователей: mono-cap заголовки, 48px строки, `tabular-nums` + right-align денег, row hover, `focus-visible`.
13. `next/image` для логотипа, `alt=""` для декоративных, явный `type="submit"`, `min`/`step`/`inputMode` у чисел, touch targets 44px.

**P3 — масштаб (неделя 2)**
14. Пагинация + поиск через `nuqs` + `zod` (searchParams), `tanstack-table` для сортировки.
15. `revalidateTag("billing"/"plans"/"users")` вместо ручных путей; `typescript/cache-react-cache` для `requireAdmin`.
16. Параллельный батч-деleting в Marzban (`p-limit`, чанки по 10).
17. Тесты: zod-схемы, селектор подписки, smoke-тесты экшенов с мок-Prisma.

---

Приложения (цитируемые правила): `nextjs/references/action-{pending-states,error-handling,revalidation,optimistic-updates}.md`, `typescript/references/{async-avoid-loop-await,safety-strict-null-checks}.md`, `tailwind/references/theme-semantic-tokens.md`, `ui-design/references/{access-alt-text,access-target-size,form-*}.md`, `frontend-design-skills/{product-ui-patterns,code-style,anti-patterns,color,checklist}.md`, `zod/SKILL.md`, `refactor/SKILL.md`.
