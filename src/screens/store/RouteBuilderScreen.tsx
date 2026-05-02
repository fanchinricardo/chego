import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useStore } from "../../hooks/useStore";
import { useReadyOrders } from "../../hooks/useOrders";
import { useMotoboys } from "../../hooks/useRoutes";
import {
  optimizeRoute,
  Waypoint,
  geocodeAddress,
} from "../../services/routing";
import { colors, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

// Resolve o storeId para donos E funcionários de balcão
function useStoreId() {
  const { store } = useStore();
  const { profile } = useAuth();
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    // 1. Dono da loja — useStore já resolve
    if (store?.id) {
      setResolvedId(store.id);
      return;
    }
    // 2. Funcionário vinculado via profile.store_id
    if ((profile as any)?.store_id) {
      setResolvedId((profile as any).store_id);
      return;
    }
    // 3. Fallback: busca no Supabase pelo owner_id
    if (profile?.id) {
      supabase
        .from("stores")
        .select("id")
        .eq("owner_id", profile.id)
        .single()
        .then(({ data }) => {
          if (data?.id) setResolvedId(data.id);
        });
    }
  }, [store?.id, profile]);

  return resolvedId;
}

export default function RouteBuilderScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const storeId = useStoreId();

  const { orders, loading: ordersLoading } = useReadyOrders(storeId);
  const { motoboys, loading: motoboyLoading } = useMotoboys(storeId);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [motoboyId, setMotoboyId] = useState<string>("");
  const [showMotoboys, setShowMotoboys] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  const readyOrders = orders.filter((o) => o.status === "ready");

  function toggleOrder(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(readyOrders.map((o) => o.id)));
  }

  const selectedMotoboy = motoboys.find((m) => m.id === motoboyId);
  const totalValue = readyOrders
    .filter((o) => selected.has(o.id))
    .reduce((s, o) => s + Number(o.total), 0);

  async function handleOptimize() {
    if (selected.size === 0) {
      showToast("Selecione ao menos 1 pedido", "error");
      return;
    }
    if (!motoboyId) {
      showToast("Escolha um motoboy", "error");
      return;
    }
    if (!storeId) return;

    setOptimizing(true);
    try {
      const selectedOrders = readyOrders.filter((o) => selected.has(o.id));

      const waypoints: Waypoint[] = [];
      for (const o of selectedOrders) {
        let lat = o.delivery_lat ? Number(o.delivery_lat) : null;
        let lng = o.delivery_lng ? Number(o.delivery_lng) : null;

        if ((!lat || !lng) && o.delivery_address) {
          try {
            const geo = await geocodeAddress(o.delivery_address);
            if (geo) {
              lat = geo.lat;
              lng = geo.lng;
            }
          } catch {
            /* ignora */
          }
        }

        waypoints.push({
          order_id: o.id,
          customer_name: o.profiles?.full_name ?? "Cliente",
          address: o.delivery_address ?? "Endereço não informado",
          lat: lat ?? 0,
          lng: lng ?? 0,
          total: Number(o.total),
          payment_method: o.payment_method ?? null,
          change_for: o.change_for ? Number(o.change_for) : null,
        });
      }

      // Usa coordenadas da loja se disponíveis, senão SP como fallback
      const storeData =
        store ??
        (await supabase
          .from("stores")
          .select("lat, lng")
          .eq("id", storeId)
          .single()
          .then(({ data }) => data));

      const origin =
        (storeData as any)?.lat && (storeData as any)?.lng
          ? {
              lat: Number((storeData as any).lat),
              lng: Number((storeData as any).lng),
            }
          : { lat: -23.5505, lng: -46.6333 };

      const result = await optimizeRoute(origin, waypoints);

      navigate("/store/route/confirm", {
        state: {
          stops: result.stops,
          totalDist: result.total_distance_km,
          totalMin: result.total_duration_min,
          motoboyId,
          storeId, // agora sempre válido para dono e funcionário
        },
      });
    } catch (err: any) {
      showToast("Erro ao otimizar rota: " + err.message, "error");
    } finally {
      setOptimizing(false);
    }
  }

  if (ordersLoading || motoboyLoading) {
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
          Nova Rota
        </p>
        <p style={{ fontSize: 11, color: "#fff" }}>
          Selecione os pedidos prontos para entrega
        </p>
        <div style={{ display: "flex", gap: 4, marginTop: 12 }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 2,
                background: i === 0 ? colors.amarelo : "rgba(255,255,255,0.12)",
              }}
            />
          ))}
        </div>
        <p style={{ fontSize: 10, color: "#fff", marginTop: 5 }}>
          Passo 1 de 3 — Selecionar pedidos
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
        {/* Aviso se storeId não resolvido */}
        {!storeId && (
          <div
            style={{
              background: "#fff8e6",
              border: "1px solid #fcd34d",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <p style={{ fontSize: 12, color: "#92400e" }}>
              ⚠️ Nenhuma loja associada a este usuário. Peça ao administrador
              para vincular sua conta.
            </p>
          </div>
        )}

        {/* Pedidos prontos */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 8,
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
              Pedidos prontos ({readyOrders.length})
            </p>
            {readyOrders.length > 0 && (
              <button
                onClick={selectAll}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 12,
                  color: colors.rosa,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Selecionar todos
              </button>
            )}
          </div>

          {readyOrders.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "32px 20px",
                background: "#fff",
                borderRadius: 14,
                border: `1px dashed ${colors.bordaLilas}`,
              }}
            >
              <p style={{ fontSize: 28, marginBottom: 8 }}>📦</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
                Nenhum pedido pronto
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: "#aaa",
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              >
                Marque pedidos como "Pronto" no dashboard para adicioná-los a
                uma rota.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {readyOrders.map((order) => {
                const isSelected = selected.has(order.id);
                const items =
                  order.order_items
                    ?.map((i) => `${i.quantity}× ${i.products?.name}`)
                    .join(", ") ?? "";
                return (
                  <div
                    key={order.id}
                    onClick={() => toggleOrder(order.id)}
                    style={{
                      background: "#fff",
                      borderRadius: 13,
                      border: `1.5px solid ${isSelected ? colors.rosa : colors.bordaLilas}`,
                      padding: "10px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        flexShrink: 0,
                        background: isSelected
                          ? colors.rosa
                          : colors.lilasClaro,
                        border: `1.5px solid ${isSelected ? colors.rosa : colors.bordaLilas}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {isSelected ? "✓" : ""}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: colors.noite,
                        }}
                      >
                        #{order.id.slice(0, 6).toUpperCase()} ·{" "}
                        {order.profiles?.full_name}
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
                        {order.delivery_address ?? items}
                      </p>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.rosa,
                        flexShrink: 0,
                      }}
                    >
                      R${Number(order.total).toFixed(0)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Resumo selecionados */}
        {selected.size > 0 && (
          <div
            style={{
              background: colors.noite,
              borderRadius: 12,
              padding: "10px 14px",
              display: "flex",
              gap: 16,
            }}
          >
            {[
              { label: "Selecionados", value: selected.size },
              { label: "Valor total", value: `R$${totalValue.toFixed(0)}` },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center", flex: 1 }}>
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
                    color: "rgba(255,255,255,0.3)",
                    textTransform: "uppercase",
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Escolha de motoboy */}
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
            Motoboy
          </p>

          {!showMotoboys && motoboyId ? (
            <div
              onClick={() => setShowMotoboys(true)}
              style={{
                background: "#fff",
                borderRadius: 13,
                border: `1.5px solid ${colors.rosa}`,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: colors.rosa,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Righteous', cursive",
                  fontSize: 16,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {selectedMotoboy?.profiles?.full_name
                  ?.slice(0, 1)
                  .toUpperCase() ?? "?"}
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
                >
                  {selectedMotoboy?.profiles?.full_name ?? "Motoboy"}
                </p>
                <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                  🏍️ {selectedMotoboy?.vehicle_plate ?? "Placa não cadastrada"}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: "#22c55e",
                    fontWeight: 600,
                    marginTop: 1,
                  }}
                >
                  ● Disponível
                </p>
              </div>
              <p style={{ fontSize: 12, color: colors.rosa, fontWeight: 600 }}>
                Trocar
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {motoboys.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "20px",
                    background: "#fff",
                    borderRadius: 13,
                    border: `1px dashed ${colors.bordaLilas}`,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#888" }}>
                    Nenhum motoboy cadastrado.
                  </p>
                  <button
                    onClick={() => navigate("/store/motoboys")}
                    style={{
                      marginTop: 8,
                      background: "none",
                      border: "none",
                      color: colors.rosa,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Cadastrar motoboy →
                  </button>
                </div>
              ) : (
                motoboys.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => {
                      if (!m.in_route) {
                        setMotoboyId(m.id);
                        setShowMotoboys(false);
                      }
                    }}
                    style={{
                      background: "#fff",
                      borderRadius: 13,
                      border: `1.5px solid ${motoboyId === m.id ? colors.rosa : colors.bordaLilas}`,
                      padding: "10px 14px",
                      cursor: m.in_route ? "not-allowed" : "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      opacity: m.in_route ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        background: m.in_route ? "#9ca3af" : colors.rosa,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "'Righteous', cursive",
                        fontSize: 16,
                        color: "#fff",
                        flexShrink: 0,
                      }}
                    >
                      {m.profiles?.full_name?.slice(0, 1).toUpperCase() ?? "?"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.noite,
                        }}
                      >
                        {m.profiles?.full_name ?? "Motoboy"}
                      </p>
                      <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                        🏍️ {m.vehicle_plate ?? "Placa não cadastrada"}
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          marginTop: 2,
                          color: m.in_route ? "#6b7280" : "#22c55e",
                        }}
                      >
                        {m.in_route ? "● Em rota" : "● Disponível"}
                      </p>
                    </div>
                    {motoboyId === m.id && (
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: colors.rosa,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          color: "#fff",
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        ✓
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Botão otimizar */}
        <button
          onClick={handleOptimize}
          disabled={optimizing || selected.size === 0 || !motoboyId || !storeId}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 13,
            background:
              selected.size > 0 && motoboyId && storeId
                ? colors.rosa
                : "#d1d5db",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor:
              selected.size > 0 && motoboyId && storeId && !optimizing
                ? "pointer"
                : "not-allowed",
            fontFamily: "'Space Grotesk', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {optimizing ? (
            <>
              <Spinner size={18} /> Otimizando rota...
            </>
          ) : (
            "🗺️ Otimizar rota →"
          )}
        </button>
      </div>

      <BottomNav active="route" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
