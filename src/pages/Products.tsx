import { useEffect, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import type { Product } from "../types/product";

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

export default function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [historyByProductId, setHistoryByProductId] = useState<
    Record<string, PriceHistoryItem[]>
  >({});
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setError("No se encontro VITE_API_URL.");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${apiBase}/api/productos`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Product[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando productos");
        }

        if (active) {
          setProducts(payload.data);
        }
      } catch (err) {
        if (!active) return;
        const message =
          err instanceof Error ? err.message : "Error cargando productos";
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!selectedProduct?.id || historyByProductId[selectedProduct.id]) return;
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
            selectedProduct.id,
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

        if (!active) return;
        setHistoryByProductId((prev) => ({
          ...prev,
          [selectedProduct.id]: payload.data ?? [],
        }));
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
  }, [historyByProductId, selectedProduct?.id]);

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

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditCode(product.code);
    setEditName(product.name);
    setEditBrand(product.brand ?? "");
    setEditCategory(product.category ?? "");
    setEditImage(product.image ?? null);
    setEditError(null);
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

  const saveProductChanges = async () => {
    if (!editingProduct) return;
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
        `${apiBase}/api/productos/${encodeURIComponent(editingProduct.id)}`,
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

      setProducts((prev) =>
        prev.map((p) =>
          p.id === editingProduct.id
            ? {
                ...p,
                code: editCode.trim(),
                name: editName.trim(),
                brand: editBrand.trim(),
                category: editCategory.trim(),
                description: editCategory.trim(),
                image: editImage ?? undefined,
              }
            : p,
        ),
      );

      setEditingProduct(null);
    } catch (err) {
      setEditError(
        err instanceof Error ? err.message : "Error actualizando producto",
      );
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <motion.div
      className="screen"
    >
      <h2>Administrar productos</h2>

      {loading && <p>Cargando productos...</p>}

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {!loading && !error && products.length === 0 && (
        <p>No hay productos registrados</p>
      )}

      {products.map((product) => (
        <button
          key={product.id}
          className="product-card"
          type="button"
          onClick={() => {
            setSelectedProduct(product);
            setHistoryError(null);
          }}
        >
          <div className="product-content">
            {product.image && (
              <img
                src={product.image}
                alt={product.name}
                className="product-image product-image-small"
              />
            )}

            <div className="product-info">
              <strong>{product.name}</strong>
              <div>Código: {product.code}</div>
              <div>Marca: {product.brand || "Sin marca"}</div>
              <div>Categoría: {product.category || "Sin categoría"}</div>
              {/* 👇 ID SOLO PARA DEBUG */}
              <div style={{ opacity: 0.6 }}>ID: {product.id}</div>
            </div>
          </div>
        </button>
      ))}

      {selectedProduct && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedProduct(null);
            }
          }}
        >
          <div className="modal product-edit-modal">
            <h3>Historial de precios</h3>
            <p>
              {selectedProduct.name} ({selectedProduct.code})
            </p>

            {historyLoading && <p>Cargando historial...</p>}
            {historyError && <p style={{ color: "#b91c1c" }}>{historyError}</p>}

            {!historyLoading &&
              !historyError &&
              (historyByProductId[selectedProduct.id]?.length ?? 0) === 0 && (
                <p>No hay historial para este producto.</p>
              )}

            {!historyLoading &&
              !historyError &&
              (historyByProductId[selectedProduct.id]?.length ?? 0) > 0 && (
                <div className="history-list">
                  {(historyByProductId[selectedProduct.id] ?? []).map(
                    (item, index, list) => {
                      const previousPrice = list[index + 1]?.Precio;
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
                            <span>
                              Sucursal: {item.NombreSucursal || item.SucursalId}
                            </span>
                            <span>
                              Usuario: {item.NombreUsuario || item.UserId}
                            </span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setSelectedProduct(null)}
                type="button"
              >
                Cerrar
              </button>
              <button
                className="product-save-btn"
                onClick={() => {
                  openEditModal(selectedProduct);
                  setSelectedProduct(null);
                }}
                type="button"
              >
                Modificar
              </button>
            </div>
          </div>
        </div>
      )}

      {editingProduct && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setEditingProduct(null);
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
                onClick={() => setEditingProduct(null)}
                disabled={editLoading}
              >
                Cancelar
              </button>

              <button
                className="product-save-btn"
                onClick={saveProductChanges}
                disabled={editLoading}
              >
                {editLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
