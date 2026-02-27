import { useEffect } from "react";

const LOCK_ATTR = "data-scroll-lock-count";
const LOCK_CLASS = "modal-scroll-lock";

export default function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;

    const body = document.body;
    const current = Number(body.getAttribute(LOCK_ATTR) ?? "0");
    const next = current + 1;
    body.setAttribute(LOCK_ATTR, String(next));
    body.classList.add(LOCK_CLASS);

    return () => {
      const active = Number(body.getAttribute(LOCK_ATTR) ?? "0");
      const remaining = Math.max(0, active - 1);
      if (remaining === 0) {
        body.removeAttribute(LOCK_ATTR);
        body.classList.remove(LOCK_CLASS);
        return;
      }
      body.setAttribute(LOCK_ATTR, String(remaining));
    };
  }, [locked]);
}

