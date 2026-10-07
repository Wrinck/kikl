/* ============================================================================
   [preview only] Демо-логика статического превью.
   В реальном проекте этот файл НЕ используется: там за это отвечают
   theme-toggle.tsx (localStorage + класс .dark), form-controls.tsx
   (useTransition/useFormStatus + window.confirm) и action-toast.tsx (?msg=).
   Здесь то же поведение воспроизведено на ванильном JS, чтобы макет был живым.
   ========================================================================= */

(function () {
  "use strict";

  var root = document.documentElement;

  /* --- Тема: тот же ключ и те же классы, что в theme-toggle.tsx ------------- */
  var STORAGE_KEY = "theme";

  function systemTheme() {
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function apply(theme) {
    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
    root.style.colorScheme = theme;
  }

  var stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (e) {
    /* приватный режим — работаем от системной темы */
  }
  apply(stored === "light" || stored === "dark" ? stored : systemTheme());

  document.addEventListener("click", function (event) {
    var toggle = event.target.closest(".theme-toggle");
    if (!toggle) return;
    var next = root.classList.contains("dark") ? "light" : "dark";
    apply(next);
    toggle.setAttribute("aria-pressed", String(next === "dark"));
    toggle.setAttribute(
      "aria-label",
      next === "dark" ? "Включить светлую тему" : "Включить тёмную тему"
    );
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch (e) {
      /* выбор просто не сохранится */
    }
  });

  /* --- Тост ------------------------------------------------------------------ */
  var toast = document.getElementById("toast");
  var toastTimer = null;

  function showToast(text, isError) {
    if (!toast) return;
    toast.querySelector(".ad-toast-icon").innerHTML = isError
      ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4.5"/><path d="M12 17.2h.01"/></svg>'
      : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>';
    toast.querySelector(".ad-toast-text").textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toast.hidden = true;
    }, 4000);
  }

  /* --- Подтверждение + pending-состояние ------------------------------------- */
  var overlay = document.getElementById("confirm");
  var pendingForm = null;
  var lastFocused = null;

  function openConfirm(text, onOk) {
    overlay.querySelector(".ad-confirm-text").textContent = text;
    overlay.hidden = false;
    overlay.dataset.action = "pending";
    var okBtn = overlay.querySelector("[data-role=ok]");
    okBtn.onclick = function () {
      overlay.dataset.action = "ok";
      closeConfirm();
      onOk();
    };
    lastFocused = document.activeElement;
    okBtn.focus();
  }

  function closeConfirm() {
    overlay.hidden = true;
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay || event.target.closest("[data-role=cancel]")) {
      overlay.dataset.action = "cancel";
      closeConfirm();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !overlay.hidden) {
      overlay.dataset.action = "cancel";
      closeConfirm();
    }
  });

  function fakeSubmit(form) {
    if (!form) return;
    form.classList.add("is-pending");
    var btn = form.querySelector('button[type="submit"]');
    if (btn) btn.setAttribute("aria-busy", "true");

    // имитация server action: через ~700 мс «страница перерисовалась»
    setTimeout(function () {
      form.classList.remove("is-pending");
      if (btn) btn.removeAttribute("aria-busy");
      var msg = form.getAttribute("data-msg") || "Готово";
      showToast(msg, false);
    }, 700);
  }

  document.addEventListener("submit", function (event) {
    var form = event.target;
    event.preventDefault(); // в превью никуда не отправляем

    var confirmText = form.getAttribute("data-confirm");
    if (confirmText) {
      openConfirm(confirmText, function () {
        fakeSubmit(form);
      });
      return;
    }
    fakeSubmit(form);
  });

  /* --- Активная ссылка навигации (в проде — usePathname) --------------------- */
  var here = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".ad-navlink").forEach(function (link) {
    var target = link.getAttribute("href");
    if (target === here || (here === "index.html" && target === "index.html")) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
  });
})();
