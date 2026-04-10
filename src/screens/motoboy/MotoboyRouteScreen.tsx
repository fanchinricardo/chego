import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useMotoboyData } from "../../hooks/useMotoboyData";
import { useGpsSender } from "../../hooks/useGpsSender";
import { colors, Spinner } from "../../components/ui";
import { RouteStop } from "../../hooks/useRoutes";

export default function MotoboyRouteScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeRoute, stops, loading, confirmDelivery } = useMotoboyData();
  const gps = useGpsSender(activeRoute?.id ?? null, user?.id ?? null);

  const deliveredCount = stops.filter((s) => s.delivered_at).length;
  const nextStop = stops.find((s) => !s.delivered_at) as RouteStop | undefined;
  const allDone = stops.length > 0 && stops.every((s) => s.delivered_at);

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

  if (!activeRoute)
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
        }}
      >
        <p style={{ fontSize: 32 }}>🏍️</p>
        <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
          Nenhuma rota ativa
        </p>
        <button
          onClick={() => navigate("/motoboy")}
          style={{
            padding: "10px 24px",
            borderRadius: 10,
            background: colors.rosa,
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar
        </button>
      </div>
    );

  // Rota concluída
  if (allDone) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
        }}
      >
        <div
          style={{
            width: 68,
            height: 68,
            borderRadius: "50%",
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            color: "#fff",
          }}
        >
          ✓
        </div>
        <p
          style={{
            fontFamily: "'Righteous', cursive",
            fontSize: 24,
            color: colors.noite,
          }}
        >
          Rota concluída!
        </p>
        <p style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
          Todas as {stops.length} entregas foram realizadas com sucesso.
        </p>
        <button
          onClick={() => navigate("/motoboy")}
          style={{
            width: "100%",
            maxWidth: 320,
            padding: "13px",
            borderRadius: 13,
            background: colors.noite,
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar ao início
        </button>
      </div>
    );
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 4,
          }}
        >
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
            Em rota
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: gps.active ? colors.rosa : "#6b7280",
                animation: gps.active
                  ? "chegô-blink 1s ease-in-out infinite"
                  : "none",
              }}
            />
            <span
              style={{
                fontSize: 10,
                color: gps.active ? colors.rosa : "#6b7280",
                fontWeight: 600,
              }}
            >
              {gps.active ? "GPS ativo" : "GPS inativo"}
            </span>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {deliveredCount}/{stops.length} paradas ·{" "}
          {stops.length - deliveredCount} restantes
        </p>
      </div>

      {/* Mapa */}
      <div
        style={{
          height: 140,
          background: colors.roxoMedio,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 19px,rgba(255,255,255,0.04) 20px),repeating-linear-gradient(90deg,transparent,transparent 19px,rgba(255,255,255,0.04) 20px)",
          }}
        />

        {/* Linha de rota */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "10%",
            width: "78%",
            height: 2,
            background: "rgba(233,30,140,0.4)",
            borderRadius: 1,
          }}
        />

        {/* Pontos das paradas */}
        {stops.map((stop, i) => {
          const x = 12 + i * (74 / Math.max(stops.length - 1, 1));
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: stop.delivered_at ? "#22c55e" : colors.rosa,
                border: "2px solid #fff",
                top: "calc(50% - 5px)",
                left: `${x}%`,
                animation:
                  !stop.delivered_at && i === deliveredCount
                    ? "chegô-blink 1s ease-in-out infinite"
                    : "none",
              }}
            />
          );
        })}

        {/* Posição GPS */}
        {gps.lat && gps.lng && (
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: 12,
              fontSize: 9,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            📍 {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
          </div>
        )}

        <p
          style={{
            position: "absolute",
            bottom: 8,
            right: 10,
            fontSize: 9,
            color: "rgba(255,255,255,0.3)",
          }}
        >
          GPS ao vivo
        </p>
      </div>

      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Próxima parada em destaque */}
        {nextStop && (
          <div
            style={{
              background: colors.noite,
              borderRadius: 14,
              padding: "14px 16px",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Próxima parada
            </p>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 2,
              }}
            >
              {nextStop.customer_name}
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.5)",
                marginBottom: 10,
              }}
            >
              {nextStop.address}
            </p>

            <div style={{ display: "flex", gap: 8 }}>
              {/* Navegar no Google Maps */}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(nextStop.address)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 10,
                  background: "rgba(59,130,246,0.2)",
                  color: "#60a5fa",
                  fontSize: 11,
                  fontWeight: 700,
                  textDecoration: "none",
                  textAlign: "center",
                }}
              >
                🗺️ Navegar
              </a>

              {/* WhatsApp do cliente */}
              <button
                onClick={() => {
                  // Buscar telefone do cliente
                  const phone = (nextStop as any).phone;
                  if (phone) {
                    window.open(
                      `https://wa.me/55${phone.replace(/\D/g, "")}`,
                      "_blank",
                    );
                  }
                }}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 10,
                  background: "rgba(37,211,102,0.2)",
                  color: "#25d366",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                💬 WhatsApp
              </button>

              {/* Confirmar entrega */}
              <button
                onClick={() =>
                  navigate(`/motoboy/deliver/${nextStop.order_id}`)
                }
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: 10,
                  background: colors.rosa,
                  color: "#fff",
                  border: "none",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ✓ Entreguei
              </button>
            </div>
          </div>
        )}

        {/* Lista de todas as paradas */}
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
            Todas as paradas
          </p>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
            }}
          >
            {stops.map((stop, i) => {
              const isDone = !!stop.delivered_at;
              const isNext =
                !isDone && stops.slice(0, i).every((s) => s.delivered_at);
              const delivTime = stop.delivered_at
                ? new Date(stop.delivered_at).toLocaleTimeString("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : null;

              return (
                <div
                  key={stop.order_id}
                  style={{
                    padding: "10px 14px",
                    borderBottom:
                      i < stops.length - 1
                        ? `1px solid ${colors.fundo}`
                        : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    opacity: !isDone && !isNext ? 0.5 : 1,
                    cursor: isNext ? "pointer" : "default",
                  }}
                  onClick={() =>
                    isNext && navigate(`/motoboy/deliver/${stop.order_id}`)
                  }
                >
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      flexShrink: 0,
                      background: isDone
                        ? "#22c55e"
                        : isNext
                          ? colors.rosa
                          : "#d1d5db",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#fff",
                      animation: isNext
                        ? "chegô-blink 1.2s ease-in-out infinite"
                        : "none",
                    }}
                  >
                    {isDone ? "✓" : stop.stop_number}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: isDone ? "#15803d" : colors.noite,
                      }}
                    >
                      {stop.customer_name}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#888",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        marginTop: 1,
                      }}
                    >
                      {stop.address}
                    </p>
                    {isDone && delivTime && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: "#15803d",
                          background: "#f0fdf4",
                          padding: "1px 6px",
                          borderRadius: 8,
                          display: "inline-block",
                          marginTop: 3,
                        }}
                      >
                        Entregue · {delivTime}
                      </span>
                    )}
                    {isNext && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: colors.rosa,
                          background: "#fff0f8",
                          padding: "1px 6px",
                          borderRadius: 8,
                          display: "inline-block",
                          marginTop: 3,
                        }}
                      >
                        Próxima →
                      </span>
                    )}
                  </div>

                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isDone ? "#15803d" : colors.rosa,
                      flexShrink: 0,
                    }}
                  >
                    R${Number(stop.total).toFixed(0)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`@keyframes chegô-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
    </div>
  );
}
