import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import type { Product } from "../types/product";
import useLockBodyScroll from "../hooks/useLockBodyScroll";

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

type CatalogItem = {
  id: number;
  name: string;
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
  const [editBrandId, setEditBrandId] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [editImage, setEditImage] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [showBrandCreator, setShowBrandCreator] = useState(false);
  const [showCategoryCreator, setShowCategoryCreator] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [brandSearch, setBrandSearch] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [showBrandSuggestions, setShowBrandSuggestions] = useState(false);
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const cardContainerVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.05,
      },
    },
  };
  const cardItemVariants = {
    hidden: { opacity: 0, y: 10, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { duration: 0.26, ease: "easeOut" as const },
    },
  };
  useLockBodyScroll(Boolean(selectedProduct) || Boolean(editingProduct) || createMode);

  const totalProducts = products.length;
  const totalBrands = useMemo(
    () => new Set(products.map((p) => p.brandId).filter(Boolean)).size,
    [products],
  );
  const totalCategories = useMemo(
    () => new Set(products.map((p) => p.categoryId).filter(Boolean)).size,
    [products],
  );
  const filteredBrands = useMemo(() => {
    const query = brandSearch.trim().toLowerCase();
    if (!query) return brands;
    return brands.filter((row) => row.name.toLowerCase().includes(query));
  }, [brands, brandSearch]);
  const filteredCategories = useMemo(() => {
    const query = categorySearch.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((row) => row.name.toLowerCase().includes(query));
  }, [categories, categorySearch]);

  useEffect(() => {
    let active = true;

    const loadCatalogs = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) return;
      try {
        const [brandsRes, categoriesRes] = await Promise.all([
          fetch(`${apiBase}/api/marcas`),
          fetch(`${apiBase}/api/categorias`),
        ]);

        if (!brandsRes.ok || !categoriesRes.ok) return;

        const brandsPayload = (await brandsRes.json()) as {
          ok: boolean;
          data?: Array<{ MarcaId: number; Nombre: string }>;
        };

        const categoriesPayload = (await categoriesRes.json()) as {
          ok: boolean;
          data?: Array<{ CategoriaId: number; Nombre: string }>;
        };

        if (!active || !brandsPayload.ok || !categoriesPayload.ok) return;

        setBrands(
          (brandsPayload.data ?? []).map((row) => ({
            id: row.MarcaId,
            name: row.Nombre,
          })),
        );
        setCategories(
          (categoriesPayload.data ?? []).map((row) => ({
            id: row.CategoriaId,
            name: row.Nombre,
          })),
        );
      } catch {
        // Silencioso: los productos siguen visibles aunque no cargue catalogo.
      }
    };

    void loadCatalogs();
    return () => {
      active = false;
    };
  }, []);

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

  useEffect(() => {
    let isActive = true;

    const stopCamera = async () => {
      if (!qrRef.current) return;
      try {
        await qrRef.current.stop();
      } catch {
        // Ignora errores al detener camara para no romper flujo del modal.
      } finally {
        qrRef.current?.clear();
        qrRef.current = null;
      }
    };

    const startCamera = async () => {
      if (!cameraActive || !createMode) return;
      if (qrRef.current || isStartingRef.current) return;
      isStartingRef.current = true;
      setScanError(null);

      const mountEl = document.getElementById("products-create-reader");
      if (!mountEl) {
        setScanError("No se encontro el contenedor de camara.");
        isStartingRef.current = false;
        return;
      }

      const qr = new Html5Qrcode("products-create-reader");
      qrRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 220 },
          (decodedText) => {
            if (!isActive || hasScannedRef.current) return;
            hasScannedRef.current = true;
            setEditCode(decodedText);
            setCameraActive(false);
          },
          () => {},
        );
      } catch {
        setScanError("No se pudo iniciar la camara. Verifica permisos e intenta nuevamente.");
        setCameraActive(false);
      } finally {
        isStartingRef.current = false;
      }
    };

    if (cameraActive && createMode) {
      void startCamera();
    } else {
      void stopCamera();
    }

    return () => {
      isActive = false;
      hasScannedRef.current = false;
      void stopCamera();
    };
  }, [cameraActive, createMode]);

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
    setCreateMode(false);
    setShowBrandCreator(false);
    setShowCategoryCreator(false);
    setNewBrandName("");
    setNewCategoryName("");
    setBrandSearch(product.brand ?? "");
    setCategorySearch(product.category ?? "");
    setShowBrandSuggestions(false);
    setShowCategorySuggestions(false);
    setEditingProduct(product);
    setEditCode(product.code);
    setEditName(product.name);
    setEditBrandId(
      product.brandId ? String(product.brandId) : "",
    );
    setEditCategoryId(
      product.categoryId ? String(product.categoryId) : "",
    );
    setEditImage(product.image ?? null);
    setEditError(null);
  };

  const openCreateModal = () => {
    setCreateMode(true);
    setEditingProduct(null);
    setShowBrandCreator(false);
    setShowCategoryCreator(false);
    setNewBrandName("");
    setNewCategoryName("");
    setBrandSearch("");
    setCategorySearch("");
    setShowBrandSuggestions(false);
    setShowCategorySuggestions(false);
    setEditCode("");
    setEditName("");
    setEditBrandId("");
    setEditCategoryId("");
    setEditImage(null);
    setCameraActive(false);
    setScanError(null);
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
    if (!createMode && !editingProduct) return;
    if (!editCode.trim() || !editName.trim()) {
      setEditError("Debes escanear/ingresar codigo y nombre");
      return;
    }
    if (!editBrandId || !editCategoryId) {
      setEditError("Selecciona marca y categoria");
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
        MarcaId: Number(editBrandId),
        CategoriaId: Number(editCategoryId),
        Imagen: editImage ?? null,
      };

      const endpoint = createMode
        ? `${apiBase}/api/productos`
        : `${apiBase}/api/productos/${encodeURIComponent(editingProduct?.id ?? "")}`;
      const method = createMode ? "POST" : "PUT";
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || `Error ${response.status}`);
      }

      const refreshResponse = await fetch(`${apiBase}/api/productos`);
      if (refreshResponse.ok) {
        const refreshPayload = (await refreshResponse.json()) as {
          ok: boolean;
          data?: Product[];
        };
        if (refreshPayload.ok && refreshPayload.data) {
          setProducts(refreshPayload.data);
        }
      }

      setCreateMode(false);
      setEditingProduct(null);
    } catch (err) {
      setEditError(
        err instanceof Error
          ? err.message
          : createMode
            ? "Error creando producto"
            : "Error actualizando producto",
      );
    } finally {
      setEditLoading(false);
    }
  };

  const createBrandFromModal = async () => {
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setEditError("No se encontro VITE_API_URL.");
      return;
    }
    const finalName = newBrandName.trim();
    if (!finalName) return;

    setCreatingBrand(true);
    setEditError(null);
    try {
      const response = await fetch(`${apiBase}/api/marcas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Nombre: finalName }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: boolean;
            data?: { MarcaId: number; Nombre: string };
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.message || "No se pudo crear la marca");
      }

      const created = { id: payload.data.MarcaId, name: payload.data.Nombre };
      setBrands((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      setEditBrandId(String(created.id));
      setBrandSearch(created.name);
      setShowBrandSuggestions(false);
      setNewBrandName("");
      setShowBrandCreator(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Error creando marca");
    } finally {
      setCreatingBrand(false);
    }
  };

  const createCategoryFromModal = async () => {
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setEditError("No se encontro VITE_API_URL.");
      return;
    }
    const finalName = newCategoryName.trim();
    if (!finalName) return;

    setCreatingCategory(true);
    setEditError(null);
    try {
      const response = await fetch(`${apiBase}/api/categorias`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Nombre: finalName }),
      });

      const payload = (await response.json().catch(() => null)) as
        | {
            ok: boolean;
            data?: { CategoriaId: number; Nombre: string };
            message?: string;
          }
        | null;

      if (!response.ok || !payload?.ok || !payload.data) {
        throw new Error(payload?.message || "No se pudo crear la categoria");
      }

      const created = { id: payload.data.CategoriaId, name: payload.data.Nombre };
      setCategories((prev) =>
        [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")),
      );
      setEditCategoryId(String(created.id));
      setCategorySearch(created.name);
      setShowCategorySuggestions(false);
      setNewCategoryName("");
      setShowCategoryCreator(false);
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Error creando categoria",
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  return (
    <motion.div className="screen products-modern-page">
      <header className="products-modern-header">
        <span className="products-modern-chip">Catalogo central</span>
        <div className="products-header-row">
          <h2>Administrar productos</h2>
          <button
            type="button"
            className="products-add-btn"
            onClick={openCreateModal}
          >
            Nuevo producto
          </button>
        </div>
        <p>
          Gestiona el catalogo, revisa historial de precios y actualiza la
          informacion de cada producto.
        </p>
      </header>

      <section className="products-modern-stats">
        <article className="products-modern-stat-card">
          <span>Total productos</span>
          <strong>{totalProducts}</strong>
        </article>
        <article className="products-modern-stat-card">
          <span>Marcas activas</span>
          <strong>{totalBrands}</strong>
        </article>
        <article className="products-modern-stat-card">
          <span>Categorias activas</span>
          <strong>{totalCategories}</strong>
        </article>
      </section>

      {error && <p className="purchase-error">{error}</p>}

      {loading && (
        <section className="products-modern-grid">
          {Array.from({ length: 6 }).map((_, index) => (
            <article className="products-skeleton-card" key={`skeleton-${index}`}>
              <div className="products-skeleton-thumb" />
              <div className="products-skeleton-lines">
                <span />
                <span />
                <span />
              </div>
            </article>
          ))}
        </section>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="products-empty-state">
          Aun no hay productos registrados en el catalogo.
        </div>
      )}

      {!loading && !error && products.length > 0 && (
        <motion.section
          className="products-modern-grid"
          variants={cardContainerVariants}
          initial="hidden"
          animate="visible"
        >
          {products.map((product) => (
            <motion.button
              key={product.id}
              className="product-card products-modern-card"
              type="button"
              onClick={() => {
                setSelectedProduct(product);
                setHistoryError(null);
              }}
              variants={cardItemVariants}
            >
              <div className="product-content">
                <div className="products-premium-media">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="product-image product-image-small"
                    />
                  ) : (
                    <div className="products-premium-media-empty">Sin imagen</div>
                  )}
                </div>

                <div className="product-info products-premium-body">
                  <div className="products-premium-top">
                    <strong className="products-premium-name">{product.name}</strong>
                    <span className="products-premium-id">#{product.id}</span>
                  </div>
                  <div className="products-premium-code">Codigo: {product.code}</div>
                  <div className="products-premium-tags">
                    <span className="products-premium-tag is-brand">
                      Marca: {product.brand || "Sin marca"}
                    </span>
                    <span className="products-premium-tag is-category">
                      Categoria: {product.category || "Sin categoria"}
                    </span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.section>
      )}

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

      {(editingProduct || createMode) && (
        <div
          className="modal-overlay modal-overlay-glass"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setCreateMode(false);
              setEditingProduct(null);
            }
          }}
        >
          <div className="modal product-edit-modal premium-glass-modal">
            <h3>{createMode ? "Nuevo producto" : "Modificar producto"}</h3>
            <p>
              {createMode
                ? "Escanea o ingresa el codigo de barras y completa los campos."
                : "Actualiza los campos del registro."}
            </p>

            <div className="form-group">
              <label>Codigo de barras</label>
              <div className="products-code-row">
                <input
                  value={editCode}
                  onChange={(e) => setEditCode(e.target.value)}
                  disabled={editLoading}
                  placeholder="Escanea o ingresa codigo"
                />
                {createMode && (
                  <button
                    type="button"
                    className="products-scan-btn"
                    onClick={() => {
                      setScanError(null);
                      setCameraActive(true);
                    }}
                    disabled={editLoading}
                  >
                    Escanear
                  </button>
                )}
              </div>
              {createMode && scanError && <small className="products-scan-error">{scanError}</small>}
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
              <div className="products-select-row">
                <div className="products-combobox">
                  <input
                    type="text"
                    className="products-search-input"
                    placeholder="Selecciona o escribe marca..."
                    value={brandSearch}
                    onFocus={() => setShowBrandSuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(() => setShowBrandSuggestions(false), 120);
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setBrandSearch(value);
                      setEditBrandId("");
                      setShowBrandSuggestions(true);
                    }}
                    disabled={editLoading}
                  />
                  {showBrandSuggestions && (
                    <div className="products-suggestions-list">
                      {filteredBrands.length === 0 && (
                        <div className="products-suggestion-empty">
                          Sin coincidencias
                        </div>
                      )}
                      {filteredBrands.map((row) => (
                        <button
                          type="button"
                          key={row.id}
                          className="products-suggestion-item"
                          onMouseDown={() => {
                            setEditBrandId(String(row.id));
                            setBrandSearch(row.name);
                            setShowBrandSuggestions(false);
                          }}
                        >
                          {row.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="products-add-catalog-btn"
                  onClick={() => setShowBrandCreator((prev) => !prev)}
                  disabled={editLoading || creatingBrand}
                  title="Agregar nueva marca"
                >
                  {showBrandCreator ? "×" : "+"}
                </button>
              </div>
              {showBrandCreator && (
                <div className="products-inline-create">
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={(e) => setNewBrandName(e.target.value)}
                    placeholder="Nombre de marca"
                    disabled={editLoading || creatingBrand}
                  />
                  <div className="products-inline-create-actions">
                    <button
                      type="button"
                      className="secondary-button products-inline-cancel"
                      onClick={() => {
                        setShowBrandCreator(false);
                        setNewBrandName("");
                      }}
                      disabled={editLoading || creatingBrand}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="product-save-btn products-inline-save"
                      onClick={createBrandFromModal}
                      disabled={editLoading || creatingBrand || !newBrandName.trim()}
                    >
                      {creatingBrand ? "Agregando..." : "Agregar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group">
              <label>Categoria</label>
              <div className="products-select-row">
                <div className="products-combobox">
                  <input
                    type="text"
                    className="products-search-input"
                    placeholder="Selecciona o escribe categoria..."
                    value={categorySearch}
                    onFocus={() => setShowCategorySuggestions(true)}
                    onBlur={() => {
                      window.setTimeout(
                        () => setShowCategorySuggestions(false),
                        120,
                      );
                    }}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCategorySearch(value);
                      setEditCategoryId("");
                      setShowCategorySuggestions(true);
                    }}
                    disabled={editLoading}
                  />
                  {showCategorySuggestions && (
                    <div className="products-suggestions-list">
                      {filteredCategories.length === 0 && (
                        <div className="products-suggestion-empty">
                          Sin coincidencias
                        </div>
                      )}
                      {filteredCategories.map((row) => (
                        <button
                          type="button"
                          key={row.id}
                          className="products-suggestion-item"
                          onMouseDown={() => {
                            setEditCategoryId(String(row.id));
                            setCategorySearch(row.name);
                            setShowCategorySuggestions(false);
                          }}
                        >
                          {row.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="products-add-catalog-btn"
                  onClick={() => setShowCategoryCreator((prev) => !prev)}
                  disabled={editLoading || creatingCategory}
                  title="Agregar nueva categoria"
                >
                  {showCategoryCreator ? "×" : "+"}
                </button>
              </div>
              {showCategoryCreator && (
                <div className="products-inline-create">
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de categoria"
                    disabled={editLoading || creatingCategory}
                  />
                  <div className="products-inline-create-actions">
                    <button
                      type="button"
                      className="secondary-button products-inline-cancel"
                      onClick={() => {
                        setShowCategoryCreator(false);
                        setNewCategoryName("");
                      }}
                      disabled={editLoading || creatingCategory}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className="product-save-btn products-inline-save"
                      onClick={createCategoryFromModal}
                      disabled={editLoading || creatingCategory || !newCategoryName.trim()}
                    >
                      {creatingCategory ? "Agregando..." : "Agregar"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!editImage && (
              <div className="form-group">
                <label>Imagen</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleEditImage}
                  disabled={editLoading}
                />
              </div>
            )}

            {editImage && (
              <div className="product-image-edit-row">
                <img
                  src={editImage}
                  alt={editName || "Preview"}
                  className="image-preview"
                />
                <button
                  className="secondary-button product-image-remove-btn"
                  onClick={() => setEditImage(null)}
                  disabled={editLoading}
                  type="button"
                >
                  Quitar imagen
                </button>
              </div>
            )}

            {editError && <p style={{ color: "#b91c1c" }}>{editError}</p>}

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setCameraActive(false);
                  setCreateMode(false);
                  setEditingProduct(null);
                }}
                disabled={editLoading}
              >
                Cancelar
              </button>

              <button
                className="product-save-btn"
                onClick={saveProductChanges}
                disabled={editLoading}
              >
                {editLoading
                  ? "Guardando..."
                  : createMode
                    ? "Crear producto"
                    : "Guardar cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createMode && cameraActive && (
        <div
          className="products-camera-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setCameraActive(false);
            }
          }}
        >
          <div className="products-camera-sheet">
            <div className="products-camera-sheet-header">
              <strong>Escanear codigo</strong>
              <button
                type="button"
                className="products-camera-close-btn"
                onClick={() => setCameraActive(false)}
              >
                Cerrar
              </button>
            </div>
            <div id="products-create-reader" className="products-camera-reader fullscreen" />
            {scanError && <small className="products-scan-error">{scanError}</small>}
          </div>
        </div>
      )}
    </motion.div>
  );
}
