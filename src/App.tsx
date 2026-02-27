import { useEffect, useState, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";

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
import { applyTheme, readSavedTheme } from "./theme";
import PriceFeed from "./pages/PriceFeed";
import UserManagement from "./pages/UserManagement";
import ReceiptOcr from "./pages/ReceiptOcr";
import GlobalDbLoader from "./components/GlobalDbLoader";
import {
  getPendingRequests,
  installFetchTracker,
  subscribeNetworkActivity,
} from "./networkActivity";

const isLiderFlag = (value: unknown) =>
  value === true || value === 1 || value === "1" || value === "true";

function ProtectedRoute({ children }: { children: ReactElement }) {
  const user = readAuthUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function LiderRoute({ children }: { children: ReactElement }) {
  const user = readAuthUser();
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isLiderFlag(user.lider)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  const hideNavigation = location.pathname === "/login";
  const hasUser = Boolean(readAuthUser());

  useEffect(() => {
    const userId = readAuthUser()?.UserId ?? null;
    applyTheme(readSavedTheme(userId));
  }, [location.pathname, hasUser]);

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
        <Route
          path="/precios"
          element={
            <LiderRoute>
              <PriceFeed />
            </LiderRoute>
          }
        />
        <Route
          path="/ocr-boleta"
          element={
            <ProtectedRoute>
              <ReceiptOcr />
            </ProtectedRoute>
          }
        />
        <Route
          path="/lider/usuarios"
          element={
            <ProtectedRoute>
              <UserManagement />
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
  const [pendingRequests, setPendingRequests] = useState(() =>
    getPendingRequests(),
  );

  useEffect(() => {
    installFetchTracker();
    return subscribeNetworkActivity(setPendingRequests);
  }, []);

  return (
    <BrowserRouter>
      <ScrollToTop />
      <GlobalDbLoader visible={pendingRequests > 0} />
      <div className="app-container">
        <AnimatedRoutes />
      </div>
    </BrowserRouter>
  );
}

export default App;
