import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";
import { readAuthUser } from "../auth";

type PriceRecord = {
  RegistroPrecioId: number;
  ProductoId: number;
  SucursalId: number;
  Precio: number;
  FechaRegistro: string;
  UserId: number;
  EsValido: boolean;
  CodigoBarra?: string | null;
  NombreProducto?: string | null;
  Marca?: string | null;
  Categoria?: string | null;
  NombreSucursal?: string | null;
  NombreSupermercado?: string | null;
  NombreUsuario?: string | null;
};

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

export default function PriceFeed() {
  const authUser = readAuthUser();
  const isLider = isLiderFlag(authUser?.lider);
  const [records, setRecords] = useState<PriceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [supermarketFilter, setSupermarketFilter] = useState("all");

  useEffect(() => {
    let active = true;

    const loadRecords = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        params.set("limit", "200");
        if (submittedQuery.trim()) {
          params.set("q", submittedQuery.trim());
        }

        const response = await fetch(`${apiBase}/api/precios?${params}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: PriceRecord[];
          message?: string;
        };
        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando precios");
        }

        if (!active) return;
        setRecords(payload.data);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error cargando precios");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadRecords();
    return () => {
      active = false;
    };
  }, [submittedQuery]);

  const supermarkets = useMemo(() => {
    const values = Array.from(
      new Set(records.map((row) => row.NombreSupermercado).filter(Boolean)),
    ) as string[];
    return values.sort((a, b) => a.localeCompare(b, "es"));
  }, [records]);

  const filteredRecords = useMemo(() => {
    if (supermarketFilter === "all") return records;
    return records.filter((row) => row.NombreSupermercado === supermarketFilter);
  }, [records, supermarketFilter]);

  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const users = new Set(filteredRecords.map((row) => row.UserId)).size;
    const products = new Set(filteredRecords.map((row) => row.ProductoId)).size;
    const average =
      total > 0
        ? filteredRecords.reduce((sum, row) => sum + Number(row.Precio || 0), 0) /
          total
        : 0;
    return { total, users, products, average };
  }, [filteredRecords]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(Number(value));

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const onSubmitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittedQuery(query);
  };

  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isLider) {
    return <Navigate to="/" replace />;
  }

  return (
    <ScreenWrapper className="price-feed-page">
      <header className="price-feed-header">
        <h1>Precios de la comunidad</h1>
        <p>
          Registros de precios aportados por todos los usuarios para comparar
          valores recientes.
        </p>
      </header>

      <section className="price-feed-controls">
        <form className="price-feed-search" onSubmit={onSubmitSearch}>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar producto, codigo, usuario o supermercado"
          />
          <button type="submit" className="price-feed-search-btn">
            Buscar
          </button>
        </form>

        <label className="price-feed-filter">
          Supermercado
          <select
            value={supermarketFilter}
            onChange={(event) => setSupermarketFilter(event.target.value)}
          >
            <option value="all">Todos</option>
            {supermarkets.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="price-feed-stats">
        <article className="price-feed-stat-card">
          <span>Registros</span>
          <strong>{stats.total}</strong>
        </article>
        <article className="price-feed-stat-card">
          <span>Usuarios activos</span>
          <strong>{stats.users}</strong>
        </article>
        <article className="price-feed-stat-card">
          <span>Productos</span>
          <strong>{stats.products}</strong>
        </article>
        <article className="price-feed-stat-card">
          <span>Precio promedio</span>
          <strong>{formatMoney(stats.average)}</strong>
        </article>
      </section>

      {loading && <p>Cargando registros de precios...</p>}
      {error && <p className="purchase-error">{error}</p>}

      {!loading && !error && filteredRecords.length === 0 && (
        <p>No se encontraron registros de precios para los filtros elegidos.</p>
      )}

      {!loading && !error && filteredRecords.length > 0 && (
        <section className="price-feed-list">
          {filteredRecords.map((row) => (
            <article key={row.RegistroPrecioId} className="price-feed-row">
              <div className="price-feed-row-top">
                <strong>{row.NombreProducto || `Producto ${row.ProductoId}`}</strong>
                <span>{formatMoney(Number(row.Precio))}</span>
              </div>

              <div className="price-feed-row-meta">
                <span>{row.CodigoBarra || "Sin codigo"}</span>
                <span>{formatDate(row.FechaRegistro)}</span>
              </div>

              <div className="price-feed-row-meta">
                <span>{row.NombreSupermercado || "Supermercado no definido"}</span>
                <span>{row.NombreSucursal || `Sucursal ${row.SucursalId}`}</span>
              </div>

              <div className="price-feed-row-user">
                Reportado por: {row.NombreUsuario || `Usuario ${row.UserId}`}
              </div>
            </article>
          ))}
        </section>
      )}
    </ScreenWrapper>
  );
}
