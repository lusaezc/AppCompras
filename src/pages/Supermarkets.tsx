import { useEffect, useMemo, useState } from "react";
import ScreenWrapper from "../components/ScreenWrapper";

type Supermarket = {
  SupermercadoId: number;
  Nombre: string;
  Logo?: string | null;
  Pais?: string | null;
};

type Branch = {
  SucursalId: number;
  NombreSucursal: string;
  Direccion?: string | null;
  Comuna?: string | null;
  Region?: string | null;
  Latitud?: number | null;
  Longitud?: number | null;
};

type SupermarketLocation = {
  SupermercadoId: number;
  Nombre: string;
  Logo?: string | null;
  Pais?: string | null;
  Latitud?: number | null;
  Longitud?: number | null;
  Sucursales: Branch[];
};

type ProductPrice = {
  RegistroPrecioId: number;
  ProductoId: number;
  Precio: number;
  FechaRegistro: string;
  SucursalId: number;
  CodigoBarra?: string | null;
  NombreProducto?: string | null;
  Marca?: string | null;
  Categoria?: string | null;
  Imagen?: string | null;
  NombreSucursal?: string | null;
};

export default function Supermarkets() {
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [selectedSupermarketId, setSelectedSupermarketId] = useState("");
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [locationData, setLocationData] = useState<SupermarketLocation | null>(
    null,
  );
  const [productPrices, setProductPrices] = useState<ProductPrice[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");

  const [loadingMarkets, setLoadingMarkets] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadSupermarkets = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoadingMarkets(true);
      setError(null);

      try {
        const response = await fetch(`${apiBase}/api/supermercados`);
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Supermarket[];
          message?: string;
        };
        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando supermercados");
        }

        if (!active) return;
        setSupermarkets(payload.data);
        if (payload.data[0]?.SupermercadoId) {
          setSelectedSupermarketId(String(payload.data[0].SupermercadoId));
        }
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Error cargando supermercados",
        );
      } finally {
        if (active) {
          setLoadingMarkets(false);
        }
      }
    };

    void loadSupermarkets();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSupermarketData = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase || !selectedSupermarketId) return;

      setLoadingData(true);
      setError(null);

      try {
        const [locationResponse, pricesResponse] = await Promise.all([
          fetch(
            `${apiBase}/api/supermercados/${encodeURIComponent(
              selectedSupermarketId,
            )}/ubicacion`,
          ),
          fetch(
            `${apiBase}/api/supermercados/${encodeURIComponent(
              selectedSupermarketId,
            )}/productos-precios`,
          ),
        ]);

        if (!locationResponse.ok) {
          const payload = await locationResponse.json().catch(() => null);
          throw new Error(payload?.message || `Error ${locationResponse.status}`);
        }
        if (!pricesResponse.ok) {
          const payload = await pricesResponse.json().catch(() => null);
          throw new Error(payload?.message || `Error ${pricesResponse.status}`);
        }

        const locationPayload = (await locationResponse.json()) as {
          ok: boolean;
          data?: SupermarketLocation;
          message?: string;
        };
        const pricesPayload = (await pricesResponse.json()) as {
          ok: boolean;
          data?: ProductPrice[];
          message?: string;
        };

        if (!locationPayload.ok || !locationPayload.data) {
          throw new Error(locationPayload.message || "Error cargando ubicacion");
        }
        if (!pricesPayload.ok || !pricesPayload.data) {
          throw new Error(pricesPayload.message || "Error cargando precios");
        }

        if (!active) return;
        setLocationData(locationPayload.data);
        setProductPrices(pricesPayload.data);
        setSelectedBranchId("");
        setSelectedProductId(
          pricesPayload.data[0]?.ProductoId
            ? String(pricesPayload.data[0].ProductoId)
            : "",
        );
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Error cargando datos");
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    };

    void loadSupermarketData();

    return () => {
      active = false;
    };
  }, [selectedSupermarketId]);

  const selectedProduct = useMemo(
    () =>
      productPrices.find(
        (product) => String(product.ProductoId) === selectedProductId,
      ) ?? null,
    [productPrices, selectedProductId],
  );

  const selectedBranch = useMemo(
    () =>
      locationData?.Sucursales.find(
        (branch) => String(branch.SucursalId) === selectedBranchId,
      ) ?? null,
    [locationData?.Sucursales, selectedBranchId],
  );

  const mapInfo = useMemo(() => {
    const branchLat = Number(selectedBranch?.Latitud);
    const branchLng = Number(selectedBranch?.Longitud);
    if (Number.isFinite(branchLat) && Number.isFinite(branchLng)) {
      return { lat: branchLat, lng: branchLng };
    }

    const lat = Number(locationData?.Latitud);
    const lng = Number(locationData?.Longitud);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [
    selectedBranch?.Latitud,
    selectedBranch?.Longitud,
    locationData?.Latitud,
    locationData?.Longitud,
  ]);

  const mapEmbedUrl = useMemo(() => {
    if (!mapInfo) return "";
    return `https://www.google.com/maps?q=${mapInfo.lat},${mapInfo.lng}&z=16&output=embed`;
  }, [mapInfo]);

  const formatMoney = (value: number) =>
    new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
    }).format(Number(value));

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("es-CL");
  };

  return (
    <ScreenWrapper className="market-page">
      <header className="market-header">
        <h1>Explorar supermercados</h1>
        <p>
          Selecciona un supermercado para ver su ubicacion y consultar precios
          por producto.
        </p>
      </header>

      <section className="market-controls">
        <label className="market-label">
          Supermercado
          <select
            value={selectedSupermarketId}
            onChange={(event) => setSelectedSupermarketId(event.target.value)}
            disabled={loadingMarkets}
          >
            <option value="">
              {loadingMarkets ? "Cargando..." : "Selecciona supermercado"}
            </option>
            {supermarkets.map((market) => (
              <option
                key={market.SupermercadoId}
                value={market.SupermercadoId}
              >
                {market.Nombre}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loadingData && <p>Cargando datos del supermercado...</p>}
      {error && <p className="market-error">{error}</p>}

      {!loadingData && !error && locationData && (
        <section className="market-grid">
          <article className="market-card">
            <h2>Ubicacion</h2>
            <p>
              {locationData.Nombre}
              {locationData.Pais ? ` · ${locationData.Pais}` : ""}
            </p>

            {mapInfo ? (
              <>
                <iframe
                  title="Mapa de supermercado"
                  src={mapEmbedUrl}
                  className="market-map"
                  loading="lazy"
                />
                <a
                  className="market-map-link"
                  href={`https://www.google.com/maps/search/?api=1&query=${mapInfo.lat},${mapInfo.lng}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir mapa completo
                </a>
              </>
            ) : (
              <p>No hay coordenadas disponibles para este supermercado.</p>
            )}

            {locationData.Sucursales.length > 0 && (
              <div className="market-branches">
                <strong>Sucursales activas</strong>
                {locationData.Sucursales.slice(0, 5).map((branch) => (
                  <button
                    key={branch.SucursalId}
                    type="button"
                    className={`market-branch-row${
                      String(branch.SucursalId) === selectedBranchId
                        ? " is-selected"
                        : ""
                    }`}
                    onClick={() =>
                      setSelectedBranchId((current) =>
                        current === String(branch.SucursalId)
                          ? ""
                          : String(branch.SucursalId),
                      )
                    }
                  >
                    <span>{branch.NombreSucursal}</span>
                    <small>
                      {[branch.Comuna, branch.Region].filter(Boolean).join(", ")}
                    </small>
                  </button>
                ))}
              </div>
            )}
          </article>

          <article className="market-card">
            <h2>Precio por producto</h2>
            <label className="market-label">
              Producto
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={productPrices.length === 0}
              >
                <option value="">
                  {productPrices.length === 0
                    ? "Sin productos con precio"
                    : "Selecciona producto"}
                </option>
                {productPrices.map((product) => (
                  <option key={product.ProductoId} value={product.ProductoId}>
                    {product.NombreProducto || `Producto ${product.ProductoId}`}
                  </option>
                ))}
              </select>
            </label>

            {selectedProduct && (
              <div className="market-product-card">
                <div className="market-product-top">
                  {selectedProduct.Imagen ? (
                    <img
                      src={selectedProduct.Imagen}
                      alt={
                        selectedProduct.NombreProducto ||
                        `Producto ${selectedProduct.ProductoId}`
                      }
                      className="market-product-image"
                    />
                  ) : (
                    <div className="market-product-image-empty">Sin imagen</div>
                  )}

                  <div className="market-product-info">
                    <strong>
                      {selectedProduct.NombreProducto ||
                        `Producto ${selectedProduct.ProductoId}`}
                    </strong>
                    <span>Codigo: {selectedProduct.CodigoBarra || "--"}</span>
                    <span>
                      Marca: {selectedProduct.Marca || "Sin marca"} · Categoria:{" "}
                      {selectedProduct.Categoria || "Sin categoria"}
                    </span>
                  </div>
                </div>

                <div className="market-product-price">
                  <span>Precio actual</span>
                  <strong>{formatMoney(Number(selectedProduct.Precio))}</strong>
                </div>

                <div className="market-product-meta">
                  <span>
                    Sucursal:{" "}
                    {selectedProduct.NombreSucursal || selectedProduct.SucursalId}
                  </span>
                  <span>
                    Ultima actualizacion:{" "}
                    {formatDate(selectedProduct.FechaRegistro)}
                  </span>
                </div>
              </div>
            )}
          </article>
        </section>
      )}
    </ScreenWrapper>
  );
}
