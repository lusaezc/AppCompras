import { Link, useLocation } from "react-router-dom";

export default function TabBar() {
  const location = useLocation();

  return (
    <nav className="tabbar">
      <Link className={location.pathname === "/" ? "active" : ""} to="/">
        Inicio
      </Link>


      <Link className={location.pathname === "/profile" ? "active" : ""} to="/profile">
        Perfil
      </Link>
    </nav>
  );
}
