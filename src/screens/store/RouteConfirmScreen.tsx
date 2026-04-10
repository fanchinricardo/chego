import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRoutes } from "../../hooks/useRoutes";
import { OptimizedStop } from "../../services/routing";
import { colors, Spinner, Toast } from "../../components/ui";

interface LocationState {
  stops: OptimizedStop[];
  totalDist: number;
  totalMin: number;
  motoboyId: string;
  storeId: string;
}

export default function RouteConfirmScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState;
  const { createRoute } = useRoutes(state?.storeId ?? null);

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  if (!state) {
    navigate("/store/route", { replace: true });
    return null;
  }

  const { stops, totalDist, totalMin, motoboyId } = state;

  async function handleCreate() {
    setSaving(true);
    try {
      const route = await createRoute(motoboyId, stops);
      showToast("Rota criada! Motoboy notificado.");
      setTimeout(
        () => navigate(`/store/route/live/${route.id}`, { replace: true }),
        1200,
      );
    } catch (err: any) {
      showToast(err.message, "error");
      setSaving(false);
    }
  }

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
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 12,
            padding: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ← Voltar
        </button>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Rota Otimizada
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Confirme antes de enviar ao motoboy
        </p>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i < 2 ? colors.rosa : colors.amarelo,
              }}
            />
          ))}
        </div>
        <p
          style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 5 }}
        >
          Passo 2 de 3 — Confirmar rota
        </p>
      </div>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Resumo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          {[
            { label: "Paradas", value: stops.length },
            { label: "Distância", value: `${totalDist}km` },
            { label: "Estimado", value: `~${totalMin}min` },
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
                  fontSize: 20,
                  color: colors.rosa,
                }}
              >
                {s.value}
              </p>
              <p
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginTop: 2,
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Mapa placeholder */}
        <div
          style={{
            height: 130,
            background: colors.roxoMedio,
            borderRadius: 14,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Grade do mapa */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(255,255,255,0.04) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(255,255,255,0.04) 20px)",
            }}
          />

          {/* Linha da rota */}
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0 }}
          >
            <polyline
              points={[
                "10%,50%",
                ...stops.map(
                  (_, i) =>
                    `${15 + i * (75 / Math.max(stops.length - 1, 1))}%,${30 + (i % 2) * 40}%`,
                ),
              ].join(" ")}
              fill="none"
              stroke={`rgba(233,30,140,0.5)`}
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {/* Ponto de origem */}
            <circle
              cx="10%"
              cy="50%"
              r="5"
              fill={colors.noite}
              stroke="white"
              strokeWidth="2"
            />
            {/* Paradas */}
            {stops.map((_, i) => {
              const x = 15 + i * (75 / Math.max(stops.length - 1, 1));
              const y = 30 + (i % 2) * 40;
              return (
                <circle
                  key={i}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="4"
                  fill={colors.rosa}
                  stroke="white"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.3)",
              position: "absolute",
              bottom: 8,
              right: 10,
            }}
          >
            {stops.length} parada{stops.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Lista de paradas */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "12px 14px",
              borderBottom: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Ordem de entrega
            </p>
          </div>

          {/* Origem */}
          <div
            style={{
              padding: "10px 14px",
              borderBottom: `1px solid ${colors.fundo}`,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: colors.noite,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              ◎
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: colors.noite }}>
                Ponto de saída (sua loja)
              </p>
            </div>
          </div>

          {stops.map((stop, i) => (
            <div
              key={stop.order_id}
              style={{
                padding: "10px 14px",
                borderBottom:
                  i < stops.length - 1 ? `1px solid ${colors.fundo}` : "none",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              {/* Linha conectora */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: colors.rosa,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {stop.stop_number}
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{ fontSize: 12, fontWeight: 700, color: colors.noite }}
                >
                  #{stop.order_id.slice(0, 6).toUpperCase()} ·{" "}
                  {stop.customer_name}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: "#888",
                    marginTop: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stop.address}
                </p>
                <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: "#7e22ce",
                      background: colors.lilasClaro,
                      padding: "2px 7px",
                      borderRadius: 8,
                    }}
                  >
                    {stop.distance_km} km
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      color: "#7e22ce",
                      background: colors.lilasClaro,
                      padding: "2px 7px",
                      borderRadius: 8,
                    }}
                  >
                    ~{stop.duration_min} min
                  </span>
                </div>
              </div>

              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: colors.rosa,
                  flexShrink: 0,
                }}
              >
                R${Number(stop.total).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        {/* Aviso */}
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "12px 14px",
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚡</span>
          <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
            Ao confirmar, o motoboy será notificado via WhatsApp e os clientes
            receberão uma mensagem informando que o pedido saiu para entrega.
          </p>
        </div>

        {/* Botões */}
        <button
          onClick={handleCreate}
          disabled={saving}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 13,
            background: colors.rosa,
            color: "#fff",
            border: "none",
            fontSize: 15,
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            fontFamily: "'Space Grotesk', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {saving ? (
            <>
              <Spinner size={18} /> Criando rota...
            </>
          ) : (
            "🚀 Iniciar e notificar motoboy"
          )}
        </button>

        <button
          onClick={() => navigate(-1)}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 13,
            background: "#fff",
            color: colors.noite,
            border: `1.5px solid ${colors.bordaLilas}`,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ← Voltar e ajustar
        </button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
