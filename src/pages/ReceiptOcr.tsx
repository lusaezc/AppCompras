import { useEffect, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";

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
  };
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

export default function ReceiptOcr() {
  const [selectedFileName, setSelectedFileName] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [imageBase64, setImageBase64] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);

  const apiBase = import.meta.env.VITE_API_URL as string | undefined;

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

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setError("");
    setReceiptItems([]);

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
            <span>
              {receiptItems.length} articulos
            </span>
          </div>
          {receiptItems.length ? (
            <div className="ocr-table-wrap">
              <table className="ocr-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Articulo</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptItems.map((item, index) => (
                    <tr key={`${item.code ?? "sin-codigo"}-${item.name ?? "articulo"}-${index}`}>
                      <td>{String(item.code ?? "").trim() || "-"}</td>
                      <td>{String(item.name ?? "").trim() || "-"}</td>
                      <td>
                        {typeof item.quantity === "number" ? item.quantity : "-"}
                      </td>
                      <td>{formatCurrency(item.price)}</td>
                      <td>{formatCurrency(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {!receiptItems.length ? (
            <div className="app-modern-empty">
              Azure no detecto articulos estructurados en la boleta.
            </div>
          ) : null}
        </section>

        <div className="ocr-footer-actions">
          <Link to="/" className="home-secondary">
            Volver al inicio
          </Link>
        </div>
      </div>
    </ScreenWrapper>
  );
}
