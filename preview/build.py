#!/usr/bin/env python3
"""[preview] Сборщик статического превью админки.

Генерирует preview/*.html из тех же структур и классов, что используют
src/app/admin/*/page.tsx + src/components/admin/*.tsx. Иконки берутся прямо из
icons.tsx, чтобы превью и прод не разъезжались.

Запуск:  python3 preview/build.py
"""
from __future__ import annotations

import json
import re
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "preview"

# ---------------------------------------------------------------- иконки ----
_src = (ROOT / "src/components/admin/icons.tsx").read_text(encoding="utf-8")
_ic = {}
for block in re.split(r"\n(?=export function Icon)", _src):
    m = re.match(r"export function Icon(\w+)\(p: IconProps\) \{", block)
    if not m:
        continue
    elems = [
        f'<{tag} {" ".join(attrs.split())} />'
        for tag, attrs in re.findall(r"<(path|circle|rect)\s+(.*?)\s*/>", block, re.S)
    ]
    _ic[m.group(1)] = "".join(elems)


def icon(name: str, size: int = 16) -> str:
    """Тот же SVG, что рендерит <Icon{name} size={n} /> в React."""
    return (
        f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none"'
        f' stroke="currentColor" stroke-width="1.5" stroke-linecap="round"'
        f' stroke-linejoin="round" aria-hidden="true">{_ic[name]}</svg>'
    )


# ------------------------------------------------------------- каркас -------
NAV = [("index.html", "Обзор"), ("plans.html", "Тарифы"),
       ("users.html", "Пользователи"), ("payments.html", "Платежи")]


def shell(title: str, current: str, main: str) -> str:
    nav = "\n".join(
        f'          <a class="ad-navlink{" is-active" if href == current else ""}"'
        f' href="{href}"{" aria-current=\"page\"" if href == current else ""}>{label}</a>'
        for href, label in NAV
    )
    return f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>{title} — Админ-панель (liquid glass preview)</title>
<link rel="stylesheet" href="assets/admin.css" />
</head>
<body>
<div class="ad-root">
  <header class="ad-header">
    <div class="ad-header-in">
      <div class="ad-header-start">
        <a class="ad-brand" href="index.html">
          <span class="ad-brand-mark">{icon("Gauge", 18)}</span>
          Админ-панель
        </a>
        <nav class="ad-nav" aria-label="Разделы админки">
{nav}
        </nav>
      </div>
      <div class="ad-header-end">
        <button type="button" class="ad-btn ad-btn-icon ad-btn-sm theme-toggle"
                aria-label="Включить тёмную тему" aria-pressed="false">
          <span class="i-moon">{icon("Moon", 16)}</span>
          <span class="i-sun">{icon("Sun", 16)}</span>
        </button>
        <a class="ad-back" href="#">{icon("ArrowLeft", 15)}В кабинет</a>
      </div>
    </div>
  </header>

  <main class="ad-main">
{main}
  </main>

  <!-- ActionToast: в проде появляется из ?msg=; здесь — после «отправки» формы -->
  <div class="ad-toast" id="toast" role="status" aria-live="polite" hidden>
    <span class="ad-toast-icon"></span><span class="ad-toast-text"></span>
  </div>

  <!-- ConfirmButton: в проде window.confirm(); здесь стеклянная карточка -->
  <div class="ad-confirm" id="confirm" role="dialog" aria-modal="true"
       aria-labelledby="confirm-text" hidden>
    <div class="ad-confirm-card">
      <p class="ad-confirm-text" id="confirm-text"></p>
      <div class="ad-confirm-actions">
        <button type="button" class="ad-btn ad-btn-ghost" data-role="cancel">Отмена</button>
        <button type="button" class="ad-btn ad-btn-primary" data-role="ok">Подтвердить</button>
      </div>
    </div>
  </div>
