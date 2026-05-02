import Swal from "sweetalert2";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { useOrders, Order, OrderStatus } from "../../hooks/useOrders";
import { colors, Spinner, Toast } from "../../components/ui";
import { notify } from "../../services/whatsapp";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto",
  in_delivery: "Em entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
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

const PAYMENT_LABEL: Record<string, string> = {
  pix_qr: "⚡ Pix QR",
  pix_manual: "📋 Pix Manual",
  dinheiro: "💵 Dinheiro",
  credito_mp: "💳 Crédito MP",
  credito_ent: "💳 Crédito",
  debito_ent: "💳 Débito",
};

type FilterTab = "active" | "pending" | "ready" | "delivered";

export default function BalcaoHomeScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  // O usuário do balcão pode não ter loja própria — busca o store_id
  // diretamente do profile (campo store_id) ou do hook useStore.
  // Para garantir, buscamos direto no Supabase pelo profile.store_id.
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string>("");

  useEffect(() => {
    async function resolveStore() {
      // 1. Tenta pelo campo store_id do profile (usuário balcão vinculado)
      if ((profile as any)?.store_id) {
        setStoreId((profile as any).store_id);
        const { data } = await supabase
          .from("stores")
          .select("name")
          .eq("id", (profile as any).store_id)
          .single();
        setStoreName(data?.name ?? "");
        return;
      }

      // 2. Fallback: busca loja onde o usuário é dono
      const { data } = await supabase
        .from("stores")
        .select("id, name")
        .eq("owner_id", profile?.id ?? "")
        .single();

      if (data) {
        setStoreId(data.id);
        setStoreName(data.name);
      }
    }

    if (profile) resolveStore();
  }, [profile]);

  const { orders, stats, loading, updateStatus } = useOrders(storeId);

  const [filter, setFilter] = useState<FilterTab>("active");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleUpdateStatus(orderId: string, next: OrderStatus) {
    try {
      await updateStatus(orderId, next);
      showToast(`Pedido ${STATUS_LABEL[next].toLowerCase()}!`);
      if (next === "confirmed") notify.orderConfirmed(orderId);
      if (next === "preparing") notify.orderPreparing(orderId);
      if (next === "ready") notify.orderReady(orderId);
    } catch {
      showToast("Erro ao atualizar pedido", "error");
    }
  }

  const filteredOrders = orders.filter((o) => {
    if (filter === "active")
      return !["delivered", "cancelled"].includes(o.status);
    if (filter === "pending")
      return ["pending", "confirmed"].includes(o.status);
    if (filter === "ready") return ["ready", "in_delivery"].includes(o.status);
    if (filter === "delivered") return o.status === "delivered";
    return true;
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 32,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "20px 20px 20px" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 28,
              color: "#fff",
              letterSpacing: 1,
            }}
          >
            Chegô
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginTop: 2,
            }}
          >
            {storeName
              ? `${storeName} · Olá, ${profile?.full_name?.split(" ")[0]} 👋`
              : `Olá, ${profile?.full_name?.split(" ")[0]} 👋`}
          </p>

          {/* Cards resumo */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginTop: 16,
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
                  background: "rgba(255,255,255,0.08)",
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
        </div>
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "20px 20px 0" }}>
        {/* Acesso rápido */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#aaa",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Acesso rápido
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 24,
          }}
        >
          {[
            {
              icon: "🏪",
              label: "Balcão",
              sub: "Venda avulsa no caixa",
              path: "/cashier/pdv",
              color: colors.rosa,
            },
            {
              icon: "🖥️",
              label: "Caixa",
              sub: "Fechamento de mesas",
              path: "/cashier",
              color: "#7c3aed",
            },
            {
              icon: "🛵",
              label: "Criar rota",
              sub: "Organizar entregas",
              path: "/store/route/new",
              color: "#0ea5e9",
            },
          ].map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                background: "#fff",
                borderRadius: 16,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: item.color + "18",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 22 }}>{item.icon}</span>
              </div>
              <div>
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  {item.label}
                </p>
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>
                  {item.sub}
                </p>
              </div>
              <span style={{ marginLeft: "auto", color: "#ccc", fontSize: 18 }}>
                →
              </span>
            </button>
          ))}
        </div>

        {/* Pedidos Delivery */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#aaa",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Pedidos delivery
        </p>

        {/* Aviso se storeId não resolvido */}
        {!storeId && !loading && (
          <div
            style={{
              background: "#fff8e6",
              border: "1px solid #fcd34d",
              borderRadius: 12,
              padding: "12px 14px",
              marginBottom: 12,
            }}
          >
            <p style={{ fontSize: 12, color: "#92400e" }}>
              ⚠️ Nenhuma loja associada a este usuário. Peça ao administrador
              para vincular sua conta.
            </p>
          </div>
        )}

        {/* Abas de filtro */}
        <div
          style={{
            display: "flex",
            gap: 6,
            overflowX: "auto",
            marginBottom: 12,
            paddingBottom: 2,
          }}
        >
          {(
            [
              ["active", "Em andamento"],
              [
                "pending",
                `Novos${stats.pending > 0 ? ` (${stats.pending})` : ""}`,
              ],
              ["ready", `Prontos${stats.ready > 0 ? ` (${stats.ready})` : ""}`],
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
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Lista */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {loading && (
            <div style={{ textAlign: "center", padding: 40 }}>
              <Spinner color={colors.rosa} />
            </div>
          )}

          {!loading && storeId && filteredOrders.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px 20px",
                background: "#fff",
                borderRadius: 14,
                border: `1px dashed ${colors.bordaLilas}`,
              }}
            >
              <p style={{ fontSize: 28, marginBottom: 8 }}>🍽️</p>
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
            <BalcaoOrderCard
              key={order.id}
              order={order}
              onUpdateStatus={handleUpdateStatus}
              onPress={() => navigate(`/store/orders/${order.id}`)}
            />
          ))}
        </div>

        <button
          onClick={signOut}
          style={{
            marginTop: 24,
            width: "100%",
            padding: "12px",
            borderRadius: 12,
            background: "transparent",
            border: `1px solid ${colors.bordaLilas}`,
            color: "#aaa",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Sair
        </button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

// ── Card de pedido do Balcão ──────────────────────────────────────────────
function BalcaoOrderCard({
  order,
  onUpdateStatus,
  onPress,
}: {
  order: Order;
  onUpdateStatus: (id: string, next: OrderStatus) => void;
  onPress: () => void;
}) {
  const sc = STATUS_COLORS[order.status];
  const time = new Date(order.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const items =
    order.order_items
      ?.map((i) => `${i.quantity}× ${i.custom_name ?? i.products?.name}`)
      .join(" · ") ?? "";
  const isPickup = (order as any).delivery_type === "pickup";
  const isPaid = order.payment_status === "paid";
  const isOnline = ["pix_qr", "credito_mp"].includes(
    (order as any).payment_method ?? "",
  );
  const payLabel =
    PAYMENT_LABEL[(order as any).payment_method ?? ""] ?? "💳 Pagamento";

  // Balcão tem controle total do fluxo de status
  const STATUS_NEXT_BALCAO: Partial<
    Record<OrderStatus, { label: string; next: OrderStatus }>
  > = {
    pending: { label: "Confirmar", next: "confirmed" },
    confirmed: { label: "Preparando", next: "preparing" },
    preparing: { label: "Pronto", next: "ready" },
    ready: isPickup
      ? { label: "Confirmar retirada", next: "delivered" }
      : undefined, // entrega — botão removido, motoboy controla via rota
    // in_delivery: sem botão — quem marca entregue é o motoboy
  };

  const next = STATUS_NEXT_BALCAO[order.status];

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
      {/* Cabeçalho */}
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

      {/* Tags */}
      <div
        style={{
          padding: "0 14px 8px",
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexWrap: "wrap" as const,
        }}
      >
        {isPickup ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 8,
              background: "#f0fdf4",
              color: "#15803d",
              border: "1px solid #86efac",
            }}
          >
            🏪 Retirada
          </span>
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 8,
              background: colors.lilasClaro,
              color: "#7e22ce",
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            🛵 Entrega
          </span>
        )}
        <span style={{ fontSize: 10, color: "#888" }}>{payLabel}</span>
        {isPaid ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 8,
              background: "#f0fdf4",
              color: "#15803d",
              border: "1px solid #86efac",
            }}
          >
            ✓ PAGO
          </span>
        ) : isOnline ? (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 8,
              background: "#fff8e6",
              color: "#b45309",
              border: "1px solid #fcd34d",
            }}
          >
            AGUARD. PAGAMENTO
          </span>
        ) : (
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 8,
              background: colors.lilasClaro,
              color: "#7e22ce",
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            PAGAR NA ENTREGA
          </span>
        )}
      </div>

      {/* Rodapé */}
      <div
        style={{
          background: colors.fundo,
          padding: "8px 14px",
          borderTop: `1px solid ${colors.bordaLilas}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <p style={{ fontSize: 13, fontWeight: 700, color: colors.rosa }}>
          R$ {Number(order.total).toFixed(2)}
        </p>
        <div style={{ display: "flex", gap: 6 }}>
          {/* Cancelar — só antes de preparar e sem pagamento confirmado */}
          {["pending", "confirmed"].includes(order.status) &&
            order.payment_status !== "paid" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  Swal.fire({
                    title: "Cancelar pedido?",
                    text: "Esta ação não pode ser desfeita.",
                    icon: "warning",
                    showCancelButton: true,
                    confirmButtonText: "Sim, cancelar",
                    cancelButtonText: "Voltar",
                    confirmButtonColor: "#e9181c",
                  }).then(({ isConfirmed }) => {
                    if (isConfirmed) onUpdateStatus(order.id, "cancelled");
                  });
                }}
                style={{
                  padding: "6px 12px",
                  borderRadius: 8,
                  background: "#fef2f2",
                  color: "#991b1b",
                  border: "1px solid #fca5a5",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Cancelar
              </button>
            )}

          {/* Avançar status */}
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
              {next.label} →
            </button>
          )}

          {order.status === "delivered" && (
            <span
              style={{
                fontSize: 10,
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 6,
                padding: "3px 8px",
                color: "#15803d",
                fontWeight: 600,
              }}
            >
              ✓ Concluído
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
