import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Navigate, useNavigate } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";
import { readAuthUser } from "../auth";

type ManagedUser = {
  UserId: number;
  Nombre: string;
  Email?: string | null;
  Activo?: boolean | number;
  lider?: boolean | number;
};

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

export default function UserManagement() {
  const navigate = useNavigate();
  const authUser = readAuthUser();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const listVariants = {
    hidden: {},
    visible: {
      transition: { staggerChildren: 0.05, delayChildren: 0.03 },
    },
  };
  const rowVariants = {
    hidden: { opacity: 0, y: 8 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" as const } },
  };

  useEffect(() => {
    if (!authUser?.UserId) return;
    let active = true;

    const loadUsers = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/usuarios/lider/list?liderUserId=${encodeURIComponent(authUser.UserId)}`,
        );

        if (response.status === 403) {
          if (!active) return;
          setAccessDenied(true);
          return;
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: ManagedUser[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "No se pudo cargar usuarios.");
        }

        if (!active) return;
        setUsers(payload.data);
      } catch (loadError) {
        if (!active) return;
        const message =
          loadError instanceof Error
            ? loadError.message
            : "Error cargando usuarios";
        setError(message);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadUsers();
    return () => {
      active = false;
    };
  }, [authUser?.UserId]);

  const onToggleActive = async (target: ManagedUser) => {
    if (!authUser?.UserId) return;
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setError("No se encontro VITE_API_URL.");
      return;
    }

    const nextActive = !target.Activo;
    setActionLoadingId(target.UserId);
    setError(null);

    try {
      const response = await fetch(
        `${apiBase}/api/usuarios/${encodeURIComponent(target.UserId)}/activo`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liderUserId: authUser.UserId,
            activo: nextActive,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `Error ${response.status}`);
      }

      setUsers((prev) =>
        prev.map((row) =>
          row.UserId === target.UserId ? { ...row, Activo: nextActive } : row,
        ),
      );
      setStatus(payload.message || "Estado actualizado.");
      window.setTimeout(() => setStatus(null), 2500);
    } catch (toggleError) {
      const message =
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar estado";
      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const onToggleLider = async (target: ManagedUser) => {
    if (!authUser?.UserId) return;
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setError("No se encontro VITE_API_URL.");
      return;
    }

    const nextLider = !isLiderFlag(target.lider);
    setActionLoadingId(target.UserId);
    setError(null);

    try {
      const response = await fetch(
        `${apiBase}/api/usuarios/${encodeURIComponent(target.UserId)}/lider`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liderUserId: authUser.UserId,
            lider: nextLider,
          }),
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; message?: string }
        | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || `Error ${response.status}`);
      }

      setUsers((prev) =>
        prev.map((row) =>
          row.UserId === target.UserId ? { ...row, lider: nextLider } : row,
        ),
      );
      setStatus(payload.message || "Rol actualizado.");
      window.setTimeout(() => setStatus(null), 2500);
    } catch (toggleError) {
      const message =
        toggleError instanceof Error
          ? toggleError.message
          : "No se pudo actualizar el rol";
      setError(message);
    } finally {
      setActionLoadingId(null);
    }
  };

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (accessDenied) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <ScreenWrapper className="user-management-page">
      <header className="user-management-header">
        <span className="products-modern-chip">Administracion</span>
        <h1>Gestion de usuarios</h1>
        <p>Activa o desactiva cuentas para permitir o bloquear inicio de sesion.</p>
      </header>

      <section className="profile-card-block">
        {loading && (
          <div className="app-modern-loading" role="status">
            <span className="app-modern-spinner" />
            <p>Cargando usuarios...</p>
          </div>
        )}
        {error && <p className="profile-error">{error}</p>}
        {status && <p className="product-form-success">{status}</p>}

        {!loading && !error && users.length === 0 && (
          <div className="app-modern-empty">No hay usuarios para administrar.</div>
        )}

        {!loading && !error && users.length > 0 && (
          <motion.div
            className="profile-admin-list"
            variants={listVariants}
            initial="hidden"
            animate="visible"
          >
            {users.map((row) => {
              const active = Boolean(row.Activo);
              const rowIsLider = isLiderFlag(row.lider);
              const isCurrentUser = row.UserId === authUser.UserId;
              const disableActiveToggle = rowIsLider || isCurrentUser;
              const disableRoleToggle = isCurrentUser;

              return (
                <motion.article
                  key={row.UserId}
                  className="profile-admin-row"
                  variants={rowVariants}
                >
                  <div className="profile-admin-user">
                    <strong className="profile-admin-name-row">
                      <span>{row.Nombre}</span>
                      <span
                        className={[
                          "profile-admin-role-pill",
                          rowIsLider ? "is-lider" : "is-user",
                        ].join(" ")}
                      >
                        {rowIsLider ? "Administrador" : "Usuario"}
                      </span>
                    </strong>
                    <span>{row.Email || "Sin email"}</span>
                  </div>

                  <div className="profile-admin-actions">
                    <span
                      className={[
                        "profile-admin-badge",
                        active ? "is-active" : "is-inactive",
                      ].join(" ")}
                    >
                      {active ? "Activa" : "Inactiva"}
                    </span>
                    <button
                      type="button"
                      className="profile-admin-btn"
                      disabled={
                        actionLoadingId === row.UserId || disableActiveToggle
                      }
                      onClick={() => onToggleActive(row)}
                    >
                      {active ? "Desactivar" : "Activar"}
                    </button>
                    <button
                      type="button"
                      className="profile-admin-btn secondary"
                      disabled={actionLoadingId === row.UserId || disableRoleToggle}
                      onClick={() => onToggleLider(row)}
                    >
                      {rowIsLider
                        ? "Quitar administrador"
                        : "Hacer administrador"}
                    </button>
                  </div>
                </motion.article>
              );
            })}
          </motion.div>
        )}
      </section>

      <button
        type="button"
        className="product-form-secondary"
        onClick={() => navigate("/profile")}
      >
        Volver al perfil
      </button>
    </ScreenWrapper>
  );
}
