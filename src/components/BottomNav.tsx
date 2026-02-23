import { NavLink } from "react-router-dom";
import { Home, ListChecks, User } from "lucide-react";
import { readAuthUser } from "../auth";

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

export default function BottomNav() {
  const isLider = isLiderFlag(readAuthUser()?.lider);

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className="nav-item">
        <Home size={22} />
        <span>Home</span>
      </NavLink>

      <NavLink to="/profile" className="nav-item">
        <User size={22} />
        <span>Perfil</span>
      </NavLink>

      {isLider && (
        <NavLink to="/precios" className="nav-item">
          <ListChecks size={22} />
          <span>Precios</span>
        </NavLink>
      )}
    </nav>
  );
}
