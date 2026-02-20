import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ProductForm() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const from = params.get("from");
  const apiBaseUrl = import.meta.env.VITE_API_URL || "http://localhost:3001";

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const requestTimeoutMs = 15000;
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

  const saveProduct = async () => {
    if (!name.trim()) return;
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
        Marca: brand.trim() || null,
        Categoria: category.trim() || null,
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
          <input
            placeholder="Marca"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            disabled={isSaving}
            className="product-form-input"
          />

          <label className="product-form-label">Categoria</label>
          <input
            placeholder="Categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isSaving}
            className="product-form-input"
          />

          <div className="product-form-file">
            <label className="product-form-label">Imagen</label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageCapture}
              disabled={isSaving}
            />
          </div>


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
