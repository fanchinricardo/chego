import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Spinner } from "../../components/ui";
import { notify } from "../../services/whatsapp";

interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "served";
  created_at: string;
  category: string | null;
}

interface KitchenGroup {
  order_id: string;
  table_label: string;
  waiter_name: string | null;
  source: "pdv" | "delivery";
  created_at: string;
  items: KitchenItem[];
}

const STATUS_CFG = {
  pending: {
    label: "Aguardando",
    bg: "#fff8e6",
    border: "#fcd34d",
    text: "#b45309",
    dot: "#f59e0b",
    next: "preparing" as string | null,
    nextLabel: "Iniciar preparo",
  },
  preparing: {
    label: "Preparando",
    bg: "#fff0f8",
    border: colors.rosa,
    text: colors.rosa,
    dot: colors.rosa,
    next: "ready",
    nextLabel: "✓ Pronto!",
  },
  ready: {
    label: "Pronto",
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#15803d",
    dot: "#22c55e",
    next: "served",
    nextLabel: "Entregue",
  },
  served: {
    label: "Entregue",
    bg: "#f5f5f5",
    border: "#d1d5db",
    text: "#888",
    dot: "#ccc",
    next: null,
    nextLabel: "",
  },
};

const FILTERS = [
  { key: "active", label: "Ativos" },
  { key: "pending", label: "Aguardando" },
  { key: "preparing", label: "Preparando" },
  { key: "ready", label: "Prontos" },
];

function groupStatus(
  items: KitchenItem[],
): "pending" | "preparing" | "ready" | "served" {
  if (items.some((i) => i.status === "pending")) return "pending";
  if (items.some((i) => i.status === "preparing")) return "preparing";
  if (items.some((i) => i.status === "ready")) return "ready";
  return "served";
}

