import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";
import SearchableSelect from "../components/SearchableSelect";

type ReceiptCurrency = {
  amount?: number | null;
  currencyCode?: string | null;
  symbol?: string | null;
  confidence?: number | null;
};

type ReceiptItem = {
  code?: string | null;
  name?: string | null;
  quantity?: number | null;
  price?: ReceiptCurrency | null;
  totalPrice?: ReceiptCurrency | null;
};

type OcrResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    receiptItems?: ReceiptItem[];
    summary?: {
      discount?: ReceiptCurrency | null;
      tax?: ReceiptCurrency | null;
      total?: ReceiptCurrency | null;
    } | null;
  };
};

type ProductLookup = {
  id?: string;
  code?: string;
  name?: string;
  brand?: string;
  category?: string;
  image?: string;
};

type CatalogItem = {
  id: number;
  name: string;
};

type StoredDraft = {
  fileName: string;
  imageDataUrl: string;
};

const OCR_DRAFT_KEY = "receipt_ocr_draft";

const fileToDataUrl = async (file: File) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

  return dataUrl;
};

const dataUrlToBase64 = (dataUrl: string) =>
  dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;

const shouldHideReceiptItem = (item: ReceiptItem) =>
  String(item.name ?? "").trim().toLowerCase().startsWith("club unimarc");

