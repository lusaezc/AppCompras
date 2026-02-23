const GLOBAL_THEME_KEY = "app_dark_theme";

type StoredProfileSettings = {
  darkTheme?: boolean;
};

export function applyTheme(isDark: boolean) {
  if (typeof document === "undefined") return;
  document.body.classList.toggle("theme-dark", isDark);
}

export function readSavedTheme(userId?: number | null): boolean {
  if (typeof window === "undefined") return false;

  if (userId) {
    const userKey = `profile_settings_${userId}`;
    const raw = window.localStorage.getItem(userKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredProfileSettings;
        if (typeof parsed.darkTheme === "boolean") {
          return parsed.darkTheme;
        }
      } catch {
        // Ignora datos corruptos.
      }
    }
  }

  return window.localStorage.getItem(GLOBAL_THEME_KEY) === "true";
}

export function persistTheme(isDark: boolean, userId?: number | null) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(GLOBAL_THEME_KEY, String(isDark));

  if (!userId) return;

  const userKey = `profile_settings_${userId}`;
  const raw = window.localStorage.getItem(userKey);
  let parsed: Record<string, unknown> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  parsed.darkTheme = isDark;
  window.localStorage.setItem(userKey, JSON.stringify(parsed));
}
