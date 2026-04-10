import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Button, colors } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export default function SplashScreen() {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();

  // Redireciona se já logado
  useEffect(() => {
    if (loading) return;
    if (session && profile) {
      const routes: Record<string, string> = {
        admin: "/admin",
        store: "/store",
        motoboy: "/motoboy",
        customer: "/home",
      };
      navigate(routes[profile.role] ?? "/home", { replace: true });
    }
  }, [session, profile, loading, navigate]);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.noite,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "56px 28px 44px",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* ── Topo: logo + animação ── */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Logo size={72} />
        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          entrega do seu bairro
        </p>

        {/* Três pontinhos pulsantes */}
        <div style={{ display: "flex", gap: 7, marginTop: 20 }}>
          {[0, 0.2, 0.4].map((delay, i) => (
            <div
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background:
                  i === 0 ? colors.rosa : `rgba(233,30,140,${0.4 - i * 0.15})`,
                animation: `chegô-pulse 1.4s ease-in-out ${delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes chegô-pulse {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.45); }
        }
      `}</style>

      {/* ── Fundo: CTAs ── */}
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Button
          variant="primary"
          fullWidth
          onClick={() => navigate("/login")}
          style={{ fontSize: 15 }}
        >
          Entrar na conta
        </Button>

        <Button
          variant="outline"
          fullWidth
          onClick={() => navigate("/cadastro")}
          style={{ fontSize: 15 }}
        >
          Criar conta grátis
        </Button>

        <p
          style={{
            textAlign: "center",
            fontSize: 10,
            color: "rgba(255,255,255,0.2)",
            lineHeight: 1.6,
            marginTop: 6,
          }}
        >
          Ao continuar você aceita os{" "}
          <span style={{ color: "rgba(233,30,140,0.6)" }}>Termos de Uso</span> e
          a{" "}
          <span style={{ color: "rgba(233,30,140,0.6)" }}>
            Política de Privacidade
          </span>
        </p>
      </div>
    </div>
  );
}
