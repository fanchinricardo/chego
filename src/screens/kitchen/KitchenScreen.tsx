import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Spinner } from "../../components/ui";

interface KitchenItem {
  id: string;
  name: string;
  quantity: number;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "served";
  created_at: string;
  order_id: string;
  table_number: number | null;
  table_name: string | null;
  waiter_name: string | null;
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

export default function KitchenScreen() {
  const { profile, signOut } = useAuth();
  const storeId = profile?.store_id ?? null;

  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    if (!storeId) return;

    // 1. Busca os order_ids da loja com pedidos abertos
    const { data: orders } = await supabase
      .from("pdv_orders")
      .select("id, pdv_tables(number, name), profiles(full_name)")
      .eq("store_id", storeId)
      .eq("status", "open");

    if (!orders || orders.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const orderIds = orders.map((o: any) => o.id);

    // 2. Busca os itens desses pedidos
    const { data } = await supabase
      .from("pdv_order_items")
      .select("id, name, quantity, notes, status, created_at, order_id")
      .in("order_id", orderIds)
      .in("status", ["pending", "preparing", "ready"])
      .order("created_at", { ascending: true });

    const orderMap: Record<string, any> = {};
    orders.forEach((o: any) => {
      orderMap[o.id] = o;
    });

    const mapped: KitchenItem[] = (data ?? []).map((d: any) => {
      const order = orderMap[d.order_id];
      return {
        id: d.id,
        name: d.name,
        quantity: d.quantity,
        notes: d.notes,
        status: d.status,
        created_at: d.created_at,
        order_id: d.order_id,
        table_number: order?.pdv_tables?.number ?? null,
        table_name: order?.pdv_tables?.name ?? null,
        waiter_name: order?.profiles?.full_name ?? null,
      };
    });

    setItems(mapped);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchItems();
    if (!storeId) return;
    const ch = supabase
      .channel(`kitchen-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_order_items" },
        fetchItems,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchItems, storeId]);

  async function updateStatus(id: string, next: string) {
    setUpdating(id);
    await supabase
      .from("pdv_order_items")
      .update({ status: next })
      .eq("id", id);
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

  const counts = {
    active: items.filter((i) => ["pending", "preparing"].includes(i.status))
      .length,
    pending: items.filter((i) => i.status === "pending").length,
    preparing: items.filter((i) => i.status === "preparing").length,
    ready: items.filter((i) => i.status === "ready").length,
  };

  const filtered = items.filter((i) => {
    if (filter === "active") return ["pending", "preparing"].includes(i.status);
    return i.status === filter;
  });

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
            </p>
          </div>
          {/* Contadores */}
          <div style={{ display: "flex", gap: 8 }}>
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
          </div>
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
              alignSelf: "flex-start",
            }}
          >
            Sair
          </button>
        </div>

        {/* Filtros */}
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

      {/* Cards */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : filtered.length === 0 ? (
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
                ? "Nenhum item para preparar"
                : "Nenhum item aqui"}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
              gap: 12,
            }}
          >
            {filtered.map((item) => {
              const cfg = STATUS_CFG[item.status];
              const urgent =
                isUrgent(item.created_at) && item.status === "pending";
              const isUpd = updating === item.id;
              const table =
                item.table_name ??
                (item.table_number ? `Mesa ${item.table_number}` : "—");

              return (
                <div
                  key={item.id}
                  style={{
                    background: cfg.bg,
                    border: `2px solid ${urgent ? "#ef4444" : cfg.border}`,
                    borderRadius: 16,
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {/* Urgente */}
                  {urgent && (
                    <div
                      style={{
                        background: "#ef4444",
                        borderRadius: 6,
                        padding: "3px 8px",
                        alignSelf: "flex-start",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: "#fff",
                          letterSpacing: "0.05em",
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
                    }}
                  >
                    <div
                      style={{
                        background: urgent ? "#ef4444" : cfg.dot,
                        borderRadius: 8,
                        padding: "3px 10px",
                      }}
                    >
                      <p
                        style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}
                      >
                        {table}
                      </p>
                    </div>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: urgent ? "#ef4444" : cfg.dot,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: urgent ? "#ef4444" : cfg.text,
                        }}
                      >
                        {timeAgo(item.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Nome + qtd */}
                  <div>
                    <p
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: cfg.text,
                        lineHeight: 1.2,
                      }}
                    >
                      {item.quantity}× {item.name}
                    </p>
                    {item.waiter_name && (
                      <p
                        style={{
                          fontSize: 10,
                          color: cfg.text,
                          opacity: 0.6,
                          marginTop: 2,
                        }}
                      >
                        🧑‍🍳 {item.waiter_name.split(" ")[0]}
                      </p>
                    )}
                  </div>

                  {/* Observação */}
                  {item.notes && (
                    <div
                      style={{
                        background: "rgba(0,0,0,0.06)",
                        borderRadius: 8,
                        padding: "7px 10px",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 12,
                          color: cfg.text,
                          fontStyle: "italic",
                        }}
                      >
                        📝 {item.notes}
                      </p>
                    </div>
                  )}

                  {/* Status + botão */}
                  <div
                    style={{
                      marginTop: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: cfg.dot,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: cfg.text,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    {cfg.next && (
                      <button
                        onClick={() => updateStatus(item.id, cfg.next!)}
                        disabled={isUpd}
                        style={{
                          padding: "10px",
                          borderRadius: 10,
                          border: "none",
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: isUpd ? "wait" : "pointer",
                          opacity: isUpd ? 0.7 : 1,
                          fontFamily: "'Space Grotesk', sans-serif",
                          color: "#fff",
                          background:
                            cfg.next === "ready"
                              ? "#22c55e"
                              : cfg.next === "preparing"
                                ? colors.rosa
                                : "#888",
                        }}
                      >
                        {isUpd ? "..." : cfg.nextLabel}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
