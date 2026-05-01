import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { colors } from "../../components/ui";

export default function BalcaoHomeScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div style={{ background: colors.noite, padding: "20px 20px 28px" }}>
        <div style={{ maxWidth: 400, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 28,
              color: "#fff",
              letterSpacing: 1,
            }}
          >
            Chegô
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
            }}
          >
            Olá, {profile?.full_name?.split(" ")[0]} 👋
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 400,
          margin: "0 auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#aaa",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 4,
          }}
        >
          Acesso rápido
        </p>

        {[
          {
            icon: "🏪",
            label: "Balcão",
            sub: "Venda avulsa no caixa",
            path: "/cashier/pdv",
            color: colors.rosa,
          },
          {
            icon: "🖥️",
            label: "Caixa",
            sub: "Fechamento de mesas",
            path: "/cashier",
            color: "#7c3aed",
          },
          {
            icon: "🛵",
            label: "Criar rota",
            sub: "Organizar entregas",
            path: "/store/route/new",
            color: "#0ea5e9",
          },
        ].map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            style={{
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px 18px",
              display: "flex",
              alignItems: "center",
              gap: 14,
              cursor: "pointer",
              textAlign: "left",
              width: "100%",
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: item.color + "18",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 24 }}>{item.icon}</span>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
                {item.label}
              </p>
              <p style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                {item.sub}
              </p>
            </div>
            <span style={{ marginLeft: "auto", color: "#ccc", fontSize: 18 }}>
              →
            </span>
          </button>
        ))}

        <button
          onClick={signOut}
          style={{
            marginTop: 16,
            padding: "12px",
            borderRadius: 12,
            background: "transparent",
            border: `1px solid ${colors.bordaLilas}`,
            color: "#aaa",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Sair
        </button>
      </div>
    </div>
  );
}