</div>
<script src="assets/preview.js"></script>
</body>
</html>
"""


def panel_head(title: str, hint: str | None = None, ic: str | None = None) -> str:
    inner = f"{icon(ic, 16)}{title}" if ic else title
    sub = f'\n        <p class="ad-sub">{hint}</p>' if hint else ""
    return f"""    <div class="ad-panel-head">
      <div style="min-width:0">
        <h2 class="ad-h2 ad-panel-head-t">{inner}</h2>{sub}
      </div>
    </div>"""


def badge(status: str) -> str:
    tone = {"SUCCEEDED": "good", "ACTIVE": "good", "PENDING": "warn",
            "PROCESSING": "warn", "EXPIRED": "neutral", "FAILED": "bad",
            "BANNED": "bad", "CANCELED": "bad"}[status]
    label = {"SUCCEEDED": "Оплачен", "ACTIVE": "Активна", "PENDING": "Ожидает",
             "EXPIRED": "Истекла", "FAILED": "Ошибка", "BANNED": "Заблокирован",
             "CANCELED": "Отменён", "PROCESSING": "Обработка"}[status]
    return f'<span class="ad-badge ad-badge-{tone}">{label}</span>'


def btn(label: str, *, variant: str = "", sm: bool = True, ic: str | None = None,
        confirm: str | None = None, msg: str = "Готово") -> str:
    """ActionButton/SubmitButton → form с data-confirm/data-msg (см. preview.js)."""
    cls = " ".join(filter(None, ["ad-btn", "ad-btn-sm" if sm else "", variant]))
    svg = f"{icon(ic, 14)}" if ic else ""
    attrs = ""
    if confirm:
        attrs = f' data-confirm="{confirm}"'
    return (f'<form class="ad-inline-form" data-msg="{msg}"{attrs}>'
            f'<button type="submit" class="{cls}">'
            f'<span class="ad-spin" aria-hidden="true"></span>{svg}{label}</button></form>')


def field(fid: str, label: str, control: str, hint: str | None = None,
          span2: bool = False) -> str:
    h = f'\n      <p id="{fid}-hint" style="font-size:12px;color:var(--ink-subtle);margin:0">{hint}</p>' if hint else ""
    return f"""    <div class="ad-field{' ad-span-2' if span2 else ''}">
      <label class="ad-label" for="{fid}">{label}</label>
      {control}{h}
    </div>"""


def inp(fid: str, name: str, cls: str = "ad-input", **kw) -> str:
    at = [f'id="{fid}"', f'name="{name}"', f'class="{cls}"']
    for k, v in kw.items():
        if v is True:
            at.append(k)
        elif v is not None:
            at.append(f'{k}="{v}"')
    return "<input " + " ".join(at) + " />"


# ============================================================== ОБЗОР ========
stats = [
    ("Выручка за всё время", "1 284 500 ₽", ""),
    ("Выручка за месяц", "247 300 ₽", ""),
    ("Активные подписки", "312", ""),
    ("Пользователей", "1 048", ""),
    ("Платежи в ожидании", "3", " ad-stat--alert"),
]
stats_html = "\n".join(
    f'      <div class="ad-panel ad-stat{mod}">\n'
    f'        <p class="ad-stat-label">{lab}</p>\n'
    f'        <p class="ad-stat-value">{val}</p>\n      </div>'
    for lab, val, mod in stats
)

expiring = [("lena.kovaleva@gmail.com", "10 окт. 2026", "2026-10-10"),
            ("artem.v@mail.ru", "10 окт. 2026", "2026-10-10"),
            ("nikita.pro@yandex.ru", "11 окт. 2026", "2026-10-11")]
expiring_html = "\n".join(
    f'        <li class="ad-list-item"><p class="ad-cell-title">{e}</p>'
    f'<time class="ad-num" datetime="{iso}">{d}</time></li>'
    for e, d, iso in expiring
)

recent = [("marina.t@icloud.com", "3 Месяца / Безлимит", "8 окт. 2026, 19:42", "1 499 ₽", "SUCCEEDED"),
          ("denis.kroha@list.ru", "1 Месяц / 100 ГБ", "8 окт. 2026, 14:07", "499 ₽", "PENDING"),
          ("olga.mironova@gmail.com", "6 Месяцев / Безлимит", "7 окт. 2026, 23:15", "2 490 ₽", "SUCCEEDED"),
          ("vpn-test@proton.me", "1 Месяц / 100 ГБ", "7 окт. 2026, 11:30", "499 ₽", "FAILED"),
          ("sergey.petrov@yandex.ru", "3 Месяца / Безлимит", "6 окт. 2026, 20:58", "1 499 ₽", "SUCCEEDED")]
recent_html = "\n".join(
    f'        <li class="ad-list-item">\n'
    f'          <div style="min-width:0"><p class="ad-cell-title">{e}</p>\n'
    f'            <p class="ad-cell-meta">{p} · {d}</p></div>\n'
    f'          <div class="ad-actions" style="gap:10px"><span class="ad-num">{m}</span>{badge(s)}</div>\n'
    f'        </li>'
    for e, p, d, m, s in recent
)

overview_main = f"""    <div class="ad-stack ad-fade">
      <div class="ad-row">
        <div style="min-width:0">
          <h1 class="ad-h1">Обзор</h1>
          <p class="ad-sub">01.10.2026 — начало отчётного месяца</p>
        </div>
        <div class="ad-actions">
{btn("Сбросить всю статистику", variant="ad-btn-danger", sm=False, ic="Trash",
     confirm="Сбросить ВСЮ статистику? Будут удалены все платежи и подписки, VPN-пользователи будут удалены с сервера.",
     msg="Готово: статистика сброшена")}
        </div>
      </div>

      <div class="ad-grid-stats">
{stats_html}
      </div>

      <div class="ad-cols-2">
        <section class="ad-panel">
{panel_head("Истекают в ближайшие 3 дня", "Активные подписки, которые скоро остановятся", "Clock")}
          <ul class="ad-list">
{expiring_html}
          </ul>
        </section>

        <section class="ad-panel">
{panel_head("Последние платежи", "10 последних операций", "Card")}
          <ul class="ad-list">
{recent_html}
          </ul>
        </section>
      </div>

      <p class="ad-note">{icon("Users", 16)}
        Управление подписками — в разделе «Пользователи», выдача оплат — в разделе «Платежи».
      </p>
    </div>"""

# ============================================================== ТАРИФЫ =======
plans = [
    (1, "1 Месяц / 100 ГБ", "499", 30, 100, True, "499 ₽", "100 ГБ"),
    (2, "3 Месяца / Безлимит", "1 499", 90, 0, True, "1 499 ₽", "∞"),
    (3, "6 Месяцев / Безлимит", "2 490", 180, 0, True, "2 490 ₽", "∞"),
    (4, "12 Месяцев / Безлимит", "4 490", 365, 0, False, "4 490 ₽", "∞"),
]
plan_items = []
for pid, name, price, days, traffic, active, money, traf in plans:
    checked = " checked" if active else ""
    plan_items.append(f"""        <li class="ad-plan-item">
          <form class="ad-form-grid" data-msg="Готово: тариф сохранён">
            <input type="hidden" name="id" value="{pid}" />
{field(f"plan-name-{pid}", "Название", inp(f"plan-name-{pid}", "name", value=name, maxlength=60, required=True), span2=True)}
{field(f"plan-price-{pid}", "Цена, ₽", inp(f"plan-price-{pid}", "price", type="number", min=0, step="1", value=price.replace(" ", ""), required=True))}
{field(f"plan-days-{pid}", "Дней", inp(f"plan-days-{pid}", "durationDays", type="number", min=1, max=3650, value=days, required=True))}
{field(f"plan-traffic-{pid}", "Трафик, ГБ", inp(f"plan-traffic-{pid}", "trafficGb", type="number", min=0, max=100000, value=traffic), hint="0 — безлимит")}
            <div class="ad-plan-side">
              <label class="ad-check" for="plan-active-{pid}">
                <input id="plan-active-{pid}" name="isActive" type="checkbox"{checked} /> Активен
              </label>
              <p class="ad-cell-meta">В базе: {money} · {traf}</p>
            </div>
            <div class="ad-actions">
              <button type="submit" class="ad-btn ad-btn-sm ad-btn-primary">
                <span class="ad-spin" aria-hidden="true"></span>Сохранить
              </button>
            </div>
          </form>
{btn("Удалить", variant="ad-btn-danger", ic="Trash",
     confirm="Удалить тариф? Если он уже используется в подписках или платежах — он будет просто деактивирован.",
     msg="Готово: тариф удалён")}
        </li>""")

new_plan = f"""        <form class="ad-panel-pad ad-form-grid" data-msg="Готово: тариф добавлен">
{field("new-plan-name", "Название", inp("new-plan-name", "name", placeholder="3 Месяца / Безлимит", maxlength=60, required=True), span2=True)}
{field("new-plan-price", "Цена, ₽", inp("new-plan-price", "price", type="number", min=0, step="1", placeholder="499", required=True))}
{field("new-plan-days", "Дней", inp("new-plan-days", "durationDays", type="number", min=1, max=3650, placeholder="90", required=True))}
{field("new-plan-traffic", "Трафик, ГБ", inp("new-plan-traffic", "trafficGb", type="number", min=0, max=100000, placeholder="0"), hint="0 — безлимит")}
          <div class="ad-actions">
            <button type="submit" class="ad-btn ad-btn-good">
              <span class="ad-spin" aria-hidden="true"></span>{icon("Plus", 15)}Добавить тариф
            </button>
          </div>
        </form>"""

plans_main = f"""    <div class="ad-stack ad-fade">
      <div class="ad-row">
        <div style="min-width:0">
          <h1 class="ad-h1">Тарифы и цены</h1>
          <p class="ad-sub">Изменения сразу видны пользователям в кабинете</p>
        </div>
      </div>

      <section class="ad-panel">
{panel_head("Действующие тарифы", "Цена в рублях хранится в копейках", "Layers")}
        <ul class="ad-plan-list">
{chr(10).join(plan_items)}
        </ul>
      </section>

      <section class="ad-panel">
{panel_head("Новый тариф", "Заполните и добавьте в список", "Plus")}
{new_plan}
      </section>
    </div>"""

# ========================================================== ПОЛЬЗОВАТЕЛИ ====
users = [
    ("admin@vpn.local", "ADMIN", None, None, None, None, None),
    ("marina.t@icloud.com", None, "3 Месяца / Безлимит", "10 янв. 2027", "2027-01-10", "marz_m_tanaka", "ACTIVE"),
    ("lena.kovaleva@gmail.com", None, "1 Месяц / 100 ГБ", "10 окт. 2026", "2026-10-10", "marz_l_kovaleva", "ACTIVE"),
    ("denis.kroha@list.ru", None, "1 Месяц / 100 ГБ", "05 окт. 2026", "2026-10-05", "marz_d_kroha", "EXPIRED"),
    ("olga.mironova@gmail.com", None, "6 Месяцев / Безлимит", "04 апр. 2027", "2027-04-04", "marz_o_mironova", "ACTIVE"),
    ("nick.solo@proton.me", None, None, None, None, None, None),
]
user_rows = []
for i, (email, role, plan, expires, iso, mb, status) in enumerate(users, start=1):
    tag = '<span class="ad-tag">admin</span>' if role == "ADMIN" else ""
    meta = (f'Тариф: {plan} · До <time datetime="{iso}">{expires}</time> '
            f'<span class="ad-mono">({mb})</span>') if plan else "Нет подписки"
    actions = ""
    if plan:
        st_badge = badge(status)
        if status == "ACTIVE":
            block_btn = btn("Заблокировать", variant="ad-btn-warn", ic="Ban",
                            confirm="Заблокировать доступ пользователю на VPN-сервере?",
                            msg="Готово: доступ заблокирован")
        else:
            block_btn = btn("Разблокировать", variant="ad-btn-good", ic="Unlock",
                            confirm="Снять блокировку и вернуть доступ?",
                            msg="Готово: доступ возвращён")
        extend = (f'<form class="ad-inline-form" data-msg="Готово: подписка продлена">'
                  f'<label class="ad-sr-only" for="days-{i}">Дней продления</label>'
                  f'{inp(f"days-{i}", "days", cls="ad-input ad-input-sm ad-input-w", type="number", min=1, max=3650, value=30)}'
                  f'<button type="submit" class="ad-btn ad-btn-sm ad-btn-primary">'
                  f'<span class="ad-spin" aria-hidden="true"></span>Продлить</button></form>')
        delete = btn("Удалить", variant="ad-btn-danger", ic="Trash",
                     confirm="Удалить подписку пользователя? VPN-пользователь будет удалён с сервера.",
                     msg="Готово: подписка удалена")
        actions = f'      <div class="ad-actions">\n        {st_badge}\n        {extend}\n        {block_btn}\n        {delete}\n      </div>'
    user_rows.append(f"""      <li class="ad-user-row">
        <div style="min-width:0">
          <p class="ad-cell-title">{email} {tag}</p>
          <p class="ad-cell-meta">{meta}</p>
        </div>
{actions}
      </li>""")

users_main = f"""    <div class="ad-stack ad-fade">
      <div class="ad-row">
        <div style="min-width:0">
          <h1 class="ad-h1">Пользователи</h1>
          <p class="ad-sub">{len(users)} аккаунтов · продление и блокировка влияют на Marzban</p>
        </div>
      </div>

      <section class="ad-panel">
        <ul class="ad-list">
{chr(10).join(user_rows)}
        </ul>
      </section>
    </div>"""

# ============================================================== ПЛАТЕЖИ =====
payments = [
    ("marina.t@icloud.com", "3 Месяца / Безлимит", "08.10.2026, 19:42", "1 499 ₽", "SUCCEEDED"),
    ("denis.kroha@list.ru", "1 Месяц / 100 ГБ", "08.10.2026, 14:07", "499 ₽", "PENDING"),
    ("olga.mironova@gmail.com", "6 Месяцев / Безлимит", "07.10.2026, 23:15", "2 490 ₽", "SUCCEEDED"),
    ("vpn-test@proton.me", "1 Месяц / 100 ГБ", "07.10.2026, 11:30", "499 ₽", "FAILED"),
    ("sergey.petrov@yandex.ru", "3 Месяца / Безлимит", "06.10.2026, 20:58", "1 499 ₽", "SUCCEEDED"),
    ("anna.vl@mail.ru", "1 Месяц / 100 ГБ", "06.10.2026, 09:12", "499 ₽", "PENDING"),
    ("t.gromov@yandex.ru", "12 Месяцев / Безлимит", "05.10.2026, 18:03", "4 490 ₽", "SUCCEEDED"),
    ("lite.user@inbox.ru", "1 Месяц / 100 ГБ", "05.10.2026, 07:44", "499 ₽", "CANCELED"),
    ("pavel.sea@gmail.com", "3 Месяца / Безлимит", "04.10.2026, 22:19", "1 499 ₽", "PENDING"),
]
rows = []
for (e, p, d, m, s), iso in zip(payments, ["2026-10-08T19:42", "2026-10-08T14:07",
    "2026-10-07T23:15", "2026-10-07T11:30", "2026-10-06T20:58", "2026-10-06T09:12",
    "2026-10-05T18:03", "2026-10-05T07:44", "2026-10-04T22:19"]):
    action = (btn("Выдать подписку", variant="ad-btn-good", ic="Check",
                  confirm="Отметить платёж оплаченным и выдать подписку?",
                  msg="Готово: подписка выдана") if s == "PENDING" else "")
    rows.append(f"""            <tr>
              <td><p class="ad-cell-title">{e}</p></td>
              <td><p class="ad-cell-meta">{p}</p></td>
              <td><p class="ad-cell-meta"><time datetime="{iso}">{d}</time></p></td>
              <td class="ad-num">{m}</td>
              <td>{badge(s)}</td>
              <td>{action}</td>
            </tr>""")

payments_main = f"""    <div class="ad-stack ad-fade">
      <div class="ad-row">
        <div style="min-width:0">
          <h1 class="ad-h1">Платежи</h1>
          <p class="ad-sub">Последние {len(payments)} операций · ручная выдача только для статуса «Ожидает»</p>
        </div>
      </div>

      <section class="ad-panel">
        <div class="ad-table-wrap">
          <table class="ad-table">
            <caption class="ad-sr-only">Список платежей</caption>
            <thead>
              <tr>
                <th scope="col">Пользователь</th>
                <th scope="col">Тариф</th>
                <th scope="col">Дата</th>
                <th scope="col" class="ad-num">Сумма</th>
                <th scope="col">Статус</th>
                <th scope="col"><span class="ad-sr-only">Действия</span></th>
              </tr>
            </thead>
            <tbody>
{chr(10).join(rows)}
            </tbody>
          </table>
        </div>
      </section>
    </div>"""

# -----------------------------------------------------------------------------
# --------------------------------------------------------------- CSS --------
# Секции 1–13 превью = точная копия prod-стилей; пересобираем их при каждом запуске.
_prod_css = (ROOT / "src/app/admin/ui.css").read_text(encoding="utf-8")
_cur_css_path = OUT / "assets" / "admin.css"
_marker = "/* --- 14. [preview]"
_old = _cur_css_path.read_text(encoding="utf-8") if _cur_css_path.exists() else ""
_extra = _marker + _old.split(_marker, 1)[1] if _marker in _old else ""
_head = ("/* ============================================================================\n"
         "   PREVIEW — «Liquid Glass» админ-панель. Статический HTML5 + CSS3, без сборки.\n"
         "   Секции 1–13 — копия src/app/admin/ui.css один в один. Секция 14 — только для превью.\n"
         "   ========================================================================= */\n\n")
# [preview]-дополнения к прод-стилям: спиннер pending-состояния показывается,
# когда у формы появился класс is-pending (в проде это делает useFormStatus).
_pending_patch = """
/* [preview] pending-индикатор форм (в проде — useFormStatus/useTransition) */
form.is-pending .ad-btn[type="submit"] .ad-spin { display: block; }
form.is-pending .ad-btn[type="submit"] { pointer-events: none; opacity: 0.75; }
"""
_prod_css = _prod_css.replace(
    "@keyframes ad-spin { to { transform: rotate(360deg); } }",
    "@keyframes ad-spin { to { transform: rotate(360deg); } }" + _pending_patch,
)
assert _pending_patch in _prod_css, "ui.css изменился: не найден блок ad-spin для патча превью"
_cur_css_path.write_text(_head + _prod_css.rstrip() + "\n\n" + _extra, encoding="utf-8")
print("synced assets/admin.css from src/app/admin/ui.css")

pages = {
    "index.html": ("Обзор", overview_main),
    "plans.html": ("Тарифы", plans_main),
    "users.html": ("Пользователи", users_main),
    "payments.html": ("Платежи", payments_main),
}
for fname, (title, body) in pages.items():
    (OUT / fname).write_text(shell(title, fname, body), encoding="utf-8")
    print(f"written: preview/{fname}")

print(json.dumps({"icons": len(_ic)}, ensure_ascii=False))
