import ScreenWrapper from "../components/ScreenWrapper";
import { Link } from "react-router-dom";

export default function Home() {
  return (
    <ScreenWrapper className="home-screen">
      <div className="home-modern">
        <header className="home-hero">
          <span className="home-chip">Compras inteligentes</span>
          <h1>Gestiona tus productos con claridad y rapidez</h1>
          <p>
            Escanea, compara y registra tus compras del dia a dia con una
            experiencia simple y ordenada.
          </p>
          <div className="home-actions">
            <Link to="/scanner" className="home-primary">
              Escanear codigo
            </Link>
            <Link to="/form" className="home-secondary">
              Nueva compra
            </Link>
          </div>
        </header>

        <section className="home-grid">
          <Link
            to="/scanner"
            className="home-card home-card-accent home-card-link"
          >
            <h2>Escaneo rapido</h2>
            <p>
              Usa la camara o ingresa el codigo manualmente para identificar un
              producto en segundos.
            </p>
            <span className="home-link">Ir al escaner</span>
          </Link>

          <Link
            to="/form"
            className="home-card home-card-accent home-card-link"
          >
            <h2>Registro ordenado</h2>
            <p>
              Guarda tus compras con fecha, cantidad y precio para tener todo
              bajo control.
            </p>
            <span className="home-link">Crear registro</span>
          </Link>

          <Link
            to="/products"
            className="home-card home-card-accent home-card-link"
          >
            <h2>Catalogo central</h2>
            <p>
              Mantener tus productos al dia te permite comparar precios y evitar
              duplicados.
            </p>
            <span className="home-link">Administrar productos</span>
          </Link>

          <Link
            to="/purchase-history"
            className="home-card home-card-accent home-card-link"
          >
            <h2>Historial de compras</h2>
            <p>
              Revisa tus compras registradas, su detalle y los productos
              asociados por cada transaccion.
            </p>
            <span className="home-link">Ver historial</span>
          </Link>

          <Link
            to="/supermarkets"
            className="home-card home-card-accent home-card-link"
          >
            <h2>Supermercados y mapa</h2>
            <p>
              Consulta la ubicacion de supermercados en el mapa y revisa el
              precio actual de productos en cada uno.
            </p>
            <span className="home-link">Explorar supermercados</span>
          </Link>
        </section>
      </div>
    </ScreenWrapper>
  );
}
