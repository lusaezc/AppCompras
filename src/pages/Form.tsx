import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { useLocation, useNavigate } from "react-router-dom";
import type { Product } from "../types/product";

type CartItem = {
  id: string;
  code: string;
  name?: string;
  description?: string;
  productId?: number;
  quantity: number;
  unitPrice: number;
};

type RecordItem = {
  userId: number;
  date: string;
  supermarketId?: number;
  branchId?: number;
};

type Supermarket = {
  SupermercadoId: number;
  Nombre: string;
  Logo?: string | null;
  Pais?: string | null;
  Activo?: boolean;
};

type Sucursal = {
  SucursalId: number;
  SupermercadoId: number;
  NombreSucursal: string;
  Direccion?: string | null;
  Comuna?: string | null;
  Region?: string | null;
  Latitud?: number | null;
  Longitud?: number | null;
  Activo?: boolean;
};

type Usuario = {
  UserId: number;
  Nombre: string;
  Email?: string | null;
  FechaRegistro?: string | null;
  NivelConfianza?: number | null;
  Activo?: boolean;
};

export default function Form() {
  const today = new Date().toISOString().split("T")[0];
  const navigate = useNavigate();
  const location = useLocation();

  const [person, setPerson] = useState("");
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosError, setUsuariosError] = useState<string | null>(null);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [date, setDate] = useState(today);
  const [showSuccess, setShowSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [supermarketId, setSupermarketId] = useState("");
  const [supermarkets, setSupermarkets] = useState<Supermarket[]>([]);
  const [supermarketError, setSupermarketError] = useState<string | null>(null);
  const [supermarketLoading, setSupermarketLoading] = useState(false);
  const [branchId, setBranchId] = useState("");
  const [branches, setBranches] = useState<Sucursal[]>([]);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [branchLoading, setBranchLoading] = useState(false);

  const [scanCode, setScanCode] = useState("");
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingQty, setPendingQty] = useState("");
  const [pendingPrice, setPendingPrice] = useState("");
  const [cartItems, setCartItems] = useState<CartItem[]>([]);

  const [cameraActive, setCameraActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const qrRef = useRef<Html5Qrcode | null>(null);
  const isStartingRef = useRef(false);

  const saveRecord = async (record: RecordItem) => {
    const apiBase = import.meta.env.VITE_API_URL as string | undefined;
    if (!apiBase) {
      setSaveError("No se encontro VITE_API_URL.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const itemsPayload = cartItems
      .filter((item) => item.productId)
      .map((item) => ({
        ProductoId: Number(item.productId),
        PrecioUnitario: Number(item.unitPrice),
        Cantidad: Number(item.quantity),
      }));

    if (itemsPayload.length === 0) {
      setIsSaving(false);
      setSaveError("No hay productos para guardar.");
      return;
    }

    try {
      const payload = {
        UserId: record.userId,
        FechaCompra: record.date,
        TotalCompra: cartTotal,
        SucursalId: record.branchId,
        Items: itemsPayload,
      };

      const response = await fetch(`${apiBase}/api/compras`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "Error guardando compra");
      }

      setShowSuccess(true);
      setCartItems([]);
      setPendingCode(null);
      setPendingProduct(null);
      setPendingQty("");
      setPendingPrice("");

      setTimeout(() => {
        setShowSuccess(false);
      }, 2500);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Error guardando compra",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const beginPendingProduct = useCallback(
    async (code: string) => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setScanError("No se encontro VITE_API_URL.");
        return;
      }

      try {
        const response = await fetch(
          `${apiBase}/api/productos/codigo/${encodeURIComponent(code)}`,
        );

        if (response.ok) {
          const payload = (await response.json()) as {
            ok: boolean;
            data?: Product;
            message?: string;
          };
          if (!payload.ok || !payload.data) {
            throw new Error(payload.message || "Producto no encontrado");
          }

          setPendingProduct(payload.data);
          setPendingCode(code);
          setPendingQty("");
          setPendingPrice("");
          return;
        }

        if (response.status === 404) {
          navigate(`/product-form/${code}?from=form`);
          return;
        }

        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Error ${response.status}`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Error consultando producto";
        setScanError(message);
      }
    },
    [navigate],
  );

  const handleScan = () => {
    const code = scanCode.trim();
    if (!code || pendingCode) return;
    setScanCode("");
    void beginPendingProduct(code);
  };

  const canAddPending =
    pendingCode && Number(pendingQty) > 0 && Number(pendingPrice) > 0;

  const addPendingToCart = () => {
    if (!pendingCode) return;
    const quantity = Number(pendingQty);
    const unitPrice = Number(pendingPrice);
    if (!(quantity > 0) || !(unitPrice > 0)) return;

    setCartItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        code: pendingCode,
        name: pendingProduct?.name,
        description: pendingProduct?.description,
        productId: pendingProduct?.id ? Number(pendingProduct.id) : undefined,
        quantity,
        unitPrice,
      },
    ]);

    setPendingCode(null);
    setPendingProduct(null);
    setPendingQty("");
    setPendingPrice("");
  };

  const removeItem = (id: string) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    if (!code || pendingCode) return;
    void beginPendingProduct(code);
  }, [beginPendingProduct, location.search, pendingCode]);

  useEffect(() => {
    let active = true;

    const loadUsuarios = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setUsuariosError("No se encontro VITE_API_URL.");
        return;
      }

      setUsuariosLoading(true);
      setUsuariosError(null);

      try {
        const response = await fetch(`${apiBase}/api/usuarios`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Usuario[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando usuarios");
        }

        if (active) {
          setUsuarios(payload.data);
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Error cargando usuarios";
        setUsuariosError(message);
      } finally {
        if (active) {
          setUsuariosLoading(false);
        }
      }
    };

    void loadUsuarios();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadSupermarkets = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setSupermarketError("No se encontro VITE_API_URL.");
        return;
      }

      setSupermarketLoading(true);
      setSupermarketError(null);

      try {
        const response = await fetch(`${apiBase}/api/supermercados`);
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Supermarket[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando supermercados");
        }

        if (active) {
          setSupermarkets(payload.data);
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error
            ? error.message
            : "Error cargando supermercados";
        setSupermarketError(message);
      } finally {
        if (active) {
          setSupermarketLoading(false);
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

    const loadBranches = async () => {
      const apiBase = import.meta.env.VITE_API_URL as string | undefined;
      if (!apiBase) {
        setBranchError("No se encontro VITE_API_URL.");
        return;
      }

      if (!supermarketId) {
        setBranches([]);
        setBranchError(null);
        return;
      }

      setBranchLoading(true);
      setBranchError(null);

      try {
        const response = await fetch(
          `${apiBase}/api/sucursales?supermercadoId=${encodeURIComponent(
            supermarketId,
          )}`,
        );
        if (!response.ok) {
          throw new Error(`Error ${response.status}`);
        }

        const payload = (await response.json()) as {
          ok: boolean;
          data?: Sucursal[];
          message?: string;
        };

        if (!payload.ok || !payload.data) {
          throw new Error(payload.message || "Error cargando sucursales");
        }

        if (active) {
          setBranches(payload.data);
        }
      } catch (error) {
        if (!active) return;
        const message =
          error instanceof Error ? error.message : "Error cargando sucursales";
        setBranchError(message);
      } finally {
        if (active) {
          setBranchLoading(false);
        }
      }
    };

    void loadBranches();

    return () => {
      active = false;
    };
  }, [supermarketId]);

  useEffect(() => {
    let isActive = true;

    const startCamera = async () => {
      if (!cameraActive || pendingCode) return;
      if (qrRef.current || isStartingRef.current) return;
      isStartingRef.current = true;
      setScanError(null);

      const mountEl = document.getElementById("form-reader");
      if (!mountEl) {
        setScanError("No se encontro el contenedor de la camara.");
        isStartingRef.current = false;
        return;
      }

      const qr = new Html5Qrcode("form-reader");
      qrRef.current = qr;

      try {
        await qr.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: 240 },
          (decodedText) => {
            if (!isActive || pendingCode) return;
            void beginPendingProduct(decodedText);
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

    const stopCamera = async () => {
      if (!qrRef.current) return;
      try {
        await qrRef.current.stop();
      } catch (error) {
        console.error("No se pudo detener la camara.", error);
      } finally {
        qrRef.current?.clear();
        qrRef.current = null;
      }
    };

    if (cameraActive && !pendingCode) {
      void startCamera();
    } else {
      void stopCamera();
    }

    return () => {
      isActive = false;
      void stopCamera();
    };
  }, [beginPendingProduct, cameraActive, pendingCode]);

  return (
    <motion.div className="screen">
      <h2>Nuevo registro</h2>

      <form className="form">
        <label>
          Persona
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            disabled={usuariosLoading}
          >
            <option value="">
              {usuariosLoading ? "Cargando..." : "Selecciona"}
            </option>
            {usuarios.map((usuario) => (
              <option key={usuario.UserId} value={usuario.UserId}>
                {usuario.Nombre}
              </option>
            ))}
          </select>
          {usuariosError && (
            <small style={{ color: "#b91c1c" }}>{usuariosError}</small>
          )}
        </label>

        <label>
          Supermercado
          <select
            value={supermarketId}
            onChange={(e) => {
              setSupermarketId(e.target.value);
              setBranchId("");
            }}
            disabled={supermarketLoading}
          >
            <option value="">
              {supermarketLoading ? "Cargando..." : "Selecciona"}
            </option>
            {supermarkets.map((market) => (
              <option key={market.SupermercadoId} value={market.SupermercadoId}>
                {market.Nombre}
              </option>
            ))}
          </select>
          {supermarketError && (
            <small style={{ color: "#b91c1c" }}>{supermarketError}</small>
          )}
        </label>

        <label>
          Sucursal
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            disabled={branchLoading || !supermarketId}
          >
            <option value="">
              {!supermarketId
                ? "Selecciona un supermercado"
                : branchLoading
                  ? "Cargando..."
                  : "Selecciona"}
            </option>
            {branches.map((branch) => (
              <option key={branch.SucursalId} value={branch.SucursalId}>
                {branch.NombreSucursal}
              </option>
            ))}
          </select>
          {branchError && (
            <small style={{ color: "#b91c1c" }}>{branchError}</small>
          )}
        </label>

        <label>
          Fecha
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled
            style={{ width: "100%" }}
          />
        </label>

        <div className="scan-section">
          <div className="scan-header">
            <h3>Escaneo de productos</h3>
            <p>
              Escanea o escribe el codigo. Ingresa cantidad y precio unitario
              antes de escanear otro producto.
            </p>
          </div>

          <div className="scan-input-row">
            <input
              type="text"
              placeholder="Codigo de barras"
              value={scanCode}
              disabled={Boolean(pendingCode)}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
            />
            <button
              type="button"
              className="scan-btn"
              onClick={handleScan}
              disabled={Boolean(pendingCode) || !scanCode.trim()}
            >
              Escanear
            </button>
          </div>

          <div className="camera-card">
            <div className="camera-header">
              <h4>Camara</h4>
              <button
                type="button"
                className="camera-toggle"
                onClick={() => setCameraActive((prev) => !prev)}
              >
                {cameraActive ? "Apagar" : "Encender"}
              </button>
            </div>
            {cameraActive && (
              <div
                id="form-reader"
                style={{
                  marginTop: 12,
                  width: "100%",
                  minHeight: 260,
                  background: "#111",
                  borderRadius: 12,
                }}
              />
            )}
            {!scanError && cameraActive && !pendingCode && (
              <p className="camera-helper">Apunta al codigo para escanear.</p>
            )}
            {scanError && <p className="camera-helper">{scanError}</p>}
          </div>

          {pendingCode && (
            <div className="scan-detail-card">
              <div className="scan-detail-title">Producto: {pendingCode}</div>
              {pendingProduct && (
                <div className="scan-product-meta">
                  <div className="scan-product-name">{pendingProduct.name}</div>
                  {pendingProduct.description && (
                    <div className="scan-product-desc">
                      {pendingProduct.description}
                    </div>
                  )}
                  {pendingProduct.image && (
                    <img
                      src={pendingProduct.image}
                      alt={pendingProduct.name}
                      className="scan-product-image"
                    />
                  )}
                </div>
              )}
              <div className="scan-detail-fields">
                <label>
                  Cantidad
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={pendingQty}
                    onChange={(e) => setPendingQty(e.target.value)}
                  />
                </label>
                <label>
                  Precio unitario
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={pendingPrice}
                    onChange={(e) => setPendingPrice(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="primary-button"
                onClick={addPendingToCart}
                disabled={!canAddPending}
              >
                Agregar al carrito
              </button>
            </div>
          )}
        </div>

        <div className="cart">
          <div className="cart-header">
            <h3>Carrito</h3>
            <span className="cart-count">{cartItems.length} items</span>
          </div>

          {cartItems.length === 0 ? (
            <p className="cart-empty">Aun no hay productos escaneados.</p>
          ) : (
            <div className="cart-list">
              {cartItems.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-info">
                    <div className="cart-item-code">
                      {item.name ? item.name : item.code}
                    </div>
                    {item.description && (
                      <div className="cart-item-desc">{item.description}</div>
                    )}
                    <div className="cart-item-meta">
                      <span>Cant: {item.quantity}</span>
                      <span>Unit: ${item.unitPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="cart-item-actions">
                    <div className="cart-item-total">
                      ${(item.quantity * item.unitPrice).toFixed(2)}
                    </div>
                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => removeItem(item.id)}
                    >
                      Quitar
                    </button>
                  </div>
                </div>
              ))}

              <div className="cart-summary">
                <span>Total</span>
                <span>${cartTotal.toFixed(2)}</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            saveRecord({
              userId: Number(person),
              date,
              supermarketId: supermarketId ? Number(supermarketId) : undefined,
              branchId: branchId ? Number(branchId) : undefined,
            })
          }
          disabled={
            isSaving ||
            !person ||
            !branchId ||
            cartItems.length === 0 ||
            Boolean(pendingCode)
          }
        >
          {isSaving ? "Guardando..." : "Guardar"}
        </button>
      </form>

      {saveError && (
        <div className="toast-success" style={{ background: "#b91c1c" }}>
          {saveError}
        </div>
      )}

      {showSuccess && (
        <div className="toast-success">Registro guardado correctamente</div>
      )}
    </motion.div>
  );
}
