"use client";

/**
 * Тост результата server action.
 *
 * Как это работает без изменения логики: layout читает `?msg=` из URL и передаёт
 * текст сюда. Экшены вызывают redirect("/admin/...?msg=...") — стандартный приём
 * App Router для сообщений после мутации. Через 4 секунды тост исчезает и параметр
 * убирается из URL (replaceState, чтобы не плодить записи в истории).
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconAlert, IconCheck } from "./icons";

/** Текст успеха: если экшен вернул `{ ok: "..." }`, показываем его, иначе дефолтный. */
const DEFAULT_OK = "Готово";

function readMessage(params: URLSearchParams): string | null {
  if (params.has("msg")) return params.get("msg");
  if (params.has("ok")) return params.get("ok") || DEFAULT_OK;
  return null;
}

export function ActionToast() {
  const searchParams = useSearchParams();
  const message = readMessage(searchParams);
  const [text, setText] = useState<string | null>(null);

  // Показываем ровно один раз на каждое изменение ?msg=/?ok= — иначе тост
  // возвращался бы при каждой перевалидации страницы.
  useEffect(() => {
    if (!message) {
      setText(null);
      return;
    }

    setText(message);
    const timer = window.setTimeout(() => {
      setText(null);

      // Чистим msg/ok из адреса, чтобы при обновлении страницы тост не появлялся снова.
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("msg");
        url.searchParams.delete("ok");
        const query = url.searchParams.toString();
        window.history.replaceState(null, "", url.pathname + (query ? `?${query}` : ""));
      } catch {
        /* replaceState недоступен (ssr/тесты) — тост просто исчезнет */
      }
    }, 4000);

    return () => window.clearTimeout(timer);
  }, [message]);

  if (!text) return null;

  const isError = !/^(готово|сохранено|выполнено)/i.test(text);

  return (
    <div className="ad-toast" role="status" aria-live="polite">
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        {isError ? <IconAlert size={16} /> : <IconCheck size={16} />}
        <span style={{ overflowWrap: "anywhere" }}>{text}</span>
      </span>
    </div>
  );
}
