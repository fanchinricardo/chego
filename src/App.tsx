import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";
import { Spinner, colors } from "./components/ui";

// Auth
import SplashScreen from "./screens/SplashScreen";
import LoginScreen from "./screens/LoginScreen";
import CadastroScreen from "./screens/CadastroScreen";
import RecoverPasswordScreen from "./screens/RecoverPasswordScreen";
import NewPasswordScreen from "./screens/NewPasswordScreen";

// Comércio
import StoreDashboard from "./screens/store/StoreDashboard";
import OrderDetailScreen from "./screens/store/OrderDetailScreen";
import ProductsScreen from "./screens/store/ProductsScreen";
import StoreProfileScreen from "./screens/store/StoreProfileScreen";
import StoreSetupScreen from "./screens/store/StoreSetupScreen";
import StoreMpConfigScreen from "./screens/store/StoreMpConfigScreen";
import StoreMotoboyScreen from "./screens/store/StoreMotoboyScreen";
import StoreScheduleScreen from "./screens/store/StoreScheduleScreen";
import StoreChangeEmailScreen from "./screens/store/StoreChangeEmailScreen";
import StoreBillingScreen from "./screens/store/StoreBillingScreen";
import RouteBuilderScreen from "./screens/store/RouteBuilderScreen";
import RouteConfirmScreen from "./screens/store/RouteConfirmScreen";
import RouteScreen, { RouteLiveScreen } from "./screens/store/RouteScreen";

// Cliente
import CustomerHomeScreen from "./screens/customer/CustomerHomeScreen";
import CustomerStoreScreen from "./screens/customer/CustomerStoreScreen";
import CustomerProfileScreen from "./screens/customer/CustomerProfileScreen";
import {
  CartScreen,
  PaymentScreen,
} from "./screens/customer/CartAndPaymentScreen";
import {
  CustomerOrdersScreen,
  CustomerTrackingScreen,
} from "./screens/customer/CustomerOrdersScreen";

// Motoboy
import MotoboyHomeScreen from "./screens/motoboy/MotoboyHomeScreen";
import MotoboyRouteScreen from "./screens/motoboy/MotoboyRouteScreen";
import MotoboyDeliveryScreen from "./screens/motoboy/MotoboyDeliveryScreen";
import AdminScreen from "./screens/admin/AdminScreen";

function Placeholder({ label }: { label: string }) {
  const { signOut } = useAuth();
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.noite,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        fontFamily: "'Space Grotesk',sans-serif",
      }}
    >
      <span
        style={{
          fontFamily: "'Righteous',cursive",
          fontSize: 32,
          color: "#fff",
        }}
      >
        Cheg<span style={{ color: colors.rosa }}>ô</span>
      </span>
      <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{label}</p>
      <button
        onClick={signOut}
        style={{
          padding: "10px 24px",
          borderRadius: 10,
          background: "rgba(233,30,140,0.15)",
          border: "1px solid rgba(233,30,140,0.3)",
          color: colors.rosa,
          fontSize: 13,
          fontWeight: 600,
          fontFamily: "'Space Grotesk',sans-serif",
          cursor: "pointer",
        }}
      >
        Sair
      </button>
    </div>
  );
}

function Loading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.noite,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Spinner size={36} />
    </div>
  );
}

// Rota protegida — aguarda profile carregar antes de redirecionar
function PrivateRoute({
  children,
  allowedRoles,
}: {
  children: JSX.Element;
  allowedRoles?: string[];
}) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  // Ainda carregando sessão ou profile — espera
  if (loading) return <Loading />;

  // Sem sessão — vai para login
  if (!session) return <Navigate to="/" state={{ from: location }} replace />;

  // Profile ainda não chegou — espera mais um pouco
  if (!profile) return <Loading />;

  // Role errado — redireciona para a área correta
  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    const map: Record<string, string> = {
      admin: "/admin",
      store: "/store",
      motoboy: "/motoboy",
      customer: "/home",
    };
    return <Navigate to={map[profile.role] ?? "/"} replace />;
  }

  return children;
}

// Rota pública — redireciona para home se já logado
function PublicRoute({ children }: { children: JSX.Element }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;

  // Aguarda profile antes de redirecionar
  if (session && !profile) return <Loading />;

  if (session && profile) {
    const map: Record<string, string> = {
      admin: "/admin",
      store: "/store",
      motoboy: "/motoboy",
      customer: "/home",
    };
    return <Navigate to={map[profile.role] ?? "/home"} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Públicas ── */}
            <Route
              path="/"
              element={
                <PublicRoute>
                  <SplashScreen />
                </PublicRoute>
              }
            />
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <LoginScreen />
                </PublicRoute>
              }
            />
            <Route
              path="/cadastro"
              element={
                <PublicRoute>
                  <CadastroScreen />
                </PublicRoute>
              }
            />
            <Route
              path="/recuperar-senha"
              element={
                <PublicRoute>
                  <RecoverPasswordScreen />
                </PublicRoute>
              }
            />
            <Route path="/nova-senha" element={<NewPasswordScreen />} />

            {/* ── Cliente ── prefixo /c/ para evitar conflito com /store do comércio */}
            <Route
              path="/home"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerHomeScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/loja/:id"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerStoreScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/cart"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CartScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/payment"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <PaymentScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/orders"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerOrdersScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/orders/:id"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerTrackingScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <PrivateRoute allowedRoles={["customer"]}>
                  <CustomerProfileScreen />
                </PrivateRoute>
              }
            />

            {/* ── Comércio ── */}
            <Route
              path="/store"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/setup"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreSetupScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/orders/:id"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <OrderDetailScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/products"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <ProductsScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/profile"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreProfileScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/mp-config"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreMpConfigScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/motoboys"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreMotoboyScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/schedule"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreScheduleScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/change-email"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreChangeEmailScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/billing"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <StoreBillingScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/route"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <RouteScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/route/new"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <RouteBuilderScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/route/confirm"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <RouteConfirmScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/store/route/live/:id"
              element={
                <PrivateRoute allowedRoles={["store"]}>
                  <RouteLiveScreen />
                </PrivateRoute>
              }
            />

            {/* ── Motoboy ── */}
            <Route
              path="/motoboy"
              element={
                <PrivateRoute allowedRoles={["motoboy"]}>
                  <MotoboyHomeScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/motoboy/route"
              element={
                <PrivateRoute allowedRoles={["motoboy"]}>
                  <MotoboyRouteScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/motoboy/deliver/:orderId"
              element={
                <PrivateRoute allowedRoles={["motoboy"]}>
                  <MotoboyDeliveryScreen />
                </PrivateRoute>
              }
            />

            {/* ── Admin ── */}
            <Route
              path="/admin"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <AdminScreen />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <PrivateRoute allowedRoles={["admin"]}>
                  <AdminScreen />
                </PrivateRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
