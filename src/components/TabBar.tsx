import { Link, useLocation } from "react-router-dom";
import { readAuthUser } from "../auth";

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

export default function TabBar() {
  const location = useLocation();
  const isLider = isLiderFlag(readAuthUser()?.lider);

  return (
    <nav className="tabbar">
      <Link className={location.pathname === "/" ? "active" : ""} to="/">
        Inicio
      </Link>


      <Link className={location.pathname === "/profile" ? "active" : ""} to="/profile">
        Perfil
      </Link>

      {isLider && (
        <Link className={location.pathname === "/precios" ? "active" : ""} to="/precios">
          Precios
        </Link>
      )}
    </nav>
  );
}
