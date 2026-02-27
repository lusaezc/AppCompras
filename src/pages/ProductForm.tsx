import { useEffect, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import SearchableSelect from "../components/SearchableSelect";

type CatalogItem = {
  id: number;
  name: string;
};

export default function ProductForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const apiBaseUrl = import.meta.env.VITE_API_URL as string | undefined;

  const [name, setName] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [brands, setBrands] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [newBrandName, setNewBrandName] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestTimeoutMs = 15000;

  useEffect(() => {
    let active = true;

    const loadCatalogs = async () => {
      if (!apiBaseUrl) {
        setCatalogError("No se encontro VITE_API_URL.");
        return;
      }
      setCatalogLoading(true);
      setCatalogError(null);
      try {
        const [brandsRes, categoriesRes] = await Promise.all([
          fetch(`${apiBaseUrl}/api/marcas`),
          fetch(`${apiBaseUrl}/api/categorias`),
        ]);

        if (!brandsRes.ok || !categoriesRes.ok) {
          throw new Error("No se pudieron cargar marcas y categorias");
        }

        const brandsPayload = (await brandsRes.json()) as {
          ok: boolean;
          data?: Array<{ MarcaId: number; Nombre: string }>;
          message?: string;
        };

        const categoriesPayload = (await categoriesRes.json()) as {
          ok: boolean;
          data?: Array<{ CategoriaId: number; Nombre: string }>;
          message?: string;
        };

        if (!brandsPayload.ok || !categoriesPayload.ok) {
          throw new Error(
            brandsPayload.message ||
              categoriesPayload.message ||
              "Error cargando catalogos",
          );
        }

        if (!active) return;

        setBrands(
          (brandsPayload.data ?? []).map((item) => ({
            id: item.MarcaId,
            name: item.Nombre,
          })),
        );

        setCategories(
          (categoriesPayload.data ?? []).map((item) => ({
            id: item.CategoriaId,
            name: item.Nombre,
          })),
        );
      } catch (error) {
        if (!active) return;
        setCatalogError(
          error instanceof Error ? error.message : "Error cargando catalogos",
        );
      } finally {
        if (active) {
          setCatalogLoading(false);
        }
      }
    };

    void loadCatalogs();

    return () => {
      active = false;
    };
  }, [apiBaseUrl]);

  const closeToast = () => {
    setSaved(false);
    setSaveError(null);
  };

  if (!code) {
    return <p>Codigo invalido</p>;
  }

  const handleImageCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const dataUrl = await resizeImageToDataUrl(file, 900, 0.75);
    setImage(dataUrl);
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
          const output = canvas.toDataURL("image/jpeg", quality);
          resolve(output);
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });

  const createBrand = async () => {
    if (!apiBaseUrl) {
      setSaveError("No se encontro VITE_API_URL.");
      return;
    }
    const finalName = newBrandName.trim();
    if (!finalName) return;

    setCreatingBrand(true);
    setSaveError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/marcas`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setBrandId(String(created.id));
      setNewBrandName("");
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Error creando marca");
    } finally {
      setCreatingBrand(false);
    }
  };

  const createCategory = async () => {
    if (!apiBaseUrl) {
      setSaveError("No se encontro VITE_API_URL.");
      return;
    }
    const finalName = newCategoryName.trim();
    if (!finalName) return;

    setCreatingCategory(true);
    setSaveError(null);
    try {
      const response = await fetch(`${apiBaseUrl}/api/categorias`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      const created = {
        id: payload.data.CategoriaId,
        name: payload.data.Nombre,
      };
      setCategories((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "es")));
      setCategoryId(String(created.id));
      setNewCategoryName("");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Error creando categoria",
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const saveProduct = async () => {
    if (!apiBaseUrl) {
      setSaveError("No se encontro VITE_API_URL.");
      return;
    }
    if (!name.trim()) return;
    if (!brandId || !categoryId) {
      setSaveError("Selecciona marca y categoria");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, requestTimeoutMs);

    try {
      const payload = {
        CodigoBarra: code,
        NombreProducto: name.trim(),
        MarcaId: Number(brandId),
        CategoriaId: Number(categoryId),
        Imagen: image ?? null,
        Activo: true,
      };

      const response = await fetch(`${apiBaseUrl}/api/productos`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Error guardando producto");
      }

      setSaved(true);
      if (from === "form") {
        navigate(`/form?code=${code}`);
      }
    } catch (error) {
      setSaved(false);
      setSaveError(
        error instanceof Error
          ? error.name === "AbortError"
            ? "Tiempo de espera agotado. Verifica que la API este disponible."
            : error.message
          : "No se pudo guardar. Intenta con una imagen mas liviana o sin imagen.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsSaving(false);
    }
  };

  return (
    <motion.div className="screen product-form-page">
      <div className="product-form-card">
        <div className="product-form-header">
          <h2 className="product-form-title">Nuevo producto</h2>
          <p className="product-form-subtitle">
            Completa los datos para registrar.
          </p>
        </div>

        <div className="product-form-body">
          <label className="product-form-label">Codigo</label>
          <input value={code} disabled className="product-form-input" />

          <label className="product-form-label">Nombre</label>
          <input
            placeholder="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSaving}
            className="product-form-input"
          />

          <label className="product-form-label">Marca</label>
          <SearchableSelect
            value={brandId}
            onChange={setBrandId}
            disabled={isSaving || catalogLoading}
            className="product-form-searchable"
            placeholder="Selecciona marca"
            options={brands.map((brand) => ({
              value: String(brand.id),
              label: brand.name,
            }))}
          />

          <div className="product-form-inline-row">
            <input
              placeholder="Nueva marca"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              disabled={isSaving || creatingBrand}
              className="product-form-input"
            />
            <button
              type="button"
              onClick={createBrand}
              disabled={!newBrandName.trim() || creatingBrand || isSaving}
              className="product-form-secondary"
            >
              {creatingBrand ? "Creando..." : "Agregar marca"}
            </button>
          </div>

          <label className="product-form-label">Categoria</label>
          <SearchableSelect
            value={categoryId}
            onChange={setCategoryId}
            disabled={isSaving || catalogLoading}
            className="product-form-searchable"
            placeholder="Selecciona categoria"
            options={categories.map((category) => ({
              value: String(category.id),
              label: category.name,
            }))}
          />

          <div className="product-form-inline-row">
            <input
              placeholder="Nueva categoria"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              disabled={isSaving || creatingCategory}
              className="product-form-input"
            />
            <button
              type="button"
              onClick={createCategory}
              disabled={
                !newCategoryName.trim() || creatingCategory || isSaving
              }
              className="product-form-secondary"
            >
              {creatingCategory ? "Creando..." : "Agregar categoria"}
            </button>
          </div>

          <div className="product-form-file">
            <label className="product-form-label">Imagen</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageCapture}
              disabled={isSaving}
            />
          </div>

          {catalogError && <p className="product-form-error">{catalogError}</p>}

          {image && (
            <div className="product-form-preview">
              <img
                src={image}
                alt={name || "Preview"}
                className="product-form-preview-img"
              />
            </div>
          )}
        </div>

        <div className="product-form-actions">
          <button
            onClick={saveProduct}
            disabled={isSaving}
            className="product-form-primary"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>

          {isSaving && (
            <p className="product-form-status">
              Procesando, por favor espera...
            </p>
          )}
        </div>
      </div>
      {(saved || saveError) && (
        <div
          className="center-toast-overlay"
          role="status"
          aria-live="polite"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeToast();
            }
          }}
        >
          <div
            className={`center-toast ${saved ? "success" : "error"}`}
            aria-atomic="true"
          >
            <div className="center-toast-icon" aria-hidden="true">
              {saved ? "✓" : "!"}
            </div>
            <div className="center-toast-title">
              {saved ? "Producto guardado" : "No se pudo guardar"}
            </div>
            <div className="center-toast-body">
              {saved
                ? "Producto guardado correctamente."
                : saveError ||
                  "Intenta nuevamente o guarda sin imagen si pesa demasiado."}
            </div>
            <div className="center-toast-actions">
              <button onClick={closeToast} className="center-toast-button">
                Cerrar
              </button>
              <button
                onClick={() => navigate("/")}
                className="center-toast-button"
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
