import { useEffect, useMemo, useState } from "react";
import ScreenWrapper from "../components/ScreenWrapper";
import { readAuthUser } from "../auth";

type PurchaseRow = {
  CompraId: number;
  UserId: number;
  FechaCompra: string;
  TotalCompra: number;
  SucursalId: number;
  NombreSucursal?: string | null;
  NombreSupermercado?: string | null;
  TotalItems: number;
};

type PurchaseItemRow = {
  DetalleCompraId: number;
  CompraId: number;
  ProductoId: number;
  PrecioUnitario: number;
  Cantidad: number;
  Subtotal: number;
  CodigoBarra?: string | null;
  NombreProducto?: string | null;
  Marca?: string | null;
  Categoria?: string | null;
  Imagen?: string | null;
};

export default function PurchaseHistory() {
  const authUser = readAuthUser();
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<number | null>(
    null,
  );
  const [itemsByPurchaseId, setItemsByPurchaseId] = useState<
    Record<number, PurchaseItemRow[]>
  >({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;

    const loadPurchases = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }
      if (!authUser?.UserId) {
        setError("No se encontro un usuario autenticado.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/compras/user/${encodeURIComponent(authUser.UserId)}`,
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: PurchaseRow[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando historial");
        }

        if (!active) return;
        setPurchases(payload.data);
        setSelectedPurchaseId(payload.data[0]?.CompraId ?? null);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Error cargando historial",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadPurchases();

    return () => {
      active = false;
    };
  }, [authUser?.UserId]);

  useEffect(() => {
    let active = true;

    const loadPurchaseItems = async () => {
      if (!selectedPurchaseId || itemsByPurchaseId[selectedPurchaseId]) return;
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setDetailError("No se encontro VITE_API_URL.");
        return;
      }

      setDetailLoading(true);
      setDetailError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/compras/${encodeURIComponent(selectedPurchaseId)}/items`,
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: PurchaseItemRow[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando detalle");
        }

        if (!active) return;
        setItemsByPurchaseId((prev) => ({
          ...prev,
          [selectedPurchaseId]: payload.data ?? [],
        }));
      } catch (err) {
        if (!active) return;
        setDetailError(
          err instanceof Error ? err.message : "Error cargando detalle",
        );
      } finally {
        if (active) {
          setDetailLoading(false);
        }
      }
    };

    void loadPurchaseItems();

    return () => {
      active = false;
    };
  }, [itemsByPurchaseId, selectedPurchaseId]);

  const selectedPurchase = useMemo(
    () =>
      purchases.find((purchase) => purchase.CompraId === selectedPurchaseId) ??
      null,
    [purchases, selectedPurchaseId],
  );

  const selectedItems = selectedPurchaseId
    ? itemsByPurchaseId[selectedPurchaseId] ?? []
    : [];

  const totals = useMemo(() => {
    const totalPurchases = purchases.length;
    const totalAmount = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.TotalCompra),
      0,
    );
    const averageTicket = totalPurchases > 0 ? totalAmount / totalPurchases : 0;
    return { totalPurchases, totalAmount, averageTicket };
  }, [purchases]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("es-CL", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(Number(value));

  return (
    <ScreenWrapper className="purchase-history-page">
      <header className="purchase-history-header">
        <h1>Historial de compras</h1>
        <p>
          {authUser?.Nombre
            ? `Compras registradas por ${authUser.Nombre}`
            : "Compras registradas"}
        </p>
      </header>

      <section className="purchase-stats-grid">
        <article className="purchase-stat-card">
          <span>Total compras</span>
          <strong>{totals.totalPurchases}</strong>
        </article>
        <article className="purchase-stat-card">
          <span>Gasto acumulado</span>
          <strong>{formatMoney(totals.totalAmount)}</strong>
        </article>
        <article className="purchase-stat-card">
          <span>Ticket promedio</span>
          <strong>{formatMoney(totals.averageTicket)}</strong>
        </article>
      </section>

      {loading && <p>Cargando compras...</p>}
      {error && <p className="purchase-error">{error}</p>}

      {!loading && !error && purchases.length === 0 && (
        <p>Aun no tienes compras registradas.</p>
      )}

      {!loading && !error && purchases.length > 0 && (
        <section className="purchase-history-layout">
          <div className="purchase-list">
            {purchases.map((purchase) => {
              const isActive = purchase.CompraId === selectedPurchaseId;
              return (
                <button
                  type="button"
                  key={purchase.CompraId}
                  onClick={() => {
                    setSelectedPurchaseId(purchase.CompraId);
                    setDetailError(null);
                    setIsDetailOpen(true);
                  }}
                  className={`purchase-row ${isActive ? "active" : ""}`}
                >
                  <div className="purchase-row-top">
                    <strong>Compra #{purchase.CompraId}</strong>
                    <span>{formatMoney(Number(purchase.TotalCompra))}</span>
                  </div>
                  <div className="purchase-row-meta">
                    <span>{formatDate(purchase.FechaCompra)}</span>
                    <span>{purchase.TotalItems} productos</span>
                  </div>
                  <div className="purchase-row-store">
                    {purchase.NombreSupermercado || "Sin supermercado"} ·{" "}
                    {purchase.NombreSucursal || `Sucursal ${purchase.SucursalId}`}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isDetailOpen && selectedPurchase && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsDetailOpen(false);
            }
          }}
        >
          <div className="modal purchase-detail-modal">
            <div className="purchase-detail-head">
              <h2>Detalle compra #{selectedPurchase.CompraId}</h2>
              <p>{formatDate(selectedPurchase.FechaCompra)}</p>
              <p>
                {selectedPurchase.NombreSupermercado || "Sin supermercado"} ·{" "}
                {selectedPurchase.NombreSucursal ||
                  `Sucursal ${selectedPurchase.SucursalId}`}
              </p>
            </div>

            {detailLoading && <p>Cargando productos...</p>}
            {detailError && <p className="purchase-error">{detailError}</p>}

            {!detailLoading && !detailError && selectedItems.length === 0 && (
              <p>Esta compra no tiene productos asociados.</p>
            )}

            {!detailLoading && !detailError && selectedItems.length > 0 && (
              <div className="purchase-item-list">
                {selectedItems.map((item) => (
                  <article key={item.DetalleCompraId} className="purchase-item-card">
                    <div className="purchase-item-layout">
                      <div className="purchase-item-image-wrap">
                        {item.Imagen ? (
                          <img
                            src={item.Imagen}
                            alt={item.NombreProducto || `Producto ${item.ProductoId}`}
                            className="purchase-item-image"
                          />
                        ) : (
                          <div className="purchase-item-image-empty">Sin imagen</div>
                        )}
                      </div>

                      <div className="purchase-item-content">
                        <div className="purchase-item-top">
                          <strong>
                            {item.NombreProducto || `Producto ${item.ProductoId}`}
                          </strong>
                          <span>{formatMoney(Number(item.Subtotal))}</span>
                        </div>
                        <div className="purchase-item-meta">
                          <span>Cantidad: {item.Cantidad}</span>
                          <span>
                            Unitario: {formatMoney(Number(item.PrecioUnitario))}
                          </span>
                        </div>
                        <div className="purchase-item-meta">
                          <span>Codigo: {item.CodigoBarra || "--"}</span>
                          <span>Categoria: {item.Categoria || "Sin categoria"}</span>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsDetailOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </ScreenWrapper>
  );
}
