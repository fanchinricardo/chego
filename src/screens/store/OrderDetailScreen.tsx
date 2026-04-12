import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { Order, OrderStatus } from "../../hooks/useOrders";
import { colors, Spinner, Toast } from "../../components/ui";
import { notify } from "../../services/whatsapp";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Novo pedido",
  confirmed: "Confirmado",
  preparing: "Preparando",
  ready: "Pronto para entrega",
  in_delivery: "Em entrega",
  delivered: "Entregue",
  cancelled: "Cancelado",
};

const STATUS_NEXT: Partial<
  Record<OrderStatus, { label: string; next: OrderStatus }>
> = {
  pending: { label: "Confirmar e preparar", next: "confirmed" },
  confirmed: { label: "Iniciar preparo", next: "preparing" },
  preparing: { label: "Marcar como pronto", next: "ready" },
  ready: { label: "Iniciar entrega", next: "in_delivery" },
};

export default function OrderDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    if (!id) return;
    supabase
      .from("orders")
      .select(
        `*, profiles(full_name, phone), order_items(*, products(name, image_url))`,
      )
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
        if (!error) setOrder(data as Order);
        setLoading(false);
      });
  }, [id]);

  async function handleUpdateStatus(next: OrderStatus) {
    if (!order) return;
    setSaving(true);
    try {
      await supabase.from("orders").update({ status: next }).eq("id", order.id);
      setOrder((prev) => (prev ? { ...prev, status: next } : prev));
      showToast(`Pedido ${STATUS_LABEL[next].toLowerCase()}!`);
      // Notificações WhatsApp
      if (next === "preparing") notify.orderPreparing(order.id);
      if (next === "delivered") setTimeout(() => navigate(-1), 1500);
    } catch {
      showToast("Erro ao atualizar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!order || !confirm("Cancelar este pedido?")) return;
    await handleUpdateStatus("cancelled");
    setTimeout(() => navigate(-1), 1500);
  }

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
        <p style={{ color: "#888" }}>Pedido não encontrado</p>
      </div>
    );

  const nextAction = STATUS_NEXT[order.status];
  const isPaid = order.payment_status === "paid";
  const time = new Date(order.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div>
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 2,
              }}
            >
              Pedido #{order.id.slice(0, 6).toUpperCase()}
            </p>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              {order.profiles?.full_name} · {time}
            </p>
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "4px 12px",
              borderRadius: 20,
              background: "rgba(233,30,140,0.15)",
              color: colors.rosa,
              border: `1px solid rgba(233,30,140,0.3)`,
            }}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>
      </div>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Itens */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Itens do pedido
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {order.order_items?.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.rosa,
                    }}
                  >
                    {item.quantity}×
                  </span>
                  <div>
                    <p style={{ fontSize: 13, color: colors.noite }}>
                      {item.products?.name}
                    </p>
                    {item.notes && (
                      <p style={{ fontSize: 11, color: "#aaa" }}>
                        obs: {item.notes}
                      </p>
                    )}
                  </div>
                </div>
                <p
                  style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
                >
                  R$ {Number(item.total_price).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
          <div
            style={{
              height: 1,
              background: colors.bordaLilas,
              margin: "12px 0",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 12, color: "#888" }}>Taxa de entrega</span>
            <span style={{ fontSize: 12, color: "#888" }}>
              R$ {Number(order.delivery_fee).toFixed(2)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <span
              style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
            >
              Total
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}>
              R$ {Number(order.total).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Endereço */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            {(order as any).delivery_type === "pickup"
              ? "🏪 Retirada no local"
              : "Endereço de entrega"}
          </p>
          {(order as any).delivery_type === "pickup" ? (
            <p style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>
              Cliente vai retirar no estabelecimento
            </p>
          ) : (
            <p style={{ fontSize: 13, color: colors.noite, lineHeight: 1.6 }}>
              {order.delivery_address ?? "Endereço não informado"}
            </p>
          )}
          {order.delivery_lat &&
            order.delivery_lng &&
            (order as any).delivery_type !== "pickup" && (
              <a
                href={`https://maps.google.com/?q=${order.delivery_lat},${order.delivery_lng}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  color: colors.rosa,
                  fontWeight: 600,
                  display: "inline-block",
                  marginTop: 6,
                }}
              >
                Ver no mapa →
              </a>
            )}
        </div>

        {/* Cliente */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Cliente
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.noite }}>
              {order.profiles?.full_name}
            </p>
            {order.profiles?.phone && (
              <a
                href={`https://wa.me/55${order.profiles.phone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#fff",
                  background: "#25d366",
                  padding: "5px 12px",
                  borderRadius: 8,
                  textDecoration: "none",
                }}
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>

        {/* Pagamento */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Pagamento
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: isPaid ? "#22c55e" : "#f59e0b",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                color: "#fff",
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {isPaid ? "✓" : "!"}
            </div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isPaid ? "#15803d" : "#b45309",
              }}
            >
              {isPaid ? "Pago via QR Code / Pix" : "Aguardando pagamento"}
            </p>
          </div>
        </div>

        {/* Observações */}
        {order.notes && (
          <div
            style={{
              background: "#fff8e6",
              borderRadius: 14,
              border: "1px solid #fcd34d",
              padding: "14px 16px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#b45309",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Observações do cliente
            </p>
            <p style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
              {order.notes}
            </p>
          </div>
        )}

        {/* Ações */}
        {order.status !== "cancelled" && (
          <>
            {/* Status ready — diferencia entrega de retirada */}
            {order.status === "ready" ? (
              (order as any).delivery_type === "pickup" ? (
                <button
                  onClick={() => handleUpdateStatus("delivered")}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 13,
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    opacity: saving ? 0.7 : 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {saving ? "Atualizando..." : "🏪 Confirmar retirada"}
                </button>
              ) : (
                <button
                  onClick={() => handleUpdateStatus("in_delivery")}
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
                  }}
                >
                  {saving ? "Atualizando..." : "🛵 Iniciar entrega"}
                </button>
              )
            ) : nextAction ? (
              <button
                onClick={() => handleUpdateStatus(nextAction.next)}
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
                }}
              >
                {saving ? "Atualizando..." : nextAction.label}
              </button>
            ) : null}
          </>
        )}

        {["pending", "confirmed"].includes(order.status) &&
          order.payment_status !== "paid" && (
            <button
              onClick={handleCancel}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 13,
                background: "#fff",
                color: colors.rosa,
                border: `1.5px solid ${colors.bordaLilas}`,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Cancelar pedido
            </button>
          )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
