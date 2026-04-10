import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../hooks/useStore";
import { useOrders, Order, OrderStatus } from "../../hooks/useOrders";
import { colors, Logo, Spinner, Toast } from "../../components/ui";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  in_delivery: "Em entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_NEXT: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus }>
> = {
  pending: { label: "Confirmar", next: "confirmed" },
  confirmed: { label: "Preparar", next: "preparing" },
  preparing: { label: "Pronto!", next: "ready" },
  ready: { label: "Entregar", next: "in_delivery" },
};

const STATUS_COLORS: Record<
  OrderStatus,
  { bg: string; text: string; border: string }
> = {
  pending: { bg: "#fff8e6", text: "#b45309", border: "#fcd34d" },
  confirmed: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  preparing: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  ready: { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  in_delivery: { bg: "#fdf4ff", text: "#7e22ce", border: "#d8b4fe" },
  delivered: { bg: "#f0fdf4", text: "#15803d", border: "#86efac" },
  cancelled: { bg: "#fef2f2", text: "#991b1b", border: "#fca5a5" },
};

type FilterTab = "active" | "pending" | "ready" | "delivered";

export default function StoreDashboard() {
  const navigate = useNavigate();

  // ── TODOS os hooks primeiro, sem nenhum return antes ──────
  const { store, loading: storeLoading, toggleOpen, refetch } = useStore();
  const { orders, stats, loading, updateStatus } = useOrders(store?.id ?? null);

  const [filter, setFilter] = useState<FilterTab>("active");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toggling, setToggling] = useState(false);

  // Recarrega a loja periodicamente enquanto não estiver cadastrada
  useEffect(() => {
    if (storeLoading || store) return;
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [storeLoading, store, refetch]);

  // ── Helpers ───────────────────────────────────────────────
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleToggleOpen() {
    if (!store) return;
    setToggling(true);
    try {
      await toggleOpen(!store.open_now);
      showToast(store.open_now ? "Loja fechada" : "Loja aberta!");
    } catch {
      showToast("Erro ao atualizar status", "error");
    } finally {
      setToggling(false);
    }
  }

  async function handleUpdateStatus(orderId: string, next: OrderStatus) {
    try {
      await updateStatus(orderId, next);
      showToast(`Pedido ${STATUS_LABEL[next].toLowerCase()}!`);
    } catch {
      showToast("Erro ao atualizar pedido", "error");
    }
  }

  // ── Returns condicionais DEPOIS de todos os hooks ─────────
  if (storeLoading) {
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
  }

  if (!store) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 24px",
          gap: 20,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <Logo size={40} dark />
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.noite,
              marginBottom: 8,
            }}
          >
            Sua loja ainda não está cadastrada
          </p>
          <p style={{ fontSize: 14, color: "#888", lineHeight: 1.6 }}>
            Complete o cadastro da sua loja para começar a receber pedidos.
          </p>
        </div>
        <button
          onClick={() => navigate("/store/setup")}
          style={{
            padding: "13px 28px",
            borderRadius: 13,
            background: colors.rosa,
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Cadastrar minha loja
        </button>
      </div>
    );
  }

  // ── Filtragem de pedidos ───────────────────────────────────
  const filteredOrders = orders.filter((o) => {
    if (filter === "active")
      return !["delivered", "cancelled"].includes(o.status);
    if (filter === "pending")
      return ["pending", "confirmed"].includes(o.status);
    if (filter === "ready") return ["ready", "in_delivery"].includes(o.status);
    if (filter === "delivered") return o.status === "delivered";
    return true;
  });

  // ── Render principal ──────────────────────────────────────
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Logo size={22} />
          <button
            onClick={() => navigate("/store/notifications")}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "rgba(233,30,140,0.12)",
              border: "none",
              cursor: "pointer",
              fontSize: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            🔔
          </button>
        </div>
        <p
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 1,
          }}
        >
          {store.name}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {store.store_groups?.icon} {store.store_groups?.name} · {store.city}
        </p>

        {/* Toggle aberto/fechado */}
        <button
          onClick={handleToggleOpen}
          disabled={toggling}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            background: "rgba(255,255,255,0.06)",
            border: "none",
            borderRadius: 10,
            padding: "8px 12px",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <div
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: store.open_now ? "#22c55e" : "#6b7280",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: store.open_now ? "#22c55e" : "#6b7280",
              fontFamily: "'Space Grotesk', sans-serif",
              flex: 1,
              textAlign: "left",
            }}
          >
            {toggling
              ? "Atualizando..."
              : store.open_now
                ? "Loja aberta"
                : "Loja fechada — toque para abrir"}
          </span>
          <div
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: store.open_now ? "#22c55e" : "#374151",
              position: "relative",
              transition: "background 0.2s",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 3,
                left: store.open_now ? 18 : 3,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#fff",
                transition: "left 0.2s",
              }}
            />
          </div>
        </button>
      </div>

      {/* Cards de resumo */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          padding: "14px 16px 0",
        }}
      >
        {[
          { label: "Pedidos hoje", value: stats.total, color: colors.rosa },
          {
            label: "Faturado",
            value: `R$\u00a0${stats.revenue.toFixed(0)}`,
            color: "#22c55e",
          },
          {
            label: "Em aberto",
            value: stats.pending + stats.preparing,
            color: "#fff",
          },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: colors.noite,
              borderRadius: 12,
              padding: "10px 12px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: s.color,
                lineHeight: 1,
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
                marginTop: 3,
              }}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Abas de filtro */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "14px 16px 0",
          overflowX: "auto",
        }}
      >
        {(
          [
            ["active", "Em andamento"],
            [
              "pending",
              `Novos${stats.pending > 0 ? ` (${stats.pending})` : ""}`,
            ],
            [
              "ready",
              `Prontos / Entrega${stats.ready > 0 ? ` (${stats.ready})` : ""}`,
            ],
            ["delivered", "Entregues"],
          ] as [FilterTab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={{
              padding: "7px 14px",
              borderRadius: 20,
              border: "none",
              whiteSpace: "nowrap",
              background: filter === key ? colors.rosa : colors.lilasClaro,
              color: filter === key ? "#fff" : colors.noite,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              transition: "all 0.15s",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Lista de pedidos */}
      <div
        style={{
          padding: "12px 16px",
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

        {!loading && filteredOrders.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>🍽️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum pedido aqui
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              {filter === "active"
                ? "Aguardando novos pedidos..."
                : "Sem pedidos nessa categoria hoje"}
            </p>
          </div>
        )}

        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onUpdateStatus={handleUpdateStatus}
            onPress={() => navigate(`/store/orders/${order.id}`)}
          />
        ))}
      </div>

      <BottomNav active="orders" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

// ── Card de pedido ────────────────────────────────────────
function OrderCard({
  order,
  onUpdateStatus,
  onPress,
}: {
  order: Order;
  onUpdateStatus: (id: string, next: OrderStatus) => void;
  onPress: () => void;
}) {
  const sc = STATUS_COLORS[order.status];
  const next = STATUS_NEXT[order.status];
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items =
    order.order_items
      ?.map((i) => `${i.quantity}× ${i.products?.name}`)
      .join(" · ") ?? "";

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 14,
        border: `1px solid ${colors.bordaLilas}`,
        overflow: "hidden",
        cursor: "pointer",
      }}
      onClick={onPress}
    >
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 10, color: "#aaa", marginBottom: 2 }}>
            #{order.id.slice(0, 6).toUpperCase()} · {order.profiles?.full_name}{" "}
            · {time}
          </p>
          <p
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: colors.noite,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {items || "Ver itens"}
          </p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 9px",
            borderRadius: 10,
            flexShrink: 0,
            background: sc.bg,
            color: sc.text,
            border: `1px solid ${sc.border}`,
          }}
        >
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      {order.notes && (
        <div
          style={{
            padding: "0 14px 8px",
            fontSize: 11,
            color: "#888",
            fontStyle: "italic",
          }}
        >
          💬 {order.notes}
        </div>
      )}

      <div
        style={{
          background: colors.fundo,
          padding: "8px 14px",
          borderTop: `1px solid ${colors.bordaLilas}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.rosa }}>
          R$ {Number(order.total).toFixed(2)}
        </p>
        {next && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUpdateStatus(order.id, next.next);
            }}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              background: colors.noite,
              color: "#fff",
              border: "none",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {next.label}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Bottom Navigation ─────────────────────────────────────
export function BottomNav({
  active,
}: {
  active: "orders" | "products" | "route" | "profile";
}) {
  const navigate = useNavigate();
  const items = [
    { key: "orders", icon: "🏠", label: "Pedidos", path: "/store" },
    { key: "products", icon: "📦", label: "Produtos", path: "/store/products" },
    { key: "route", icon: "🗺️", label: "Rota", path: "/store/route" },
    { key: "profile", icon: "👤", label: "Perfil", path: "/store/profile" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 480,
        background: "#fff",
        borderTop: `1px solid ${colors.bordaLilas}`,
        display: "flex",
        padding: "8px 0 20px",
        zIndex: 100,
      }}
    >
      {items.map((item) => (
        <button
          key={item.key}
          onClick={() => navigate(item.path)}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: active === item.key ? colors.rosa : "#aaa",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
