import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Star } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";
import { clearAuthUser, readAuthUser, saveAuthUser, type AuthUser } from "../auth";
import { applyTheme, persistTheme, readSavedTheme } from "../theme";

type ProfileSettings = {
  displayName: string;
  email: string;
  notifications: boolean;
  profilePublic: boolean;
  darkTheme: boolean;
};

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

const defaultSettings: ProfileSettings = {
  displayName: "",
  email: "",
  notifications: true,
  profilePublic: false,
  darkTheme: false,
};

export default function Profile() {
  const navigate = useNavigate();
  const [sessionUser] = useState<AuthUser | null>(() => readAuthUser());
  const [user, setUser] = useState<AuthUser | null>(sessionUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProfileSettings>(defaultSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [avatarSrc, setAvatarSrc] = useState(
    "https://i.pravatar.cc/150?u=guest",
  );

  const isLider = isLiderFlag(user?.lider);

  const avatarCandidates = useMemo(() => {
    if (!user?.UserId) return ["https://i.pravatar.cc/150?u=guest"];
    return [
      `/avatars/${user.UserId}.jpg`,
      `/avatars/${user.UserId}.jpeg`,
      `/avatars/${user.UserId}.jfif`,
      `/avatars/${user.UserId}.png`,
      `https://i.pravatar.cc/150?u=${user.UserId}`,
    ];
  }, [user?.UserId]);

  useEffect(() => {
    if (!sessionUser) return;
    let active = true;

    const loadUser = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/usuarios/${sessionUser.UserId}`,
        );
        if (response.status === 401 || response.status === 404) {
          clearAuthUser();
          navigate("/login", { replace: true });
          return;
        }
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: AuthUser;
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando usuario");
        }

        if (active) {
          const normalizedUser = {
            ...payload.data,
            lider: isLiderFlag(payload.data.lider),
          };
          setUser(normalizedUser);
          saveAuthUser(normalizedUser);
        }
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error ? loadError.message : "Error de carga";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadUser();
    return () => {
      active = false;
    };
  }, [navigate, sessionUser]);

  useEffect(() => {
    if (!user) {
      setSettings(defaultSettings);
      return;
    }

    const storageKey = `profile_settings_${user.UserId}`;
    const raw = localStorage.getItem(storageKey);

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<ProfileSettings>;
        const darkTheme = parsed.darkTheme ?? readSavedTheme(user.UserId);
        setSettings({
          displayName: parsed.displayName ?? user.Nombre ?? "",
          email: parsed.email ?? user.Email ?? "",
          notifications: parsed.notifications ?? true,
          profilePublic: parsed.profilePublic ?? false,
          darkTheme,
        });
        applyTheme(darkTheme);
        return;
      } catch {
        // Ignora datos corruptos.
      }
    }

    const darkTheme = readSavedTheme(user.UserId);
    setSettings({
      ...defaultSettings,
      displayName: user.Nombre ?? "",
      email: user.Email ?? "",
      darkTheme,
    });
    applyTheme(darkTheme);
  }, [user]);

  const memberSince = useMemo(() => {
    if (!user?.FechaRegistro) return "Sin fecha de registro";
    const date = new Date(user.FechaRegistro);
    if (Number.isNaN(date.getTime())) return "Sin fecha de registro";
    return date.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  }, [user?.FechaRegistro]);

  const trustLevel = useMemo(() => {
    const raw = Number(user?.NivelConfianza ?? 0);
    if (!Number.isFinite(raw)) return 0;
    const normalized = Math.round(raw);
    return Math.min(5, Math.max(0, normalized));
  }, [user?.NivelConfianza]);

  useEffect(() => {
    setAvatarSrc(avatarCandidates[0]);
  }, [avatarCandidates]);

  const onSave = () => {
    if (!user) return;
    const storageKey = `profile_settings_${user.UserId}`;
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setStatus("Configuracion guardada.");
    window.setTimeout(() => setStatus(null), 2500);
  };

  const onLogout = () => {
    clearAuthUser();
    navigate("/login", { replace: true });
  };

  return (
    <ScreenWrapper>
      <motion.div
        className="profile-page"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <section className="profile-hero">
          <motion.img
            src={avatarSrc}
            alt="foto de perfil"
            className="profile-avatar"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35 }}
            onError={() => {
              const currentIndex = avatarCandidates.indexOf(avatarSrc);
              const nextIndex = currentIndex + 1;
              if (nextIndex < avatarCandidates.length) {
                setAvatarSrc(avatarCandidates[nextIndex]);
              }
            }}
          />
          <div className="profile-hero-content">
            <span
              className={[
                "profile-role-badge",
                isLider ? "is-lider" : "is-user",
              ].join(" ")}
            >
              {isLider ? "Administrador" : "Usuario"}
            </span>
            <h2>{user?.Nombre ?? "Perfil de usuario"}</h2>
            <p>{user?.Email ?? "Sin email registrado"}</p>
          </div>
        </section>

        <section className="profile-card-block">
          <h3>Cuenta</h3>

          <div className="profile-meta-grid">
            <div className="profile-meta-item">
              <span>Miembro desde</span>
              <strong>{memberSince}</strong>
            </div>
            <div className="profile-meta-item">
              <span>Nivel de confianza</span>
              <strong className="profile-trust">
                <span
                  className="profile-stars"
                  aria-label={`${trustLevel} de 5`}
                >
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      size={16}
                      className={
                        value <= trustLevel
                          ? "profile-star profile-star-filled"
                          : "profile-star profile-star-empty"
                      }
                    />
                  ))}
                </span>
                <span>{trustLevel}/5</span>
              </strong>
            </div>
          </div>
          {loading && !user && <small>Cargando perfil...</small>}
          {error && <small className="profile-error">{error}</small>}
        </section>

        <section className="profile-card-block">
          <h3>Informacion personal</h3>
          <label className="profile-label">
            Nombre visible
            <input
              type="text"
              value={settings.displayName}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  displayName: e.target.value,
                }))
              }
              placeholder="Tu nombre"
            />
          </label>
          <label className="profile-label">
            Email
            <input
              type="email"
              value={settings.email}
              onChange={(e) =>
                setSettings((prev) => ({ ...prev, email: e.target.value }))
              }
              placeholder="correo@ejemplo.com"
            />
          </label>
        </section>

        <section className="profile-card-block">
          <h3>Configuraciones</h3>
          <label className="profile-toggle">
            <span>Notificaciones push</span>
            <input
              type="checkbox"
              checked={settings.notifications}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  notifications: e.target.checked,
                }))
              }
            />
          </label>

          <label className="profile-toggle">
            <span>Perfil publico</span>
            <input
              type="checkbox"
              checked={settings.profilePublic}
              onChange={(e) =>
                setSettings((prev) => ({
                  ...prev,
                  profilePublic: e.target.checked,
                }))
              }
            />
          </label>

          <label className="profile-toggle">
            <span>Tema oscuro</span>
            <input
              type="checkbox"
              checked={settings.darkTheme}
              onChange={(e) => {
                const checked = e.target.checked;
                setSettings((prev) => ({
                  ...prev,
                  darkTheme: checked,
                }));
                applyTheme(checked);
                persistTheme(checked, user?.UserId);
              }}
            />
          </label>
        </section>

        {isLider && (
          <button
            type="button"
            className="profile-manage-users-btn"
            onClick={() => navigate("/lider/usuarios")}
          >
            Gestionar usuarios
          </button>
        )}

        <button
          type="button"
          className="primary-button"
          onClick={onSave}
          disabled={!user}
        >
          Guardar configuracion
        </button>

        <button type="button" className="profile-logout-btn" onClick={onLogout}>
          Cerrar sesion
        </button>

        {status && <div className="success-toast">{status}</div>}
      </motion.div>
    </ScreenWrapper>
  );
}
