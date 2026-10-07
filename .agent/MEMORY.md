# MEMORY

## Preferences

- `lang_chat = Ru` — общаться с пользователем на русском языке (ответы, пояснения, отчёты).
  Код, идентификаторы, коммиты и технические артефакты — как принято в проекте (обычно EN).

## Learned skills (каталог)

Локальные копии репозиториев со скиллами: `.agent/skills/`

1. **`.agent/skills/agent-skills/`** ← https://github.com/Aver005/agent-skills
   111 скиллов в формате `SKILL.md` (frontmatter `name` + `description`). Категории:
   Frontend (nextjs, react-best-practices, tailwind, shadcn, motion, ui-design, design-system-patterns,
   feature-sliced-design, tanstack-*, zustand-state-management, react-hook-form[-zod], nuqs),
   Backend (nestjs-*, drizzle-orm-d1, python-* ×7, api-design-principles),
   Architecture/Quality (architecture-patterns, refactor, code-reviewer, code-review, typescript, changelog-automation),
   Mobile/Capacitor (capacitor-*, capgo-*, ionic-*, cordova-to-capacitor, safe-area-handling),
   Design (frontend-design, web-design-guidelines, figma, responsive-design, web-component-design, konsta-ui, daisyui[-5], tailwind-*),
   Meta (skill-creator, find-skills, bash-pro, bash-defensive-patterns).

2. **`.agent/skills/frontend-design-skills/`** ← https://github.com/AkyRayy/Frontend-Design-SKILLS-for-AI
   Модульный скилл «Frontend Design — Craft, Not Slop» (18 файлов, ~7.8k строк):
   `SKILL.md` (ядро) + `aesthetics.md`, `minimal-ui-patterns.md`, `editorial-patterns.md`,
   `brutalist-patterns.md`, `product-ui-patterns.md`, `typography.md`, `color.md`, `layout.md`,
   `anti-patterns.md`, `components.md`, `motion.md`, `content.md`, `accessibility.md`,
   `performance.md`, `imagery.md`, `code-style.md`, `checklist.md` + `examples/*.html`.

## Как применять

- Любая работа с веб-UI/лендингами/дизайном → сначала открыть
  `.agent/skills/frontend-design-skills/SKILL.md` (процесс из 10 шагов + список мгновенного отказа §3),
  затем подгрузить нужные модули по таблице §7 (default load: aesthetics + typography + color + layout + code-style + checklist).
- Фреймворк/язык → соответствующий скилл из `.agent/skills/agent-skills/<name>/SKILL.md`
  (правила приоритизированы по impact; есть `references/*.md` с примерами incorrect/correct).
- Перед сдачей страницы — прогнать `frontend-design-skills/checklist.md`.
- Создать новый скилл → `agent-skills/skill-creator/SKILL.md`.

Дата изучения: 2026-10-08
