import { NavLink } from "react-router-dom";
import { Home, User } from "lucide-react";

export default function BottomNav() {
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
    </nav>
  );
}
