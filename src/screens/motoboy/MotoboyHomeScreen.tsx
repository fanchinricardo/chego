import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMotoboyData } from "../../hooks/useMotoboyData";
import { colors, Logo, Spinner, Toast } from "../../components/ui";
import { RouteStop } from "../../hooks/useRoutes";

export default function MotoboyHomeScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profile, activeRoute, stops, history, stats, loading, acceptRoute } =
    useMotoboyData();

  const [accepting, setAccepting] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleAccept() {
    if (!activeRoute) return;
    setAccepting(true);
    try {
      await acceptRoute(activeRoute.id);
      showToast("Rota aceita! Iniciando entregas.");
      navigate("/motoboy/route");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAccepting(false);
    }
  }

  if (loading)
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

  const deliveredStops = stops.filter((s) => s.delivered_at).length;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 24,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <Logo size={22} />
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                animation: "chegô-blink 1.5s ease-in-out infinite",
              }}
            />
            <span style={{ fontSize: 11, color: "#22c55e", fontWeight: 600 }}>
              Online
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Olá, {profile?.profiles?.full_name?.split(" ")[0]} 👋
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          🏍️ {profile?.vehicle_plate ?? "Placa não cadastrada"}
        </p>
      </div>

      {/* Stats do dia */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          padding: "14px 16px 0",
        }}
      >
        {[
          {
            label: "Entregas hoje",
            value: stats.delivered,
            color: colors.rosa,
          },
          {
            label: "Ganhos hoje",
            value: `R$\u00a0${stats.earnings.toFixed(0)}`,
            color: "#22c55e",
          },
          { label: "Avaliação", value: "4.9 ⭐", color: "#fff" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: colors.noite,
              borderRadius: 12,
              padding: "10px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 18,
                color: s.color,
                lineHeight: 1,
              }}
            >
              {s.value}
            </p>
            <p
              style={{
                fontSize: 8,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                marginTop: 3,
              }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Rota ativa — ir para tela de rota */}
        {activeRoute?.status === "in_progress" && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Rota em andamento
            </p>
            <div
              onClick={() => navigate("/motoboy/route")}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${colors.rosa}`,
                padding: "12px 14px",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: colors.rosa,
                    animation: "chegô-blink 1s ease-in-out infinite",
                  }}
                />
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: colors.rosa }}
                >
                  Em andamento
                </span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}>
                {activeRoute.total_stops} paradas · {deliveredStops} entregues
              </p>
              <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                Toque para continuar a rota →
              </p>
            </div>
          </div>
        )}

        {/* Rota pendente — aceitar ou recusar */}
        {activeRoute?.status === "pending" && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Nova rota disponível
            </p>
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${colors.rosa}`,
                padding: "14px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <p
                  style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
                >
                  {activeRoute.total_stops} paradas
                </p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: colors.rosa,
                    background: "#fff0f8",
                    padding: "2px 9px",
                    borderRadius: 10,
                  }}
                >
                  Nova rota
                </span>
              </div>

              {/* Lista resumida das paradas */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  marginBottom: 12,
                }}
              >
                {(stops as RouteStop[]).slice(0, 3).map((stop, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: colors.rosa,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 9,
                        fontWeight: 700,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {stop.stop_number}
                    </div>
                    <p
                      style={{
                        fontSize: 11,
                        color: "#555",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {stop.customer_name} · {stop.address}
                    </p>
                  </div>
                ))}
                {stops.length > 3 && (
                  <p style={{ fontSize: 10, color: "#aaa", marginLeft: 26 }}>
                    +{stops.length - 3} mais...
                  </p>
                )}
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  style={{
                    flex: 2,
                    padding: "11px",
                    borderRadius: 11,
                    background: colors.rosa,
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: accepting ? "not-allowed" : "pointer",
                    opacity: accepting ? 0.7 : 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {accepting ? "Aceitando..." : "✓ Aceitar rota"}
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 11,
                    background: colors.lilasClaro,
                    color: "#7e22ce",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Recusar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sem rota */}
        {!activeRoute && (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>🏍️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhuma rota no momento
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
              Aguarde o comércio criar uma rota para você
            </p>
          </div>
        )}

        {/* Histórico do dia */}
        {history.length > 0 && (
          <div>
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 8,
              }}
            >
              Histórico de hoje
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {history.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: `1px solid ${colors.bordaLilas}`,
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      {(d.order as any)?.profiles?.full_name}
                    </p>
                    <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                      {(d.order as any)?.delivery_address
                        ?.split("·")[0]
                        ?.trim()}
                    </p>
                    <p style={{ fontSize: 9, color: "#bbb", marginTop: 1 }}>
                      {d.delivered_at
                        ? new Date(d.delivered_at).toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                  <span
                    style={{ fontSize: 11, fontWeight: 700, color: "#22c55e" }}
                  >
                    ✓ Entregue
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sair */}
        <button
          onClick={async () => {
            await signOut();
            navigate("/", { replace: true });
          }}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 12,
            background: "#fff0f3",
            border: `1px solid ${colors.bordaLilas}`,
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          🚪 Sair da conta
        </button>
      </div>

      <style>{`@keyframes chegô-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