export default function KitchenScreen() {
  const { profile, signOut } = useAuth();
  const userId = profile?.id ?? null;
  const kitchenName = profile?.full_name ?? "Cozinha";
  const storeId = profile?.store_id ?? null;

  const kitchenCategories: string[] = profile?.kitchen_categories ?? [];

  const [groups, setGroups] = useState<KitchenGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [readyTables, setReadyTables] = useState<Set<string>>(new Set());

  const fetchItems = useCallback(async () => {
    if (!storeId) return;

    // ── PDV ──────────────────────────────────────────────
    const { data: pdvOrders } = await supabase
      .from("pdv_orders")
      .select(
        "id, created_at, table:pdv_tables!pdv_orders_table_id_fkey(number, name), profiles(full_name)",
      )
      .eq("store_id", storeId)
      .eq("status", "open");

    const pdvOrderIds = (pdvOrders ?? []).map((o: any) => o.id);
    const pdvOrderMap: Record<string, any> = {};
    (pdvOrders ?? []).forEach((o: any) => {
      pdvOrderMap[o.id] = o;
    });

    let pdvData: any[] = [];
    if (pdvOrderIds.length > 0) {
      const { data } = await supabase
        .from("pdv_order_items")
        .select(
          "id, name, quantity, notes, status, created_at, order_id, product_id, products(category)",
        )
        .in("order_id", pdvOrderIds)
        .in("status", ["pending", "preparing", "ready"])
        .order("created_at", { ascending: true });
      pdvData = data ?? [];
    }

    const pdvGroups: KitchenGroup[] = [];
    for (const order of pdvOrders ?? []) {
      const orderItems = pdvData
        .filter((d: any) => d.order_id === order.id)
        .map((d: any) => ({
          id: d.id,
          name: d.name,
          quantity: d.quantity,
          notes: d.notes,
          status: d.status,
          created_at: d.created_at,
          category: d.products?.category ?? null,
        }));
      if (orderItems.length === 0) continue;
      pdvGroups.push({
        order_id: order.id,
        table_label:
          (order as any).table?.name ??
          `Mesa ${(order as any).table?.number ?? "?"}`,
        waiter_name: order.profiles?.full_name ?? null,
        source: "pdv",
        created_at: order.created_at,
        items: orderItems,
      });
    }

    // ── Delivery ─────────────────────────────────────────
    const { data: deliveryOrders } = await supabase
      .from("orders")
      .select(
        "id, created_at, status, profiles(full_name), order_items(id, quantity, notes, custom_name, products(name, category))",
      )
      .eq("store_id", storeId)
      .in("status", ["confirmed", "preparing"])
      .order("created_at", { ascending: true });

    const deliveryGroups: KitchenGroup[] = (deliveryOrders ?? [])
      .map((order: any) => ({
        order_id: order.id,
        table_label: `🛵 ${order.profiles?.full_name ?? "Delivery"}`,
        waiter_name: null,
        source: "delivery" as const,
        created_at: order.created_at,
        items: (order.order_items ?? []).map((item: any) => ({
          id: item.id,
          name: item.custom_name ?? item.products?.name ?? "Item",
          quantity: item.quantity,
          notes: item.notes,
          status: order.status === "confirmed" ? "pending" : "preparing",
          created_at: order.created_at,
          category: item.products?.category ?? null,
        })),
      }))
      .filter((g) => g.items.length > 0);

    const all = [...pdvGroups, ...deliveryGroups].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
    setGroups(all);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchItems();
    const interval = setInterval(fetchItems, 5000);
    return () => clearInterval(interval);
  }, [fetchItems]);

  async function updateItemStatus(
    item: KitchenItem,
    next: string,
    source: "pdv" | "delivery",
    orderId: string,
  ) {
    setUpdating(item.id);
    if (source === "pdv") {
      await supabase
        .from("pdv_order_items")
        .update({ status: next })
        .eq("id", item.id);
      // Verifica se todos os itens do grupo ficaram prontos
      if (next === "ready") {
        const group = groups.find((g) => g.order_id === orderId);
        if (group) {
          const otherItems = group.items.filter((i) => i.id !== item.id);
          const allReady = otherItems.every(
            (i) => i.status === "ready" || i.status === "served",
          );
          if (allReady) {
            setReadyTables((prev) => new Set([...prev, orderId]));
          }
        }
      }
    } else {
      const newOrderStatus = next === "ready" ? "ready" : "preparing";
      await supabase
        .from("orders")
        .update({ status: newOrderStatus })
        .eq("id", orderId);
      if (next === "ready") notify.orderReady(orderId);
    }
    await fetchItems();
    setUpdating(null);
  }

  async function updateAllInGroup(group: KitchenGroup, next: string) {
    setUpdating(group.order_id);
    if (group.source === "pdv") {
      const pendingIds = group.items
        .filter((i) => i.status !== "served" && i.status !== next)
        .map((i) => i.id);
      for (const id of pendingIds) {
        const updateData: any = { status: next };
        if (next === "ready") updateData.ready_by = userId;
        await supabase.from("pdv_order_items").update(updateData).eq("id", id);
      }
      // Pisca a mesa quando pronto
      if (next === "ready") {
        setReadyTables((prev) => new Set([...prev, group.order_id]));
      }
    } else {
      const newOrderStatus = next === "ready" ? "ready" : "preparing";
      await supabase
        .from("orders")
        .update({ status: newOrderStatus })
        .eq("id", group.order_id);
      // Envia WhatsApp quando pedido delivery fica pronto
      if (next === "ready") {
        notify.orderReady(group.order_id);
      }
    }
    await fetchItems();
    setUpdating(null);
  }

  function timeAgo(d: string) {
    const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}min`;
    return `${Math.floor(s / 3600)}h`;
  }

  function isUrgent(d: string) {
    return Date.now() - new Date(d).getTime() > 10 * 60 * 1000;
  }

  const filteredGroups = groups.filter((g) => {
    const visibleItems =
      kitchenCategories.length > 0
        ? g.items.filter(
            (i) => !i.category || kitchenCategories.includes(i.category),
          )
        : g.items;
    if (visibleItems.length === 0) return false;
    const status = groupStatus(visibleItems);
    if (filter === "active") return ["pending", "preparing"].includes(status);
    return status === filter;
  });

  const counts = {
    active: groups.filter((g) =>
      ["pending", "preparing"].includes(groupStatus(g.items)),
    ).length,
    pending: groups.filter((g) => groupStatus(g.items) === "pending").length,
    preparing: groups.filter((g) => groupStatus(g.items) === "preparing")
      .length,
    ready: groups.filter((g) => groupStatus(g.items) === "ready").length,
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#111",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.noite,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          padding: "14px 20px",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              🍳 Cozinha
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                marginTop: 3,
              }}
            >
              Tempo real · ordenado por chegada
              {kitchenCategories.length > 0 &&
                ` · ${kitchenCategories.join(", ")}`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {[
              { label: "Aguardando", count: counts.pending, color: "#f59e0b" },
              {
                label: "Preparando",
                count: counts.preparing,
                color: colors.rosa,
              },
              { label: "Prontos", count: counts.ready, color: "#22c55e" },
            ].map((c) => (
              <div
                key={c.label}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 10,
                  padding: "8px 14px",
                  textAlign: "center",
                  minWidth: 64,
                }}
              >
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 22,
                    color: c.color,
                    lineHeight: 1,
                  }}
                >
                  {c.count}
                </p>
                <p
                  style={{
                    fontSize: 9,
                    color: "rgba(255,255,255,0.3)",
                    marginTop: 2,
                  }}
                >
                  {c.label}
                </p>
              </div>
            ))}
            <button
              onClick={signOut}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "8px 16px",
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Sair
            </button>
          </div>
        </div>
        <div
          style={{
            maxWidth: 1100,
            margin: "10px auto 0",
            display: "flex",
            gap: 6,
          }}
        >
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                padding: "6px 16px",
                borderRadius: 20,
                background:
                  filter === f.key ? "#fff" : "rgba(255,255,255,0.08)",
                color:
                  filter === f.key ? colors.noite : "rgba(255,255,255,0.45)",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {f.label}
              {(counts as any)[f.key] > 0 ? ` (${(counts as any)[f.key]})` : ""}
            </button>
          ))}
        </div>
      </div>

      {/* Cards agrupados */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🍳</p>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {filter === "active"
                ? "Nenhum pedido para preparar"
                : "Nenhum pedido aqui"}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: 12,
            }}
          >
            {filteredGroups.map((group) => {
              const visibleItems =
                kitchenCategories.length > 0
                  ? group.items.filter(
                      (i) =>
                        !i.category || kitchenCategories.includes(i.category),
                    )
                  : group.items;
              const status = groupStatus(visibleItems);
              const cfg = STATUS_CFG[status];
              const urgent = isUrgent(group.created_at) && status === "pending";
              const isOpen = expanded === group.order_id;
              const isUpd = updating === group.order_id;

              const pendingCount = visibleItems.filter(
                (i) => i.status === "pending",
              ).length;
              const preparingCount = visibleItems.filter(
                (i) => i.status === "preparing",
              ).length;
              const readyCount = visibleItems.filter(
                (i) => i.status === "ready",
              ).length;

              return (
                <div
                  key={group.order_id}
                  style={{
                    background: cfg.bg,
                    border: `2px solid ${readyTables.has(group.order_id) ? "#22c55e" : urgent ? "#ef4444" : cfg.border}`,
                    borderRadius: 16,
                    overflow: "hidden",
                  }}
                >
                  {/* Header do card — clicável para expandir */}
                  <div
                    onClick={() => setExpanded(isOpen ? null : group.order_id)}
                    style={{ padding: "12px 14px", cursor: "pointer" }}
                  >
                    {urgent && (
                      <div
                        style={{
                          background: "#ef4444",
                          borderRadius: 6,
                          padding: "2px 8px",
                          display: "inline-block",
                          marginBottom: 6,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          ⚠️ ATRASADO
                        </p>
                      </div>
                    )}

                    {/* Mesa + tempo */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: 8,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            background: readyTables.has(group.order_id)
                              ? "#22c55e"
                              : urgent
                                ? "#ef4444"
                                : group.source === "delivery"
                                  ? "#3b82f6"
                                  : cfg.dot,
                            borderRadius: 8,
                            padding: "3px 10px",
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#fff",
                            }}
                          >
                            {group.table_label}
                          </p>
                        </div>
                        {readyTables.has(group.order_id) && (
                          <div
                            style={{
                              background: "#22c55e",
                              borderRadius: 6,
                              padding: "2px 8px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#fff",
                              }}
                            >
                              🔔 PRONTO!
                            </p>
                          </div>
                        )}
                        {group.source === "delivery" && (
                          <div
                            style={{
                              background: "#1d4ed8",
                              borderRadius: 6,
                              padding: "2px 6px",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: "#fff",
                              }}
                            >
                              DELIVERY
                            </p>
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: urgent ? "#ef4444" : cfg.text,
                          }}
                        >
                          {timeAgo(group.created_at)}
                        </span>
                        <span style={{ fontSize: 14, color: cfg.text }}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {/* Resumo dos itens */}
                    <div style={{ marginBottom: 8 }}>
                      {visibleItems.slice(0, isOpen ? 999 : 2).map((item) => (
                        <p
                          key={item.id}
                          style={{
                            fontSize: 13,
                            color: cfg.text,
                            lineHeight: 1.5,
                          }}
                        >
                          {item.quantity}× {item.name}
                          {item.notes && (
                            <span style={{ fontSize: 11, opacity: 0.6 }}>
                              {" "}
                              · {item.notes}
                            </span>
                          )}
                        </p>
                      ))}
                      {!isOpen && visibleItems.length > 2 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: cfg.text,
                            opacity: 0.6,
                          }}
                        >
                          +{visibleItems.length - 2} mais...
                        </p>
                      )}
                    </div>

                    {/* Contadores de status */}
                    <div style={{ display: "flex", gap: 6 }}>
                      {pendingCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "#fff8e6",
                            border: "1px solid #fcd34d",
                            borderRadius: 6,
                            padding: "2px 7px",
                            color: "#b45309",
                            fontWeight: 600,
                          }}
                        >
                          {pendingCount} aguardando
                        </span>
                      )}
                      {preparingCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "#fff0f8",
                            border: `1px solid ${colors.rosa}`,
                            borderRadius: 6,
                            padding: "2px 7px",
                            color: colors.rosa,
                            fontWeight: 600,
                          }}
                        >
                          {preparingCount} preparando
                        </span>
                      )}
                      {readyCount > 0 && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: 6,
                            padding: "2px 7px",
                            color: "#15803d",
                            fontWeight: 600,
                          }}
                        >
                          {readyCount} pronto
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Itens expandidos */}
                  {isOpen && (
                    <div
                      style={{
                        borderTop: `1px solid ${cfg.border}`,
                        background: "rgba(0,0,0,0.04)",
                      }}
                    >
                      {visibleItems.map((item) => {
                        const iCfg = STATUS_CFG[item.status];
                        const iIsUpd = updating === item.id;
                        return (
                          <div
                            key={item.id}
                            style={{
                              padding: "10px 14px",
                              borderBottom: `1px solid ${cfg.border}`,
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <p
                                style={{
                                  fontSize: 13,
                                  fontWeight: 700,
                                  color: iCfg.text,
                                }}
                              >
                                {item.quantity}× {item.name}
                              </p>
                              {item.notes && (
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: iCfg.text,
                                    opacity: 0.7,
                                    fontStyle: "italic",
                                  }}
                                >
                                  📝 {item.notes}
                                </p>
                              )}
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 4,
                                  marginTop: 3,
                                }}
                              >
                                <div
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: "50%",
                                    background: iCfg.dot,
                                  }}
                                />
                                <span
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 600,
                                    color: iCfg.text,
                                  }}
                                >
                                  {iCfg.label}
                                </span>
                              </div>
                            </div>
                            {iCfg.next && group.source === "pdv" && (
                              <button
                                onClick={() =>
                                  updateItemStatus(
                                    item,
                                    iCfg.next!,
                                    group.source,
                                    group.order_id,
                                  )
                                }
                                disabled={iIsUpd}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: 8,
                                  border: "none",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: iIsUpd ? "wait" : "pointer",
                                  color: "#fff",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                  background:
                                    iCfg.next === "ready"
                                      ? "#22c55e"
                                      : iCfg.next === "preparing"
                                        ? colors.rosa
                                        : "#888",
                                }}
                              >
                                {iIsUpd ? "..." : iCfg.nextLabel}
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {/* Botão avançar todos */}
                      {cfg.next && (
                        <div
                          style={{
                            padding: "10px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <button
                            onClick={() => updateAllInGroup(group, cfg.next!)}
                            disabled={isUpd}
                            style={{
                              width: "100%",
                              padding: "10px",
                              borderRadius: 10,
                              border: "none",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: isUpd ? "wait" : "pointer",
                              color: "#fff",
                              fontFamily: "'Space Grotesk', sans-serif",
                              background:
                                cfg.next === "ready"
                                  ? "#22c55e"
                                  : cfg.next === "preparing"
                                    ? colors.rosa
                                    : "#888",
                            }}
                          >
                            {isUpd
                              ? "..."
                              : `${cfg.nextLabel} — todos os itens`}
                          </button>
                          {readyTables.has(group.order_id) && (
                            <button
                              onClick={() =>
                                setReadyTables((prev) => {
                                  const n = new Set(prev);
                                  n.delete(group.order_id);
                                  return n;
                                })
                              }
                              style={{
                                width: "100%",
                                padding: "10px",
                                borderRadius: 10,
                                border: "2px solid #22c55e",
                                background: "#f0fdf4",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                color: "#15803d",
                                fontFamily: "'Space Grotesk', sans-serif",
                              }}
                            >
                              ✓ Garçom notificado — confirmar retirada
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
