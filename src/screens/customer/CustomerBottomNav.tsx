// ── CustomerBottomNav ─────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { colors } from "../../components/ui";

export function CustomerBottomNav({
  active,
}: {
  active: "home" | "orders" | "profile";
}) {
  const navigate = useNavigate();
  const items = [
    { key: "home", icon: "🏠", label: "Início", path: "/home" },
    { key: "orders", icon: "📋", label: "Pedidos", path: "/orders" },
    { key: "profile", icon: "👤", label: "Perfil", path: "/profile" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "flex",
        justifyContent: "center",
        background: "#fff",
        borderTop: `1px solid ${colors.bordaLilas}`,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          display: "flex",
          padding: "8px 0 20px",
        }}
      >
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => navigate(item.path)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              background: "none",
              border: "none",
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 20 }}>{item.icon}</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: active === item.key ? colors.rosa : "#aaa",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
