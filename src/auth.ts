export type AuthUser = {
  UserId: number;
  Nombre: string;
  Email?: string | null;
  FechaRegistro?: string | null;
  NivelConfianza?: number | null;
  Activo?: boolean;
  lider?: boolean;
};

const AUTH_KEY = "auth_user";

const toBoolFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === "1" || value === "true";

export const readAuthUser = (): AuthUser | null => {
  const raw = localStorage.getItem(AUTH_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.UserId || !parsed.Nombre) return null;
    return {
      UserId: Number(parsed.UserId),
      Nombre: String(parsed.Nombre),
      Email: parsed.Email ?? null,
      FechaRegistro: parsed.FechaRegistro ?? null,
      NivelConfianza: parsed.NivelConfianza ?? 0,
      Activo: parsed.Activo ?? true,
      lider: toBoolFlag(parsed.lider),
    };
  } catch {
    return null;
  }
};

export const saveAuthUser = (user: AuthUser): void => {
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
};

export const clearAuthUser = (): void => {
  localStorage.removeItem(AUTH_KEY);
};
