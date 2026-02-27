import { useMemo, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import ScreenWrapper from "../components/ScreenWrapper";

type BarcodeCandidate = {
  code: string;
  count: number;
};

type ProductMatch = {
  id: string;
  code: string;
  name: string;
  brand: string;
  category: string;
  image?: string;
  count: number;
};

type OcrResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    content?: string;
    lines?: string[];
    barcodeCandidates?: BarcodeCandidate[];
  };
};

const fileToBase64 = async (file: File) => {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });

  return dataUrl.includes(",") ? (dataUrl.split(",")[1] ?? "") : dataUrl;
};

export default function ReceiptOcr() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [content, setContent] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [barcodeCandidates, setBarcodeCandidates] = useState<BarcodeCandidate[]>([]);
  const [matchedProducts, setMatchedProducts] = useState<ProductMatch[]>([]);

  const apiBase = import.meta.env.VITE_API_URL as string | undefined;

  const summaryText = useMemo(() => {
    if (!content) {
      return "Todavia no hay texto procesado.";
    }
    return content.length > 240 ? `${content.slice(0, 240)}...` : content;
  }, [content]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setError("");
    setContent("");
    setLines([]);
    setBarcodeCandidates([]);
    setMatchedProducts([]);

    if (!file) {
      setPreviewUrl("");
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAnalyze = async () => {
    if (!apiBase) {
      setError("No se encontro VITE_API_URL.");
      return;
    }

    if (!selectedFile) {
      setError("Selecciona una imagen primero.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const imageBase64 = await fileToBase64(selectedFile);
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

      const nextContent = String(payload.data?.content ?? "").trim();
      const nextLines = Array.isArray(payload.data?.lines) ? payload.data?.lines : [];
      const nextCandidates = Array.isArray(payload.data?.barcodeCandidates)
        ? payload.data?.barcodeCandidates
        : [];

      setContent(nextContent);
      setLines(nextLines);
      setBarcodeCandidates(nextCandidates);

      if (!nextCandidates.length) {
        setMatchedProducts([]);
        return;
      }

      const matches = await Promise.all(
        nextCandidates.slice(0, 12).map(async candidate => {
          const productResponse = await fetch(
            `${apiBase}/api/productos/codigo/${encodeURIComponent(candidate.code)}`,
          );

          if (!productResponse.ok) {
            return null;
          }

          const productPayload = (await productResponse.json()) as {
            ok?: boolean;
            data?: {
              id: string;
              code: string;
              name: string;
              brand: string;
              category: string;
              image?: string;
            };
          };

          if (!productPayload.ok || !productPayload.data) {
            return null;
          }

          return {
            ...productPayload.data,
            count: candidate.count,
          } satisfies ProductMatch;
        }),
      );

      setMatchedProducts(matches.filter((item): item is ProductMatch => item !== null));
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
            Esta prueba lee texto impreso desde una foto y busca secuencias numericas
            que parezcan codigos de barra para armar un carrito preliminar.
          </p>
        </header>

        <section className="ocr-card">
          <div className="ocr-upload-row">
            <label className="ocr-upload-box">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />
              <span>{selectedFile ? selectedFile.name : "Seleccionar imagen"}</span>
              <small>Usa una foto nítida donde el texto numerico se vea completo.</small>
            </label>

            <button
              type="button"
              className="products-add-btn"
              onClick={handleAnalyze}
              disabled={isLoading || !selectedFile}
            >
              {isLoading ? "Analizando..." : "Analizar imagen"}
            </button>
          </div>

          <div className="ocr-grid">
            <div className="ocr-panel">
              <h2>Vista previa</h2>
              {previewUrl ? (
                <div className="ocr-preview-wrap">
                  <img src={previewUrl} alt="Vista previa de boleta" className="ocr-preview" />
                </div>
              ) : (
                <div className="app-modern-empty">Aun no has cargado una imagen.</div>
              )}
            </div>

            <div className="ocr-panel">
              <h2>Resumen del analisis</h2>
              {isLoading ? (
                <div className="app-modern-loading">
                  <span className="app-modern-spinner" />
                  <p>Procesando imagen en Azure OCR...</p>
                </div>
              ) : (
                <div className="ocr-summary-box">{summaryText}</div>
              )}
              {error ? <p className="ocr-error">{error}</p> : null}
            </div>
          </div>
        </section>

        <section className="ocr-card">
          <div className="ocr-section-head">
            <h2>Codigos detectados</h2>
            <span>{barcodeCandidates.length} candidatos</span>
          </div>
          {barcodeCandidates.length ? (
            <div className="ocr-chip-list">
              {barcodeCandidates.map(candidate => (
                <span key={candidate.code} className="ocr-code-chip">
                  {candidate.code}
                  {candidate.count > 1 ? ` x${candidate.count}` : ""}
                </span>
              ))}
            </div>
          ) : (
            <div className="app-modern-empty">
              No se detectaron secuencias numericas tipo codigo de barras en el texto.
            </div>
          )}
        </section>

        <section className="ocr-card">
          <div className="ocr-section-head">
            <h2>Carrito preliminar</h2>
            <span>{matchedProducts.length} productos encontrados</span>
          </div>
          {matchedProducts.length ? (
            <div className="ocr-product-list">
              {matchedProducts.map(product => (
                <article key={`${product.id}-${product.code}`} className="ocr-product-item">
                  {product.image ? (
                    <img src={product.image} alt={product.name} className="ocr-product-image" />
                  ) : (
                    <div className="ocr-product-image ocr-product-fallback">Sin imagen</div>
                  )}
                  <div className="ocr-product-body">
                    <strong>{product.name}</strong>
                    <span>{product.brand || "Sin marca"}</span>
                    <small>{product.category || "Sin categoria"}</small>
                  </div>
                  <div className="ocr-product-meta">
                    <span>{product.code}</span>
                    <strong>x{product.count}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="app-modern-empty">
              Aun no hay coincidencias con el catalogo. Si quieres, luego podemos conectar
              este resultado al flujo de compra real.
            </div>
          )}
        </section>

        <section className="ocr-card">
          <div className="ocr-section-head">
            <h2>Lineas leidas</h2>
            <span>{lines.length} lineas</span>
          </div>
          {lines.length ? (
            <div className="ocr-lines">
              {lines.map((line, index) => (
                <div key={`${index}-${line}`} className="ocr-line-item">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="app-modern-empty">Todavia no hay lineas OCR para mostrar.</div>
          )}
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