export default function ReceiptOcr() {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [receiptSummary, setReceiptSummary] = useState<{
    discount?: ReceiptCurrency | null;
    tax?: ReceiptCurrency | null;
    total?: ReceiptCurrency | null;
  } | null>(null);
  const [productStatusByCode, setProductStatusByCode] = useState<
    Record<string, "exists" | "missing" | "unknown">
  >({});
  const [productDataByCode, setProductDataByCode] = useState<
    Record<string, ProductLookup>
  >({});
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<ReceiptItem | null>(null);
  const [modalName, setModalName] = useState("");
  const [modalBrandId, setModalBrandId] = useState("");
  const [modalCategoryId, setModalCategoryId] = useState("");
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [saveProductError, setSaveProductError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "exists" | "missing" | "without_code"
  >("all");
  const [sortMode, setSortMode] = useState<"status" | "name" | "total_desc">(
    "status",
  );

  const apiBase = import.meta.env.VITE_API_URL as string | undefined;
  const filteredReceiptItems = receiptItems.filter(
    (item) => !shouldHideReceiptItem(item),
  );

  const formatCurrency = (value?: ReceiptCurrency | null) => {
    if (typeof value?.amount !== "number") {
      return "-";
    }

    const symbol = String(value.symbol ?? "").trim();
    const currencyCode = String(value.currencyCode ?? "").trim();

    if (symbol) {
      return `${symbol}${value.amount}`;
    }

    if (currencyCode) {
      return `${currencyCode} ${value.amount}`;
    }

    return String(value.amount);
  };

  const getStatusForItem = (item: ReceiptItem) => {
    const code = String(item.code ?? "").trim();

    if (!code) {
      return "without_code" as const;
    }

    return productStatusByCode[code] ?? "unknown";
  };

  const existingCount = filteredReceiptItems.filter(
    (item) => getStatusForItem(item) === "exists",
  ).length;
  const missingCount = filteredReceiptItems.filter(
    (item) => getStatusForItem(item) === "missing",
  ).length;
  const withoutCodeCount = filteredReceiptItems.filter(
    (item) => getStatusForItem(item) === "without_code",
  ).length;
  const visibleReceiptItems = [...filteredReceiptItems]
    .filter((item) => {
      if (statusFilter === "all") {
        return true;
      }

      return getStatusForItem(item) === statusFilter;
    })
    .sort((left, right) => {
      if (sortMode === "name") {
        return String(left.name ?? "").localeCompare(String(right.name ?? ""), "es");
      }

      if (sortMode === "total_desc") {
        const leftAmount =
          typeof left.totalPrice?.amount === "number" ? left.totalPrice.amount : -1;
        const rightAmount =
          typeof right.totalPrice?.amount === "number" ? right.totalPrice.amount : -1;
        return rightAmount - leftAmount;
      }

      const order = {
        missing: 0,
        unknown: 1,
        without_code: 2,
        exists: 3,
      } as const;

      const leftStatus = getStatusForItem(left);
      const rightStatus = getStatusForItem(right);
      const leftRank = order[leftStatus];
      const rightRank = order[rightStatus];

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return String(left.name ?? "").localeCompare(String(right.name ?? ""), "es");
    });

  const loadProductStatuses = async (items: ReceiptItem[]) => {
    const uniqueCodes = [...new Set(
      items
        .map((item) => String(item.code ?? "").trim())
        .filter(Boolean),
    )];

    if (!uniqueCodes.length || !apiBase) {
      setProductStatusByCode({});
      setProductDataByCode({});
      return;
    }

    const entries = await Promise.all(
      uniqueCodes.map(async (code) => {
        try {
          const response = await fetch(
            `${apiBase}/api/productos/codigo/${encodeURIComponent(code)}`,
          );

          if (!response.ok) {
            return [code, "missing", null] as const;
          }

          const payload = (await response.json()) as {
            ok?: boolean;
            data?: ProductLookup;
          };

          if (!payload.ok || !payload.data) {
            return [code, "missing", null] as const;
          }

          return [code, "exists", payload.data] as const;
        } catch {
          return [code, "unknown", null] as const;
        }
      }),
    );

    const nextStatuses: Record<string, "exists" | "missing" | "unknown"> = {};
    const nextProducts: Record<string, ProductLookup> = {};

    for (const [code, status, data] of entries) {
      nextStatuses[code] = status;
      if (data) {
        nextProducts[code] = data;
      }
    }

    setProductStatusByCode(nextStatuses);
    setProductDataByCode(nextProducts);
  };

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(OCR_DRAFT_KEY);
      if (!raw) {
        return;
      }

      const draft = JSON.parse(raw) as Partial<StoredDraft>;
      const imageDataUrl = String(draft.imageDataUrl ?? "").trim();
      if (!imageDataUrl) {
        return;
      }

      setSelectedFileName(String(draft.fileName ?? "Foto capturada"));
      setPreviewUrl(imageDataUrl);
      setImageBase64(dataUrlToBase64(imageDataUrl));
    } catch {
      sessionStorage.removeItem(OCR_DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const loadCatalogs = async () => {
      if (!apiBase) {
        return;
      }

      try {
        const [brandsRes, categoriesRes] = await Promise.all([
          fetch(`${apiBase}/api/marcas`),
          fetch(`${apiBase}/api/categorias`),
        ]);

        if (!brandsRes.ok || !categoriesRes.ok) {
          throw new Error("No se pudieron cargar marcas y categorias");
        }

        const brandsPayload = (await brandsRes.json()) as {
          ok?: boolean;
          data?: Array<{ MarcaId: number; Nombre: string }>;
        };
        const categoriesPayload = (await categoriesRes.json()) as {
          ok?: boolean;
          data?: Array<{ CategoriaId: number; Nombre: string }>;
        };

        if (!active || !brandsPayload.ok || !categoriesPayload.ok) {
          return;
        }

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
        setCatalogError(null);
      } catch (catalogLoadError) {
        if (!active) {
          return;
        }

        setCatalogError(
          catalogLoadError instanceof Error
            ? catalogLoadError.message
            : "No se pudieron cargar marcas y categorias",
        );
      }
    };

    void loadCatalogs();

    return () => {
      active = false;
    };
  }, [apiBase]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setReceiptItems([]);
    setReceiptSummary(null);
    setProductStatusByCode({});
    setProductDataByCode({});
    setStatusFilter("all");

    if (!file) {
      return;
    }

    try {
      const imageDataUrl = await fileToDataUrl(file);
      const nextFileName = file.name || "Foto capturada";

      setSelectedFileName(nextFileName);
      setPreviewUrl(imageDataUrl);
      setImageBase64(dataUrlToBase64(imageDataUrl));

      const draft: StoredDraft = {
        fileName: nextFileName,
        imageDataUrl,
      };
      sessionStorage.setItem(OCR_DRAFT_KEY, JSON.stringify(draft));
    } catch (fileError) {
      setError(
        fileError instanceof Error
          ? fileError.message
          : "No se pudo cargar la imagen.",
      );
    } finally {
      event.target.value = "";
    }
  };

  const handleAnalyze = async () => {
    if (!apiBase) {
      setError("No se encontro VITE_API_URL.");
      return;
    }

    if (!imageBase64) {
      setError("Selecciona una imagen o toma una foto primero.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const response = await fetch(`${apiBase}/api/ocr/read`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageBase64 }),
      });

      const payload = (await response.json()) as OcrResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "No se pudo analizar la imagen.");
      }

      const nextReceiptItems = Array.isArray(payload.data?.receiptItems)
        ? payload.data?.receiptItems
        : [];
      setReceiptItems(nextReceiptItems);
      setReceiptSummary(payload.data?.summary ?? null);
      await loadProductStatuses(nextReceiptItems);
    } catch (analysisError) {
      setError(
        analysisError instanceof Error
          ? analysisError.message
          : "No se pudo analizar la imagen.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateProductModal = (item: ReceiptItem) => {
    setModalItem(item);
    setModalName(String(item.name ?? "").trim());
    setModalBrandId("");
    setModalCategoryId("");
    setSaveProductError(null);
  };

  const closeCreateProductModal = () => {
    if (isSavingProduct) {
      return;
    }

    setModalItem(null);
    setModalName("");
    setModalBrandId("");
    setModalCategoryId("");
    setSaveProductError(null);
  };

  const saveProductFromModal = async () => {
    const code = String(modalItem?.code ?? "").trim();

    if (!apiBase) {
      setSaveProductError("No se encontro VITE_API_URL.");
      return;
    }

    if (!code) {
      setSaveProductError("El articulo no tiene codigo para registrarlo.");
      return;
    }

    if (!modalName.trim()) {
      setSaveProductError("Debes ingresar un nombre para el producto.");
      return;
    }

    if (!modalBrandId || !modalCategoryId) {
      setSaveProductError("Selecciona marca y categoria.");
      return;
    }

    setIsSavingProduct(true);
    setSaveProductError(null);

    try {
      const response = await fetch(`${apiBase}/api/productos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          CodigoBarra: code,
          NombreProducto: modalName.trim(),
          MarcaId: Number(modalBrandId),
          CategoriaId: Number(modalCategoryId),
          Imagen: null,
          Activo: true,
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
      } | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "No se pudo registrar el producto.");
      }

      setProductStatusByCode((current) => ({
        ...current,
        [code]: "exists",
      }));
      setProductDataByCode((current) => ({
        ...current,
        [code]: {
          code,
          name: modalName.trim(),
        },
      }));
      closeCreateProductModal();
    } catch (saveError) {
      setSaveProductError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar el producto.",
      );
    } finally {
      setIsSavingProduct(false);
    }
  };

  return (
    <ScreenWrapper className="ocr-page">
      <div className="ocr-shell">
        <header className="ocr-hero">
          <span className="products-modern-chip">Laboratorio OCR</span>
          <h1>Analiza una boleta con Azure OCR</h1>
          <p>
            Toma una foto o adjunta una imagen de la boleta. El sistema intentara
            detectar codigos numericos y buscar coincidencias en tu catalogo.
          </p>
        </header>

        <section className="ocr-card">
          <div className="ocr-upload-row">
            <div className="ocr-upload-actions">
              <label className="ocr-upload-box ocr-upload-trigger">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(event) => {
                    void handleFileChange(event);
                  }}
                />
                <span>Tomar foto</span>
                <small>Abre la camara del dispositivo.</small>
              </label>

              <label className="ocr-upload-box ocr-upload-trigger">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    void handleFileChange(event);
                  }}
                />
                <span>Adjuntar imagen</span>
                <small>Selecciona una foto existente.</small>
              </label>
            </div>

            <button
              type="button"
              className="products-add-btn"
              onClick={handleAnalyze}
              disabled={isLoading || !imageBase64}
            >
              {isLoading ? "Analizando..." : "Analizar imagen"}
            </button>
          </div>

          <div className="ocr-panel">
            <div className="ocr-section-head">
              <h2>Vista previa</h2>
              <span>{selectedFileName || "Sin imagen"}</span>
            </div>
            {isLoading ? (
              <div className="app-modern-loading">
                <span className="app-modern-spinner" />
                <p>Procesando imagen en Azure OCR...</p>
              </div>
            ) : previewUrl ? (
              <div className="ocr-preview-wrap">
                <img src={previewUrl} alt="Vista previa de boleta" className="ocr-preview" />
              </div>
            ) : (
              <div className="app-modern-empty">Aun no has cargado una imagen.</div>
            )}
            {error ? <p className="ocr-error">{error}</p> : null}
          </div>
        </section>

        <section className="ocr-card">
          <div className="ocr-section-head">
            <h2>Articulos detectados</h2>
            <span>{filteredReceiptItems.length} articulos</span>
          </div>
          {filteredReceiptItems.length ? (
            <div className="ocr-results-shell">
              <div className="ocr-results-toolbar">
                <div className="ocr-table-summary">
                <button
                  type="button"
                  className={`ocr-summary-pill ${statusFilter === "exists" ? "is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter((current) =>
                      current === "exists" ? "all" : "exists",
                    );
                  }}
                >
                  {existingCount} en base
                </button>
                <button
                  type="button"
                  className={`ocr-summary-pill is-warn ${statusFilter === "missing" ? "is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter((current) =>
                      current === "missing" ? "all" : "missing",
                    );
                  }}
                >
                  {missingCount} por agregar
                </button>
                <button
                  type="button"
                  className={`ocr-summary-pill is-muted ${statusFilter === "without_code" ? "is-active" : ""}`}
                  onClick={() => {
                    setStatusFilter((current) =>
                      current === "without_code" ? "all" : "without_code",
                    );
                  }}
                >
                  {withoutCodeCount} sin codigo
                </button>
                </div>

                <button
                  type="button"
                  className="ocr-sort-btn"
                  onClick={() => {
                    setSortMode((current) => {
                      if (current === "status") {
                        return "name";
                      }
                      if (current === "name") {
                        return "total_desc";
                      }
                      return "status";
                    });
                  }}
                >
                  Ordenar:{" "}
                  {sortMode === "status"
                    ? "Estado"
                    : sortMode === "name"
                      ? "Nombre"
                      : "Total"}
                </button>
              </div>

              <div className="ocr-table-wrap">
              <table className="ocr-table">
                <thead>
                  <tr>
                    <th>Foto</th>
                    <th>Codigo</th>
                    <th>Articulo</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReceiptItems.map((item, index) => {
                    const status = getStatusForItem(item);
                    const code = String(item.code ?? "").trim();
                    const productData = code ? productDataByCode[code] : undefined;
                    const displayName = String(
                      productData?.name ?? item.name ?? "",
                    ).trim();
                    const displayBrand = String(productData?.brand ?? "").trim();
                    const displayCategory = String(productData?.category ?? "").trim();
                    const displayImage = String(productData?.image ?? "").trim();
                    const hasQuantity = typeof item.quantity === "number";
                    const hasPrice = typeof item.price?.amount === "number";
                    const hasTotal = typeof item.totalPrice?.amount === "number";

                    return (
                      <tr
                        key={`${item.code ?? "sin-codigo"}-${item.name ?? "articulo"}-${index}`}
                        className={`ocr-table-row is-${status}`}
                      >
                        <td data-label="">
                          {displayImage ? (
                            <img
                              src={displayImage}
                              alt={displayName || "Producto"}
                              className="ocr-table-image"
                            />
                          ) : (
                            <div className="ocr-table-image ocr-table-image-fallback">
                              Sin foto
                            </div>
                          )}
                        </td>
                        <td data-label="">
                          <span className={code ? "ocr-code-text" : "ocr-cell-muted"}>
                            {code || "-"}
                          </span>
                        </td>
                        <td data-label="">
                          <div className="ocr-item-meta">
                            {status === "exists" ? (
                              <span
                                className="ocr-item-corner-badge is-success"
                                aria-label="Producto en base"
                                title="Producto en base"
                              >
                                ✓
                              </span>
                            ) : null}
                            {status === "missing" ? (
                              <button
                                type="button"
                                className="ocr-item-corner-badge ocr-add-product-icon-btn"
                                onClick={() => {
                                  openCreateProductModal(item);
                                }}
                                aria-label="Agregar producto"
                                title="Agregar producto"
                              >
                                +
                              </button>
                            ) : null}
                            <span className={displayName ? "ocr-item-name" : "ocr-cell-muted"}>
                              {displayName || "-"}
                            </span>
                            <span
                              className={
                                displayBrand || displayCategory
                                  ? "ocr-item-subtitle"
                                  : "ocr-cell-muted"
                              }
                            >
                              {displayBrand || displayCategory
                                ? [displayBrand || "Sin marca", displayCategory || "Sin categoria"].join(" · ")
                                : "Sin datos de catalogo"}
                            </span>
                          </div>
                        </td>
                        <td
                          data-label="Cantidad"
                          className={`ocr-cell-number ${hasQuantity ? "" : "ocr-table-cell-hidden"}`}
                        >
                          {hasQuantity ? item.quantity : ""}
                        </td>
                        <td
                          data-label="Precio"
                          className={`ocr-cell-number ${hasPrice ? "" : "ocr-table-cell-hidden"}`}
                        >
                          <span
                            className={
                              hasPrice
                                ? "ocr-currency-text"
                                : "ocr-cell-muted"
                            }
                          >
                            {hasPrice ? formatCurrency(item.price) : ""}
                          </span>
                        </td>
                        <td data-label="Total" className="ocr-cell-number">
                          <span
                            className={
                              hasTotal
                                ? "ocr-currency-text is-strong ocr-total-pill"
                                : "ocr-cell-muted"
                            }
                          >
                            {hasTotal ? formatCurrency(item.totalPrice) : ""}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {visibleReceiptItems.length === 0 ? (
                <div className="ocr-filter-empty">
                  No hay articulos para el filtro seleccionado.
                </div>
              ) : null}
            </div>
              {receiptSummary ? (
                <div className="ocr-summary-totals">
                  <div className="ocr-summary-total-row">
                    <span>Descuento</span>
                    <strong>{formatCurrency(receiptSummary.discount)}</strong>
                  </div>
                  <div className="ocr-summary-total-row">
                    <span>IVA</span>
                    <strong>{formatCurrency(receiptSummary.tax)}</strong>
                  </div>
                  <div className="ocr-summary-total-row is-grand">
                    <span>Total</span>
                    <strong>{formatCurrency(receiptSummary.total)}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {!receiptItems.length ? (
            <div className="app-modern-empty">
              Azure no detecto articulos estructurados en la boleta.
            </div>
          ) : null}
          {receiptItems.length > 0 && !filteredReceiptItems.length ? (
            <div className="app-modern-empty">
              Los articulos detectados fueron omitidos por la regla de filtrado.
            </div>
          ) : null}
        </section>

        <div className="ocr-footer-actions">
          <Link to="/" className="home-secondary">
            Volver al inicio
          </Link>
        </div>

        {modalItem ? (
          <div
            className="modal-overlay modal-overlay-glass"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                closeCreateProductModal();
              }
            }}
          >
            <div className="modal product-edit-modal premium-glass-modal">
              <h3>Registrar producto</h3>
              <p>Completa los datos para agregar este articulo a tu base.</p>

              <div className="form-group">
                <label>Codigo</label>
                <input
                  value={String(modalItem.code ?? "").trim()}
                  disabled
                />
              </div>

              <div className="form-group">
                <label>Nombre</label>
                <input
                  value={modalName}
                  onChange={(event) => setModalName(event.target.value)}
                  disabled={isSavingProduct}
                />
              </div>

              <div className="form-group">
                <label>Marca</label>
                <SearchableSelect
                  value={modalBrandId}
                  onChange={setModalBrandId}
                  disabled={isSavingProduct}
                  placeholder="Selecciona marca"
                  options={brands.map((brand) => ({
                    value: String(brand.id),
                    label: brand.name,
                  }))}
                />
              </div>

              <div className="form-group">
                <label>Categoria</label>
                <SearchableSelect
                  value={modalCategoryId}
                  onChange={setModalCategoryId}
                  disabled={isSavingProduct}
                  placeholder="Selecciona categoria"
                  options={categories.map((category) => ({
                    value: String(category.id),
                    label: category.name,
                  }))}
                />
              </div>

              {catalogError ? <p className="ocr-error">{catalogError}</p> : null}
              {saveProductError ? <p className="ocr-error">{saveProductError}</p> : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={closeCreateProductModal}
                  disabled={isSavingProduct}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="product-save-btn"
                  onClick={saveProductFromModal}
                  disabled={isSavingProduct}
                >
                  {isSavingProduct ? "Guardando..." : "Registrar"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </ScreenWrapper>
  );
}
