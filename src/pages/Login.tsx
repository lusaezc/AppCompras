import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { readAuthUser, saveAuthUser, type AuthUser } from "../auth";

export default function Login() {
  const navigate = useNavigate();
  const existingUser = readAuthUser();
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (existingUser) {
    return <Navigate to="/profile" replace />;
  }

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setError("No se encontro VITE_API_URL.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiBase}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuario: usuario.trim(),
          contrasena: contrasena.trim(),
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { ok: boolean; data?: AuthUser; message?: string }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.message || "No se pudo iniciar sesion.");
      }

      saveAuthUser(payload.data);
      navigate("/profile", { replace: true });
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Error iniciando sesion";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-card">
        <h1>Iniciar sesion</h1>
        <p>Ingresa tu usuario y contrasena para ver tu perfil.</p>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Usuario
            <input
              type="text"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              placeholder="usuario"
              autoComplete="username"
              required
            />
          </label>

          <label>
            Contrasena
            <input
              type="password"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              placeholder="********"
              autoComplete="current-password"
              required
            />
          </label>

          {error && <small className="login-error">{error}</small>}

          <button
            type="submit"
            className="primary-button"
            disabled={loading || !usuario.trim() || !contrasena.trim()}
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}
