import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, type ChangeEvent } from "react";
import type { Product } from "../types/product";
import { motion } from "framer-motion";

type PriceHistoryItem = {
  RegistroPrecioId: number;
  ProductoId: number;
  SucursalId: number;
  Precio: number;
  FechaRegistro: string;
  UserId: number;
  EsValido: boolean;
  NombreSucursal?: string | null;
  NombreUsuario?: string | null;
};

export default function ProductDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<PriceHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProduct = async () => {
      if (!code) return;
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/productos/codigo/${encodeURIComponent(code)}`,
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Product;
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Producto no encontrado");
        }

        if (active) {
          setProduct(payload.data);
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Error cargando producto";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProduct();

    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!product?.id) return;
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setHistoryError("No se encontro VITE_API_URL.");
        return;
      }

      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/productos/${encodeURIComponent(
            product.id,
          )}/historial-precios`,
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || `Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: PriceHistoryItem[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando historial");
        }

        if (active) {
          setHistory(payload.data);
        }
      } catch (err) {
        if (!active) return;
        setHistoryError(
          err instanceof Error ? err.message : "Error cargando historial",
        );
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [product?.id]);

  const formatDate = (value: string) => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString("es-CL");
  };

  const getTrend = (current: number, previous?: number) => {
    if (typeof previous !== "number") {
      return {
        label: "Sin referencia",
        className: "neutral",
        icon: "=",
        deltaText: null as string | null,
      };
    }
    const delta = Number((current - previous).toFixed(2));
    if (current > previous) {
      return {
        label: "Subio",
        className: "up",
        icon: "↑",
        deltaText: `+$${delta.toFixed(2)}`,
      };
    }
    if (current < previous) {
      return {
        label: "Bajo",
        className: "down",
        icon: "↓",
        deltaText: `-$${Math.abs(delta).toFixed(2)}`,
      };
    }
    return {
      label: "Sin cambio",
      className: "neutral",
      icon: "=",
      deltaText: "$0.00",
    };
  };

  const resizeImageToDataUrl = (
    file: File,
    maxSize: number,
    quality: number,
  ): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Imagen invalida"));
        img.onload = () => {
          const scale = Math.min(1, maxSize / img.width, maxSize / img.height);
          const width = Math.round(img.width * scale);
          const height = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("No se pudo procesar la imagen"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const openEditModal = () => {
    if (!product) return;
    setEditCode(product.code);
    setEditName(product.name);
    setEditBrand(product.brand ?? "");
    setEditCategory(product.category ?? "");
    setEditImage(product.image ?? null);
    setEditError(null);
    setIsEditing(true);
  };

  const handleEditImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 900, 0.75);
      setEditImage(dataUrl);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "No se pudo procesar la imagen",
      );
    }
  };

  const saveChanges = async () => {
    if (!product) return;
    if (!editCode.trim() || !editName.trim()) {
      setEditError("Codigo y nombre son obligatorios");
      return;
    }

    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setEditError("No se encontro VITE_API_URL.");
      return;
    }

    setEditLoading(true);
    setEditError(null);

    try {
      const payload = {
        CodigoBarra: editCode.trim(),
        NombreProducto: editName.trim(),
        Marca: editBrand.trim() || null,
        Categoria: editCategory.trim() || null,
        Imagen: editImage ?? null,
      };

      const response = await fetch(
        `${apiBase}/api/productos/${encodeURIComponent(product.id)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Error ${response.status}`);
      }

      setProduct({
        ...product,
        code: editCode.trim(),
        name: editName.trim(),
        brand: editBrand.trim(),
        category: editCategory.trim(),
        description: editCategory.trim(),
        image: editImage ?? undefined,
      });
      setIsEditing(false);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Error actualizando producto",
      );
    } finally {
      setEditLoading(false);
    }
  };

  if (loading) {
    return <p>Cargando producto...</p>;
  }

  if (error || !product) {
    return <p>{error || "Producto no encontrado"}</p>;
  }

  const latestPrice = history.length > 0 ? history[0] : null;

  return (
    <motion.div className="screen product-detail-page">
      <div className="product-detail-card">
        <header className="product-detail-header">
          <p className="product-detail-subtitle">Ficha de producto</p>
          <h2 className="product-detail-name">{product.name}</h2>
          <div className="product-detail-meta">
            <span className="product-detail-badge">Codigo: {product.code}</span>
            <span>ID: {product.id}</span>
            <span>Marca: {product.brand || "Sin marca"}</span>
            <span>Categoria: {product.category || "Sin categoria"}</span>
          </div>

          <div className="product-detail-stats">
            <div className="product-detail-stat-card">
              <div className="product-detail-stat-label">Ultima compra</div>
              <div className="product-detail-stat-value">
                {historyLoading && "Cargando..."}
                {!historyLoading &&
                  (latestPrice
                    ? `$${Number(latestPrice.Precio).toFixed(2)}`
                    : "Sin datos")}
              </div>
            </div>
            <div className="product-detail-stat-card">
              <div className="product-detail-stat-label">Fecha</div>
              <div className="product-detail-stat-value">
                {historyLoading && "--"}
                {!historyLoading &&
                  (latestPrice ? formatDate(latestPrice.FechaRegistro) : "--")}
              </div>
            </div>
            <div className="product-detail-stat-card">
              <div className="product-detail-stat-label">Registros</div>
              <div className="product-detail-stat-value">{history.length}</div>
            </div>
          </div>
        </header>

        <div className="product-detail-body">
          <div className="product-detail-image-wrap">
            {product.image ? (
              <img
                src={product.image}
                alt={product.name}
                className="product-detail-image"
              />
            ) : (
              <div className="product-detail-image-empty">Sin imagen</div>
            )}
          </div>

          <div className="product-detail-info">
            {product.description ? (
              <p className="product-detail-description">{product.description}</p>
            ) : (
              <p className="product-detail-description">
                No hay descripcion disponible para este producto.
              </p>
            )}

            {latestPrice ? (
              <div className="product-detail-latest">
                <div className="product-detail-latest-title">
                  Ultimo registro de precio
                </div>
                <div className="product-detail-latest-row">
                  <span>Monto</span>
                  <strong>${Number(latestPrice.Precio).toFixed(2)}</strong>
                </div>
                <div className="product-detail-latest-row">
                  <span>Sucursal</span>
                  <strong>
                    {latestPrice.NombreSucursal || latestPrice.SucursalId}
                  </strong>
                </div>
                <div className="product-detail-latest-row">
                  <span>Usuario</span>
                  <strong>{latestPrice.NombreUsuario || latestPrice.UserId}</strong>
                </div>
              </div>
            ) : (
              !historyLoading && (
                <div className="product-detail-latest">
                  <div className="product-detail-latest-title">
                    Historial de precios
                  </div>
                  <div className="product-detail-latest-row">
                    <span>Aun no existen compras registradas para este producto.</span>
                  </div>
                </div>
              )
            )}
          </div>
        </div>

        <div className="product-detail-actions">
          <button
            onClick={() => setShowHistory(true)}
            className="product-detail-action-button"
          >
            Historial
          </button>
          <button
            onClick={openEditModal}
            className="product-detail-action-button"
          >
            Modificar
          </button>
          <button
            onClick={() => navigate(-1)}
            className="product-detail-action-button primary"
          >
            Volver
          </button>
        </div>
      </div>

      {isEditing && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsEditing(false);
            }
          }}
        >
          <div className="modal product-edit-modal">
            <h3>Modificar producto</h3>
            <p>Actualiza los campos del registro.</p>

            <div className="form-group">
              <label>Codigo de barras</label>
              <input
                value={editCode}
                readOnly
                disabled
              />
            </div>

            <div className="form-group">
              <label>Nombre</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label>Marca</label>
              <input
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label>Categoria</label>
              <input
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                disabled={editLoading}
              />
            </div>

            <div className="form-group">
              <label>Imagen</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleEditImage}
                disabled={editLoading}
              />
            </div>

            {editImage && (
              <img
                src={editImage}
                alt={editName || "Preview"}
                className="image-preview"
              />
            )}

            {editImage && (
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setEditImage(null)}
                  disabled={editLoading}
                >
                  Quitar imagen
                </button>
              </div>
            )}

            {editError && <p style={{ color: "#b91c1c" }}>{editError}</p>}

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setIsEditing(false)}
                disabled={editLoading}
              >
                Cancelar
              </button>
              <button
                className="product-save-btn"
                onClick={saveChanges}
                disabled={editLoading}
              >
                {editLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowHistory(false);
            }
          }}
        >
          <div className="modal product-edit-modal">
            <h3>Historial de precios</h3>
            <p>Valores registrados en compras anteriores.</p>

            {historyLoading && <p>Cargando historial...</p>}
            {historyError && <p style={{ color: "#b91c1c" }}>{historyError}</p>}

            {!historyLoading && !historyError && history.length === 0 && (
              <p>No hay historial para este producto.</p>
            )}

            {!historyLoading && !historyError && history.length > 0 && (
              <div className="history-list">
                {history.map((item, index) => {
                  const previousPrice = history[index + 1]?.Precio;
                  const trend = getTrend(Number(item.Precio), previousPrice);
                  return (
                  <div className="history-row" key={item.RegistroPrecioId}>
                    <div className="history-row-main">
                      <div className="history-price">
                        ${Number(item.Precio).toFixed(2)}
                      </div>
                      <div className={`history-trend ${trend.className}`}>
                        <span>{trend.icon}</span>
                        <span>{trend.label}</span>
                        {trend.deltaText && (
                          <span className="history-trend-delta">
                            {trend.deltaText}
                          </span>
                        )}
                      </div>
                      <div className="history-date">
                        Fecha: {formatDate(item.FechaRegistro)}
                      </div>
                    </div>
                    <div className="history-meta">
                      <span>Sucursal: {item.NombreSucursal || item.SucursalId}</span>
                      <span>Usuario: {item.NombreUsuario || item.UserId}</span>
                    </div>
                  </div>
                )})}
              </div>
            )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setShowHistory(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
