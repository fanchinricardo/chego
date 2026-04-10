import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { useRoutes, useRouteGps, DeliveryRoute } from "../../hooks/useRoutes";
import { RouteStop } from "../../hooks/useRoutes";
import { colors, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

// ── Tela principal: lista de rotas + histórico ────────────
export default function RouteScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const { routes, loading, cancelRoute } = useRoutes(store?.id ?? null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  const activeRoute = routes.find(
    (r) => r.status === "in_progress" || r.status === "pending",
  );
  const history = routes.filter(
    (r) => r.status === "completed" || r.status === "cancelled",
  );

  async function handleCancel(routeId: string) {
    if (!confirm("Cancelar esta rota?")) return;
    try {
      await cancelRoute(routeId);
      showToast("Rota cancelada");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner color={colors.rosa} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Entregas
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Gerencie as rotas de entrega
        </p>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Rota ativa */}
        {activeRoute ? (
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
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${colors.rosa}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background:
                    activeRoute.status === "in_progress"
                      ? "#fff0f8"
                      : "#fff8e6",
                  padding: "8px 14px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {activeRoute.status === "in_progress" && (
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: colors.rosa,
                        animation: "chegô-blink 1s ease-in-out infinite",
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color:
                        activeRoute.status === "in_progress"
                          ? colors.rosa
                          : "#b45309",
                    }}
                  >
                    {activeRoute.status === "in_progress"
                      ? "Ao vivo"
                      : "Aguardando motoboy"}
                  </span>
                </div>
                <span style={{ fontSize: 10, color: "#888" }}>
                  {activeRoute.motoboys?.profiles?.full_name}
                </span>
              </div>
              <style>{`@keyframes chegô-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>

              <div style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      {activeRoute.total_stops} parada
                      {activeRoute.total_stops !== 1 ? "s" : ""}
                    </p>
                    <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                      {activeRoute.motoboys?.vehicle_plate ??
                        "Placa não cadastrada"}
                    </p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: "#888" }}>
                      {new Date(activeRoute.created_at).toLocaleTimeString(
                        "pt-BR",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() =>
                      navigate(`/store/route/live/${activeRoute.id}`)
                    }
                    style={{
                      flex: 2,
                      padding: "10px",
                      borderRadius: 10,
                      background: colors.rosa,
                      color: "#fff",
                      border: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    📍 Acompanhar ao vivo
                  </button>
                  <button
                    onClick={() => handleCancel(activeRoute.id)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 10,
                      background: "#fff0f3",
                      color: colors.rosa,
                      border: `1px solid ${colors.bordaLilas}`,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "28px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>🗺️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhuma rota ativa
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#aaa",
                marginTop: 4,
                marginBottom: 14,
                lineHeight: 1.6,
              }}
            >
              Crie uma nova rota com os pedidos prontos para entrega
            </p>
            <button
              onClick={() => navigate("/store/route/new")}
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
              + Nova rota
            </button>
          </div>
        )}

        {/* Botão nova rota (quando já tem uma ativa) */}
        {activeRoute && (
          <button
            onClick={() => navigate("/store/route/new")}
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: 13,
              background: colors.noite,
              color: "#fff",
              border: "none",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            + Criar outra rota
          </button>
        )}

        {/* Histórico */}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {history.slice(0, 5).map((route) => {
                const stops = (route.route_json ?? []) as RouteStop[];
                const total = stops.reduce((s, st) => s + Number(st.total), 0);
                const isDone = route.status === "completed";
                const time = new Date(route.created_at).toLocaleTimeString(
                  "pt-BR",
                  { hour: "2-digit", minute: "2-digit" },
                );

                return (
                  <div
                    key={route.id}
                    style={{
                      background: "#fff",
                      borderRadius: 13,
                      border: `1px solid ${colors.bordaLilas}`,
                      overflow: "hidden",
                      cursor: "pointer",
                    }}
                    onClick={() => navigate(`/store/route/live/${route.id}`)}
                  >
                    <div
                      style={{
                        padding: "6px 12px",
                        background: isDone ? "#f0fdf4" : "#fef2f2",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          color: isDone ? "#15803d" : "#991b1b",
                        }}
                      >
                        {isDone ? "✓ Concluída" : "✕ Cancelada"} · {time}
                      </span>
                      <span style={{ fontSize: 10, color: "#888" }}>
                        {route.motoboys?.profiles?.full_name}
                      </span>
                    </div>
                    <div
                      style={{
                        padding: "8px 12px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
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
                          {route.total_stops} entrega
                          {route.total_stops !== 1 ? "s" : ""}
                        </p>
                      </div>
                      {isDone && (
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: colors.rosa,
                          }}
                        >
                          R$ {total.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <BottomNav active="route" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

// ── Tela de acompanhamento ao vivo ────────────────────────
export function RouteLiveScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const gps = useRouteGps(id ?? null);

  const [route, setRoute] = useState<DeliveryRoute | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  useEffect(() => {
    if (!id) return;

    // Busca rota
    supabase
      .from("delivery_routes")
      .select("*, motoboys(id, vehicle_plate, profiles(full_name, phone))")
      .eq("id", id)
      .single()
      .then(({ data }) => {
        if (data) {
          setRoute(data as DeliveryRoute);
          setStops((data.route_json ?? []) as RouteStop[]);
        }
        setLoading(false);
      });

    // Escuta atualizações de entrega em tempo real
    const channel = supabase
      .channel(`live-route-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
          filter: `route_id=eq.${id}`,
        },
        (payload) => {
          const d = payload.new as any;
          if (d.delivered_at) {
            setStops((prev) =>
              prev.map((s) =>
                s.order_id === d.order_id
                  ? { ...s, delivered_at: d.delivered_at }
                  : s,
              ),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_routes",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setRoute((prev) => (prev ? { ...prev, ...payload.new } : prev));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Atualiza hora do GPS
  useEffect(() => {
    if (!gps) return;
    const diff = Math.round(
      (Date.now() - new Date(gps.recorded_at).getTime()) / 1000,
    );
    setLastUpdate(
      diff < 60 ? `${diff}s atrás` : `${Math.round(diff / 60)}min atrás`,
    );
  }, [gps]);

  if (loading)
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner color={colors.rosa} />
      </div>
    );

  if (!route)
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <p style={{ color: "#888" }}>Rota não encontrada</p>
      </div>
    );

  const delivered = stops.filter((s) => s.delivered_at).length;
  const remaining = stops.length - delivered;
  const isActive = route.status === "in_progress";
  const isComplete = route.status === "completed";
  const phone = route.motoboys?.profiles?.phone;

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
            marginBottom: 10,
            padding: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ← Voltar
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
                Rota ao vivo
              </p>
              {isActive && (
                <div
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: colors.rosa,
                    animation: "chegô-blink 1s ease-in-out infinite",
                  }}
                />
              )}
            </div>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.4)",
                marginTop: 2,
              }}
            >
              {route.motoboys?.profiles?.full_name}
              {gps && lastUpdate ? ` · GPS ${lastUpdate}` : ""}
            </p>
          </div>
          {isComplete && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                padding: "4px 12px",
                borderRadius: 20,
                background: "#f0fdf4",
                color: "#15803d",
              }}
            >
              ✓ Concluída
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
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
            { label: "Entregues", value: delivered, color: "#22c55e" },
            {
              label: "Restantes",
              value: remaining,
              color: remaining > 0 ? colors.rosa : "#22c55e",
            },
            { label: "Total", value: stops.length, color: "#fff" },
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
                  fontSize: 22,
                  color: s.color,
                }}
              >
                {s.value}
              </p>
              <p
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Mapa com GPS */}
        <div
          style={{
            height: 130,
            background: colors.roxoMedio,
            borderRadius: 14,
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

          {/* Linha da rota */}
          <svg
            width="100%"
            height="100%"
            style={{ position: "absolute", inset: 0 }}
          >
            <polyline
              points={stops
                .map(
                  (_, i) =>
                    `${10 + i * (80 / Math.max(stops.length - 1, 1))}%,${35 + (i % 2) * 35}%`,
                )
                .join(" ")}
              fill="none"
              stroke="rgba(233,30,140,0.4)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            {stops.map((stop, i) => {
              const x = 10 + i * (80 / Math.max(stops.length - 1, 1));
              const y = 35 + (i % 2) * 35;
              return (
                <circle
                  key={i}
                  cx={`${x}%`}
                  cy={`${y}%`}
                  r="5"
                  fill={stop.delivered_at ? "#22c55e" : colors.rosa}
                  stroke="white"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          {/* Posição do motoboy */}
          {gps && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 12,
                display: "flex",
                alignItems: "center",
                gap: 5,
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
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>
                {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}
              </span>
            </div>
          )}

          {!gps && isActive && (
            <div style={{ position: "absolute", bottom: 8, left: 12 }}>
              <span style={{ fontSize: 9, color: "rgba(255,255,255,0.35)" }}>
                Aguardando GPS do motoboy...
              </span>
            </div>
          )}
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
              padding: "10px 14px",
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
              Paradas
            </p>
          </div>

          {stops.map((stop, i) => {
            const isDelivered = !!stop.delivered_at;
            const isNext =
              !isDelivered && stops.slice(0, i).every((s) => s.delivered_at);
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
                    i < stops.length - 1 ? `1px solid ${colors.fundo}` : "none",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  opacity: !isDelivered && !isNext && isActive ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: isDelivered
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
                    animation:
                      isNext && isActive
                        ? "chegô-blink 1s ease-in-out infinite"
                        : "none",
                  }}
                >
                  {isDelivered ? "✓" : stop.stop_number}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isDelivered ? "#15803d" : colors.noite,
                    }}
                  >
                    #{stop.order_id.slice(0, 6).toUpperCase()} ·{" "}
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
                  {isDelivered && delivTime && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: "#15803d",
                        background: "#f0fdf4",
                        padding: "2px 7px",
                        borderRadius: 8,
                        display: "inline-block",
                        marginTop: 3,
                      }}
                    >
                      Entregue · {delivTime}
                    </span>
                  )}
                  {isNext && isActive && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        color: colors.rosa,
                        background: "#fff0f8",
                        padding: "2px 7px",
                        borderRadius: 8,
                        display: "inline-block",
                        marginTop: 3,
                      }}
                    >
                      Em rota agora
                    </span>
                  )}
                </div>

                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: isDelivered ? "#15803d" : colors.rosa,
                    flexShrink: 0,
                  }}
                >
                  R${Number(stop.total).toFixed(0)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Contato motoboy */}
        {phone && (
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "10px 14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: colors.noite }}>
                {route.motoboys?.profiles?.full_name}
              </p>
              <p style={{ fontSize: 10, color: "#888" }}>
                {route.motoboys?.vehicle_plate ?? "Veículo não cadastrado"}
              </p>
            </div>
            <a
              href={`https://wa.me/55${phone.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              style={{
                padding: "7px 14px",
                borderRadius: 9,
                background: "#25d366",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              💬 WhatsApp
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
