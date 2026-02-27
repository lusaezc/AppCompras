import { useEffect, useRef, useState } from "react";
import ScreenWrapper from "../components/ScreenWrapper";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

export default function Scanner() {
  const navigate = useNavigate();
  const qrRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);
  const hasScannedRef = useRef(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const safelyReleaseScanner = (qr: Html5Qrcode) => {
    void qr
      .stop()
      .catch(() => {})
      .finally(() => {
        try {
          qr.clear();
        } catch {
          // Ignora errores al desmontar para no romper la navegacion.
        }
      });
  };

  useEffect(() => {
    let isActive = true;

    const startScanner = async () => {
      if (qrRef.current || isStartingRef.current) return;
      isStartingRef.current = true;
      setScanError(null);

      const mountEl = document.getElementById("reader");
      if (!mountEl) {
        setScanError("No se encontro el contenedor de la camara.");
        isStartingRef.current = false;
        return;
      }

      const qr = new Html5Qrcode("reader");
      qrRef.current = qr;

      const stopAndNavigate = (path: string) => {
        safelyReleaseScanner(qr);
        qrRef.current = null;
        navigate(path);
      };

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 250 },
          (decodedText) => {
            if (!isActive || hasScannedRef.current) return;
            hasScannedRef.current = true;

            const checkProduct = async () => {
              const apiBase = import.meta.env.VITE_API_URL as
                | string
                | undefined;
              if (!apiBase) {
                setScanError("No se encontro VITE_API_URL.");
                hasScannedRef.current = false;
                return;
              }

              try {
                const response = await fetch(
                  `${apiBase}/api/productos/codigo/${encodeURIComponent(
                    decodedText,
                  )}`,
                );

                if (response.ok) {
                  stopAndNavigate(`/product-detail/${decodedText}`);
                  return;
                }

                if (response.status === 404) {
                  stopAndNavigate(`/product-form/${decodedText}`);
                  return;
                }

                const payload = await response.json().catch(() => null);
                throw new Error(payload?.message || `Error ${response.status}`);
              } catch (err) {
                const message =
                  err instanceof Error
                    ? err.message
                    : "Error consultando producto";
                setScanError(message);
                hasScannedRef.current = false;
              }
            };

            void checkProduct();
          },
          () => {},
        );
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err || "Error");
        if (message.includes("NotReadableError")) {
          setScanError(
            "No se pudo iniciar la camara. Cierra otras apps que la esten usando y reintenta.",
          );
        } else {
          setScanError("No se pudo iniciar la camara. Intenta nuevamente.");
        }
      } finally {
        isStartingRef.current = false;
      }
    };

    const timer = setTimeout(() => {
      void startScanner();
    }, 0);

    return () => {
      isActive = false;
      hasScannedRef.current = false;
      clearTimeout(timer);
      if (qrRef.current) {
        safelyReleaseScanner(qrRef.current);
        qrRef.current = null;
      }
    };
  }, [navigate]);

  return (
    <ScreenWrapper className="scanner-screen">
      <div className="scanner-fullscreen-overlay">
        <div className="scanner-fullscreen-shell">
          <div className="scanner-fullscreen-header">
            <strong>Escanear codigo</strong>
            <button
              type="button"
              className="scanner-fullscreen-close-btn"
              onClick={() => navigate("/")}
            >
              Cerrar
            </button>
          </div>

          <div className="scanner-reader-wrap scanner-reader-wrap-fullscreen">
            <div id="reader" className="scanner-reader scanner-reader-fullscreen" />
            <div className="scanner-frame" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>

          <p className={["scanner-message", scanError ? "is-error" : "is-helper"].join(" ")} role="status">
            {scanError ||
              "Escaneando: al detectar un codigo se abrira el detalle o el formulario del producto."}
          </p>
        </div>
      </div>
    </ScreenWrapper>
  );
}
