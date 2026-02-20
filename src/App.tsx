import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactElement } from "react";

import BottomNav from "./components/BottomNav";
import Scanner from "./pages/Scanner";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import TabBar from "./components/TabBar";
import Form from "./pages/Form";
import ProductForm from "./pages/ProductForm";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import PurchaseHistory from "./pages/PurchaseHistory";
import Supermarkets from "./pages/Supermarkets";
import ScrollToTop from "./components/ScrollToTop";
import Login from "./pages/Login";
import { readAuthUser } from "./auth";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const user = readAuthUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  const hideNavigation = location.pathname === "/login";
  const hasUser = Boolean(readAuthUser());

return (
  <>
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scanner"
        element={
          <ProtectedRoute>
            <Scanner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/form"
        element={
          <ProtectedRoute>
            <Form />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product-form/:code"
        element={
          <ProtectedRoute>
            <ProductForm />
          </ProtectedRoute>
        }
      />
      <Route
        path="/products"
        element={
          <ProtectedRoute>
            <Products />
          </ProtectedRoute>
        }
      />
      <Route
        path="/product-detail/:code"
        element={
          <ProtectedRoute>
            <ProductDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchase-history"
        element={
          <ProtectedRoute>
            <PurchaseHistory />
          </ProtectedRoute>
        }
      />
      <Route
        path="/supermarkets"
        element={
          <ProtectedRoute>
            <Supermarkets />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>

    {!hideNavigation && hasUser && <BottomNav />}
    {!hideNavigation && hasUser && <TabBar />}
  </>
);
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="app-container">
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;
