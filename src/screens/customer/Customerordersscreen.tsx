import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useCustomerOrders } from "../../hooks/useCustomer";
import { useRouteGps } from "../../hooks/useRoutes";
import { colors, Spinner } from "../../components/ui";
import { CustomerBottomNav } from "./CustomerBottomNav";

const STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando confirmação",
  confirmed: "Confirmado",
  preparing: "Sendo preparado",
  ready: "Pronto para entrega",
  in_delivery: "A caminho",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_STEPS = [
  "confirmed",
  "preparing",
  "ready",
  "in_delivery",
  "delivered",
];

// ── Lista de pedidos ──────────────────────────────────────
export function CustomerOrdersScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { orders, loading } = useCustomerOrders(user?.id ?? null);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
        <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
          Meus Pedidos
        </p>
        <p
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}
        >
          Histórico de compras
        </p>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner color={colors.rosa} />
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "48px 24px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>📋</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
              Nenhum pedido ainda
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#aaa",
                marginTop: 6,
                marginBottom: 16,
              }}
            >
              Faça seu primeiro pedido nos comércios do seu bairro
            </p>
            <button
              onClick={() => navigate("/home")}
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
              Explorar comércios
            </button>
          </div>
        )}

        {orders.map((order) => {
          const isActive = [
            "pending",
            "confirmed",
            "preparing",
            "ready",
            "in_delivery",
          ].includes(order.status);
          const stepIdx = STATUS_STEPS.indexOf(order.status);
          const time = new Date(order.created_at).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          const itemNames =
            order.order_items
              ?.map((i: any) => `${i.quantity}× ${i.products?.name}`)
              .join(", ") ?? "";

          return (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.id}`)}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${isActive ? colors.rosa : colors.bordaLilas}`,
                overflow: "hidden",
                cursor: "pointer",
              }}
            >
              {isActive && (
                <div
                  style={{
                    background: "#fff0f8",
                    padding: "6px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: colors.rosa,
                      animation: "chegô-blink 1s ease-in-out infinite",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.rosa,
                    }}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
              )}
              <div style={{ padding: "10px 14px" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 4,
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {order.stores?.name}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.rosa,
                    }}
                  >
                    R$ {Number(order.total).toFixed(2)}
                  </p>
                </div>
                <p
                  style={{
                    fontSize: 10,
                    color: "#aaa",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {itemNames}
                </p>
                <p style={{ fontSize: 10, color: "#bbb", marginTop: 3 }}>
                  {time}
                </p>

                {/* Barra de progresso */}
                {isActive && order.status !== "pending" && (
                  <div style={{ display: "flex", gap: 3, marginTop: 8 }}>
                    {STATUS_STEPS.map((s, i) => (
                      <div
                        key={s}
                        style={{
                          flex: 1,
                          height: 3,
                          borderRadius: 2,
                          background:
                            i <= stepIdx ? colors.rosa : colors.bordaLilas,
                          transition: "background 0.3s",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <style>{`@keyframes chegô-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
            </div>
          );
        })}
      </div>

      <CustomerBottomNav active="orders" />
    </div>
  );
}

// ── Rastreio de pedido ────────────────────────────────────
export function CustomerTrackingScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<any | null>(null);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastGpsUpdate, setLastGpsUpdate] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapReady = useRef(false);

  const gps = useRouteGps(routeId);

  useEffect(() => {
    if (!id) return;

    supabase
      .from("orders")
      .select(
        "*, stores(name, logo_url), order_items(quantity, unit_price, products(name))",
      )
      .eq("id", id)
      .single()
      .then(async ({ data }) => {
        setOrder(data);

        // Busca rota associada
        if (data?.status === "in_delivery") {
          const { data: delivery, error: delErr } = await supabase
            .from("deliveries")
            .select("route_id")
            .eq("order_id", id)
            .maybeSingle();

          console.log("🚚 delivery encontrado:", delivery, "erro:", delErr);
          if (delivery?.route_id) {
            console.log("✅ routeId definido:", delivery.route_id);
            setRouteId(delivery.route_id);
          } else {
            console.warn("❌ nenhum delivery encontrado para order_id:", id);
          }
        } else {
          console.log(
            "ℹ️ status do pedido:",
            data?.status,
            "— não buscando rota",
          );
        }

        setLoading(false);
      });

    // Realtime: atualiza status do pedido
    const channel = supabase
      .channel(`customer-track-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload) =>
          setOrder((prev: any) => (prev ? { ...prev, ...payload.new } : prev)),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  useEffect(() => {
    if (!gps) return;
    const diff = Math.round(
      (Date.now() - new Date(gps.recorded_at).getTime()) / 1000,
    );
    setLastGpsUpdate(
      diff < 60 ? `${diff}s atrás` : `${Math.round(diff / 60)}min atrás`,
    );

    // Atualiza marcador no mapa se já inicializado
    if (mapObjRef.current && markerRef.current && gps.lat && gps.lng) {
      markerRef.current.setLatLng([gps.lat, gps.lng]);
      mapObjRef.current.panTo([gps.lat, gps.lng], { animate: true });
    }
  }, [gps]);

  // Inicializa o mapa Leaflet quando GPS chega
  useEffect(() => {
    if (!mapRef.current || !gps || mapReady.current) return;
    mapReady.current = true;

    const initMap = () => {
      const L = (window as any).L;
      if (!L) return;

      const map = L.map(mapRef.current, {
        center: [gps.lat, gps.lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(
        map,
      );

      // Ícone motoboy
      const motoIcon = L.divIcon({
        html: `<div style="
          width:36px;height:36px;border-radius:50%;
          background:#e91e8c;border:3px solid #fff;
          display:flex;align-items:center;justify-content:center;
          font-size:18px;box-shadow:0 2px 8px rgba(0,0,0,0.3);
        ">🏍️</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        className: "",
      });

      markerRef.current = L.marker([gps.lat, gps.lng], {
        icon: motoIcon,
      }).addTo(map);

      // Círculo de destino se tiver endereço do pedido
      const pulse = L.divIcon({
        html: `<div style="width:20px;height:20px;border-radius:50%;border:3px solid #e91e8c;animation:chegô-ring 1.5s ease-out infinite;"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        className: "",
      });
      L.marker([gps.lat, gps.lng], { icon: pulse }).addTo(map);

      mapObjRef.current = map;
    };

    if ((window as any).L) {
      initMap();
    } else {
      // Carrega Leaflet se ainda não carregado
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      if (!document.querySelector('script[src*="leaflet"]')) {
        const script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = initMap;
        document.head.appendChild(script);
      } else {
        setTimeout(initMap, 500);
      }
    }

    return () => {
      mapObjRef.current?.remove();
      mapObjRef.current = null;
      markerRef.current = null;
      mapReady.current = false;
    };
  }, [gps?.lat, gps?.lng]);

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
  if (!order)
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
        <p style={{ color: "#aaa" }}>Pedido não encontrado</p>
      </div>
    );

  const stepIdx = STATUS_STEPS.indexOf(order.status);
  const isDelivery = order.status === "in_delivery";
  const isDelivered = order.status === "delivered";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 24,
      }}
    >
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
          ← Meus pedidos
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <p style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
            {isDelivered
              ? "✓ Entregue!"
              : (STATUS_LABEL[order.status] ?? "Pedido")}
          </p>
          {isDelivery && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: colors.rosa,
                animation: "chegô-blink 1s ease-in-out infinite",
              }}
            />
          )}
        </div>
        <p
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}
        >
          {order.stores?.name}{" "}
          {gps && isDelivery ? `· GPS ${lastGpsUpdate}` : ""}
        </p>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Mapa GPS real com Leaflet */}
        {(isDelivery || isDelivered) && (
          <div
            style={{
              borderRadius: 14,
              overflow: "hidden",
              position: "relative",
              height: 220,
            }}
          >
            {/* Mapa Leaflet */}
            <div ref={mapRef} style={{ width: "100%", height: "100%" }} />

            {/* Overlay enquanto aguarda GPS */}
            {!gps && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: colors.roxoMedio,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
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
                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                  Aguardando localização do motoboy...
                </p>
              </div>
            )}

            {/* Badge GPS atualizado */}
            {gps && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  zIndex: 999,
                  background: "rgba(28,10,46,0.8)",
                  borderRadius: 8,
                  padding: "4px 8px",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: "#22c55e",
                    animation: "chegô-blink 1.5s ease-in-out infinite",
                  }}
                />
                <span style={{ fontSize: 10, color: "#fff" }}>
                  GPS · {lastGpsUpdate}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Barra de progresso de status */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            {STATUS_STEPS.map((s, i) => (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: i < STATUS_STEPS.length - 1 ? 1 : 0,
                }}
              >
                <div
                  style={{
                    width: i === stepIdx ? 14 : 10,
                    height: i === stepIdx ? 14 : 10,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: i <= stepIdx ? colors.rosa : colors.bordaLilas,
                    border: i === stepIdx ? `2px solid #fff` : "none",
                    outline:
                      i === stepIdx ? `2px solid ${colors.rosa}` : "none",
                    animation:
                      i === stepIdx
                        ? "chegô-blink 1.2s ease-in-out infinite"
                        : "none",
                    transition: "all 0.3s",
                  }}
                />
                {i < STATUS_STEPS.length - 1 && (
                  <div
                    style={{
                      flex: 1,
                      height: 2,
                      background: i < stepIdx ? colors.rosa : colors.bordaLilas,
                      transition: "background 0.3s",
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            {["Confirmado", "Prep.", "Pronto", "A caminho", "Entregue"].map(
              (label, i) => (
                <p
                  key={label}
                  style={{
                    fontSize: 8,
                    fontWeight: i === stepIdx ? 700 : 400,
                    color: i <= stepIdx ? colors.rosa : "#bbb",
                    textAlign: "center",
                    flex: 1,
                  }}
                >
                  {label}
                </p>
              ),
            )}
          </div>
        </div>

        {/* ETA */}
        {isDelivery && (
          <div
            style={{
              background: "#fff",
              borderRadius: 13,
              border: `1.5px solid ${colors.rosa}`,
              padding: "14px 16px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              Previsão de chegada
            </p>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 32,
                color: colors.noite,
                lineHeight: 1,
              }}
            >
              ~8 <span style={{ fontSize: 16, color: colors.rosa }}>min</span>
            </p>
            <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
              {order.delivery_address ?? ""}
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: colors.rosa,
                  animation: "chegô-blink 1s ease-in-out infinite",
                }}
              />
              <p style={{ fontSize: 11, fontWeight: 700, color: colors.rosa }}>
                Motoboy a caminho
              </p>
            </div>
          </div>
        )}

        {/* Itens do pedido */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Itens
          </p>
          {order.order_items?.map((item: any, i: number) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "5px 0",
                borderBottom:
                  i < order.order_items.length - 1
                    ? `1px solid ${colors.fundo}`
                    : "none",
              }}
            >
              <span style={{ fontSize: 12, color: colors.noite }}>
                {item.quantity}× {item.products?.name}
              </span>
              <span
                style={{ fontSize: 12, fontWeight: 600, color: colors.rosa }}
              >
                R$ {(item.quantity * item.unit_price).toFixed(2)}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 8,
              paddingTop: 8,
              borderTop: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <span
              style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
            >
              Total
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.rosa }}>
              R$ {Number(order.total).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes chegô-blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes chegô-ring  { 0%{transform:scale(0.8);opacity:0.8} 100%{transform:scale(2.2);opacity:0} }
      `}</style>
    </div>
  );
}
