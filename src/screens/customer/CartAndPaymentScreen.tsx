import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useCustomerAddresses } from "../../hooks/useCustomer";
import { colors, Button, Spinner, Toast } from "../../components/ui";
import { notify } from "../../services/whatsapp";

// ── Gerador de payload Pix BR Code (padrão BACEN EMV) ────────
function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
    crc &= 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function emv(id: string, value: string): string {
  return `${id}${value.length.toString().padStart(2, "0")}${value}`;
}
function sanitize(str: string, maxLen: number): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
    .slice(0, maxLen);
}
function buildPixPayload(opts: {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
}): string {
  const name = sanitize(opts.merchantName, 25);
  const city = sanitize(opts.merchantCity, 15);
  const txId =
    (opts.txId ?? "CHEGOPEDIDO").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25) ||
    "CHEGOPEDIDO";
  const mai = emv(
    "26",
    emv("00", "BR.GOV.BCB.PIX") + emv("01", opts.pixKey.trim()),
  );
  const payload =
    emv("00", "01") +
    emv("01", "12") +
    mai +
    emv("52", "0000") +
    emv("53", "986") +
    emv("54", opts.amount.toFixed(2)) +
    emv("58", "BR") +
    emv("59", name) +
    emv("60", city) +
    emv("62", emv("05", txId)) +
    "6304";
  return payload + crc16(payload);
}

// ── CARRINHO ──────────────────────────────────────────────
export function CartScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, total, updateQty, removeItem, storeId, storeName, clearCart } =
    useCart();
  const { addresses, loading: addrLoading } = useCustomerAddresses(
    user?.id ?? null,
  );

  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [paymentMethod, setPaymentMethod] = useState<string>("pix_qr");
  const [storePixKey, setStorePixKey] = useState<string | null>(null);
  const [deliveryType, setDeliveryType] = useState<"delivery" | "pickup">(
    "delivery",
  );

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    const def = addresses.find((a) => a.is_default);
    if (def && !selectedAddr) setSelectedAddr(def.id);
  }, [addresses]);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("pix_key")
      .eq("id", storeId)
      .maybeSingle()
      .then(({ data }) => setStorePixKey(data?.pix_key ?? null));
  }, [storeId]);

  const address = addresses.find((a) => a.id === selectedAddr);

  async function handleCheckout() {
    if (!user || !storeId) return;
    if (deliveryType === "delivery" && (!selectedAddr || !address)) {
      showToast("Escolha um endereço de entrega", "error");
      return;
    }
    if (items.length === 0) {
      showToast("Carrinho vazio", "error");
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    try {
      const { data: store } = await supabase
        .from("stores")
        .select("delivery_fee, min_order_value")
        .eq("id", storeId)
        .single();
      const delivFee = Number(store?.delivery_fee ?? 0);
      const minOrder = Number(store?.min_order_value ?? 0);
      const subtotal = total;
      const orderTotal = subtotal + delivFee;

      if (subtotal < minOrder && minOrder > 0) {
        showToast(`Pedido mínimo é R$ ${minOrder.toFixed(2)}`, "error");
        setSubmitting(false);
        return;
      }

      const { data: existingOrder } = await supabase
        .from("orders")
        .select("id, total, status, payment_status")
        .eq("customer_id", user.id)
        .eq("store_id", storeId)
        .in("status", ["pending"])
        .eq("payment_status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingOrder) {
        // Pedido pending aguardando pagamento — reutiliza
        navigate("/payment", {
          state: {
            orderId: existingOrder.id,
            total: Number(existingOrder.total),
            paymentMethod,
            pixKey: storePixKey,
          },
        });
        setSubmitting(false);
        return;
      }

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          customer_id: user.id,
          address_id: selectedAddr,
          status: "pending",
          payment_status: "pending",
          subtotal,
          delivery_fee: delivFee,
          total: orderTotal,
          delivery_address:
            deliveryType === "pickup"
              ? "Retirada no local"
              : `${address?.address}${address?.complement ? ", " + address?.complement : ""} · ${address?.city}`,
          delivery_lat:
            deliveryType === "pickup" ? null : (address?.lat ?? null),
          delivery_lng:
            deliveryType === "pickup" ? null : (address?.lng ?? null),
          notes: notes.trim() || null,
          payment_method: paymentMethod,
          delivery_type: deliveryType,
        })
        .select()
        .single();

      if (orderErr) throw new Error(orderErr.message);

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: item.notes ?? null,
        })),
      );
      if (itemsErr) throw new Error(itemsErr.message);

      // Notifica comércio via WhatsApp
      notify.orderCreated(order.id);

      if (paymentMethod === "pix_qr" || paymentMethod === "credito_mp") {
        navigate("/payment", {
          state: { orderId: order.id, total: orderTotal, paymentMethod },
        });
      } else if (paymentMethod === "pix_manual") {
        navigate("/payment", {
          state: {
            orderId: order.id,
            total: orderTotal,
            paymentMethod,
            pixKey: storePixKey,
          },
        });
      } else {
        clearCart(false);
        showToast("Pedido confirmado! Pague na entrega. ✅");
        setTimeout(() => navigate(`/orders/${order.id}`), 1500);
      }
    } catch (err: any) {
      showToast(err.message, "error");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "'Space Grotesk', sans-serif",
          padding: 24,
        }}
      >
        <p style={{ fontSize: 48 }}>🛒</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>
          Carrinho vazio
        </p>
        <p style={{ fontSize: 13, color: "#aaa", textAlign: "center" }}>
          Adicione produtos de um comércio para continuar
        </p>
        <button
          onClick={() => navigate("/home")}
          style={{
            padding: "13px 32px",
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
          🏪 Explorar comércios
        </button>
        <button
          onClick={() => navigate("/orders")}
          style={{
            background: "none",
            border: "none",
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Ver meus pedidos →
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
        paddingBottom: 100,
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
          ← Continuar comprando
        </button>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
          Meu Carrinho
        </p>
        <p
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}
        >
          {storeName} · {items.reduce((s, i) => s + i.quantity, 0)} itens
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
        {/* Itens */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item) => (
            <div
              key={item.product_id}
              style={{
                background: "#fff",
                borderRadius: 13,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "10px 12px",
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  background: colors.lilasClaro,
                  flexShrink: 0,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 22,
                }}
              >
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  "📦"
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.noite,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.name}
                </p>
                {item.notes && (
                  <p style={{ fontSize: 10, color: "#aaa", marginTop: 1 }}>
                    obs: {item.notes}
                  </p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 5,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={() =>
                      updateQty(item.product_id, item.quantity - 1)
                    }
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: colors.lilasClaro,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                      minWidth: 16,
                      textAlign: "center",
                    }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    onClick={() =>
                      updateQty(item.product_id, item.quantity + 1)
                    }
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: colors.rosa,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    +
                  </button>
                </div>
                <p
                  style={{ fontSize: 12, fontWeight: 700, color: colors.rosa }}
                >
                  R${(item.price * item.quantity).toFixed(2)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Observações */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.noite,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Observações
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Alguma observação para o comércio?"
            rows={2}
            style={{
              background: "#fff",
              border: `1.5px solid ${colors.bordaLilas}`,
              borderRadius: 11,
              padding: "9px 12px",
              fontSize: 13,
              color: colors.noite,
              fontFamily: "'Space Grotesk', sans-serif",
              resize: "none",
              outline: "none",
            }}
          />
        </div>

        {/* Tipo de entrega */}
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Como você quer receber?
          </p>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}
          >
            {[
              {
                id: "delivery",
                icon: "🛵",
                label: "Entrega",
                sub: "Recebo em casa",
              },
              {
                id: "pickup",
                icon: "🏪",
                label: "Retirada",
                sub: "Busco no local",
              },
            ].map((t) => (
              <div
                key={t.id}
                onClick={() => setDeliveryType(t.id as "delivery" | "pickup")}
                style={{
                  padding: "14px 10px",
                  borderRadius: 12,
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border: `2px solid ${deliveryType === t.id ? colors.rosa : colors.bordaLilas}`,
                  background: deliveryType === t.id ? "#fff0f8" : "#fafafa",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</div>
                <p
                  style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
                >
                  {t.label}
                </p>
                <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                  {t.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Endereço */}
        <div
          style={{ display: deliveryType === "delivery" ? "block" : "none" }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.noite,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Endereço de entrega
          </p>
          {addrLoading ? (
            <Spinner color={colors.rosa} size={20} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => setSelectedAddr(addr.id)}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: `1.5px solid ${selectedAddr === addr.id ? colors.rosa : colors.bordaLilas}`,
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
                      borderRadius: "50%",
                      background:
                        selectedAddr === addr.id
                          ? colors.rosa
                          : colors.lilasClaro,
                      border: `1.5px solid ${selectedAddr === addr.id ? colors.rosa : colors.bordaLilas}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {selectedAddr === addr.id && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#fff",
                        }}
                      />
                    )}
                  </div>
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      {addr.label}
                    </p>
                    <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                      {addr.address} · {addr.city}
                    </p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate("/profile")}
                style={{
                  background: "none",
                  border: `1px dashed ${colors.bordaLilas}`,
                  borderRadius: 12,
                  padding: "10px",
                  color: colors.rosa,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                + Novo endereço (via Perfil)
              </button>
            </div>
          )}
        </div>

        {/* Retirada info */}
        {deliveryType === "pickup" && (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#15803d",
                marginBottom: 4,
              }}
            >
              🏪 Retirada no local
            </p>
            <p style={{ fontSize: 11, color: "#166534", lineHeight: 1.6 }}>
              Dirija-se ao estabelecimento para retirar seu pedido. O comércio
              irá notificá-lo quando estiver pronto.
            </p>
          </div>
        )}

        {/* Método de pagamento */}
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 10,
            }}
          >
            Forma de pagamento
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              {
                id: "pix_qr",
                icon: "⚡",
                label: "Pix QR Code",
                sub: "Pagamento online via QR Code",
              },
              {
                id: "pix_manual",
                icon: "📋",
                label: "Pix Manual",
                sub: storePixKey
                  ? `Chave: ${storePixKey}`
                  : "Chave Pix do estabelecimento",
              },
              {
                id: "dinheiro",
                icon: "💵",
                label: "Dinheiro",
                sub: "Pague na entrega — comércio confirma",
              },

              {
                id: "credito_ent",
                icon: "💳",
                label: "Crédito na entrega",
                sub: "Maquininha na entrega",
              },
              {
                id: "debito_ent",
                icon: "💳",
                label: "Débito na entrega",
                sub: "Maquininha na entrega",
              },
            ].map((m) => (
              <div
                key={m.id}
                onClick={() => setPaymentMethod(m.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderRadius: 10,
                  border: `1.5px solid ${paymentMethod === m.id ? colors.rosa : colors.bordaLilas}`,
                  background: paymentMethod === m.id ? "#fff0f8" : "#fafafa",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 20, flexShrink: 0 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.noite,
                    }}
                  >
                    {m.label}
                  </p>
                  <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                    {m.sub}
                  </p>
                </div>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: `2px solid ${paymentMethod === m.id ? colors.rosa : "#ccc"}`,
                    background:
                      paymentMethod === m.id ? colors.rosa : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {paymentMethod === m.id && (
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: "#fff",
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Resumo */}
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 5,
            }}
          >
            <span style={{ fontSize: 12, color: "#888" }}>Subtotal</span>
            <span style={{ fontSize: 12, color: colors.noite }}>
              R$ {total.toFixed(2)}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 12, color: "#888" }}>Entrega</span>
            <span style={{ fontSize: 12, color: "#22c55e" }}>R$ 0,00</span>
          </div>
          <div
            style={{
              height: 1,
              background: colors.bordaLilas,
              marginBottom: 8,
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span
              style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
            >
              Total
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}>
              R$ {total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)",
          width: "calc(100% - 32px)",
          maxWidth: 448,
        }}
      >
        <Button
          variant="primary"
          fullWidth
          loading={submitting}
          onClick={handleCheckout}
          style={{ fontSize: 15 }}
        >
          {paymentMethod === "pix_qr"
            ? "⚡ Gerar QR Code Pix →"
            : paymentMethod === "pix_manual"
              ? "📋 Ver chave Pix →"
              : paymentMethod === "credito_mp"
                ? "💳 Pagar com Mercado Pago →"
                : "✅ Confirmar pedido →"}
        </Button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}

// ── PAGAMENTO ──────────────────────────────────────────────
export function PaymentScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { clearCart } = useCart();

  const locationState = location.state as {
    orderId: string;
    total: number;
    paymentMethod?: string;
    pixKey?: string;
  } | null;

  const [status, setStatus] = useState<"waiting" | "paid" | "error">("waiting");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [pixPayload, setPixPayload] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const orderId = locationState?.orderId ?? null;
  const orderTotal = locationState?.total ?? 0;
  const paymentMethod = locationState?.paymentMethod ?? "pix_qr";
  const pixKey = locationState?.pixKey ?? null;

  useEffect(() => {
    if (!orderId || orderTotal <= 0) return;
    if (paymentMethod !== "pix_qr" && paymentMethod !== "credito_mp") return;
    setGenerating(true);
    supabase.functions
      .invoke("create-mp-payment", { body: { order_id: orderId } })
      .then(({ data, error }) => {
        if (error || data?.error) return;
        if (data?.qr_code_base64)
          setQrDataUrl(`data:image/png;base64,${data.qr_code_base64}`);
        else if (data?.qr_code)
          setQrDataUrl(
            `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qr_code)}&margin=10`,
          );
        if (data?.qr_code) setPixPayload(data.qr_code);
      })
      .finally(() => setGenerating(false));
  }, [orderId, orderTotal]);

  useEffect(() => {
    if (!orderId || status !== "waiting") return;
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("orders")
        .select("payment_status")
        .eq("id", orderId)
        .single();
      if (data?.payment_status === "paid") {
        setStatus("paid");
        clearCart();
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [orderId, status]);

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`payment-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        (payload) => {
          if ((payload.new as any).payment_status === "paid") {
            setStatus("paid");
            clearCart();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  // Pix manual
  if (paymentMethod === "pix_manual" && status !== "paid") {
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
          padding: 24,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: colors.rosa,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
          }}
        >
          📋
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 22,
              color: colors.noite,
              marginBottom: 6,
            }}
          >
            Pague via Pix
          </p>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>
            Copie a chave Pix abaixo, abra seu banco e faça a transferência.
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1.5px solid ${colors.bordaLilas}`,
            padding: "16px",
            width: "100%",
            maxWidth: 360,
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
            Chave Pix
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <p
              style={{
                flex: 1,
                fontSize: 15,
                fontWeight: 700,
                color: colors.noite,
                wordBreak: "break-all",
              }}
            >
              {pixKey ?? "Chave não configurada"}
            </p>
            {pixKey && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pixKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: copied ? "#22c55e" : colors.rosa,
                  color: "#fff",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  flexShrink: 0,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {copied ? "✓ Copiado!" : "Copiar"}
              </button>
            )}
          </div>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 16px",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#888" }}>Total a pagar</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}>
              R$ {orderTotal.toFixed(2)}
            </span>
          </div>
          <p style={{ fontSize: 10, color: "#aaa", marginTop: 6 }}>
            #{orderId?.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "10px 14px",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
            ⏳ Após pagar, aguarde a confirmação do comércio.
          </p>
        </div>
        <button
          onClick={() => navigate(`/orders/${orderId}`)}
          style={{
            width: "100%",
            maxWidth: 360,
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
          Acompanhar pedido →
        </button>
        <button
          onClick={() => navigate("/home")}
          style={{
            background: "none",
            border: "none",
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  // Pago
  if (status === "paid") {
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
          padding: 24,
          gap: 16,
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
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 24,
              color: colors.noite,
              marginBottom: 6,
            }}
          >
            Pedido feito!
          </p>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>
            Pagamento confirmado. O comércio foi notificado.
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 18px",
            width: "100%",
            maxWidth: 320,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#888" }}>
              #{orderId?.slice(0, 8).toUpperCase()}
            </span>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.rosa }}>
              R$ {orderTotal.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={() => navigate("/orders")}
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
          📍 Acompanhar entrega
        </button>
        <button
          onClick={() => navigate("/home")}
          style={{
            background: "none",
            border: "none",
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  // Sem state
  if (!orderId) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontFamily: "'Space Grotesk', sans-serif",
          padding: 24,
        }}
      >
        <p style={{ fontSize: 14, color: "#aaa", textAlign: "center" }}>
          Nenhum pedido em andamento.
        </p>
        <button
          onClick={() => navigate("/home")}
          style={{
            padding: "11px 24px",
            borderRadius: 12,
            background: colors.rosa,
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Ir para o início
        </button>
      </div>
    );
  }

  // Pagamento na entrega (dinheiro, crédito/débito)
  const isEntrega =
    paymentMethod === "dinheiro" ||
    paymentMethod === "credito_ent" ||
    paymentMethod === "debito_ent";
  if (isEntrega && status !== "paid") {
    const icons: Record<string, string> = {
      dinheiro: "💵",
      credito_ent: "💳",
      debito_ent: "💳",
    };
    const labels: Record<string, string> = {
      dinheiro: "Dinheiro",
      credito_ent: "Cartão de crédito",
      debito_ent: "Cartão de débito",
    };
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
          padding: 24,
          gap: 16,
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
          }}
        >
          {icons[paymentMethod]}
        </div>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 24,
              color: colors.noite,
              marginBottom: 6,
            }}
          >
            Pedido confirmado!
          </p>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.7 }}>
            Pagamento via <strong>{labels[paymentMethod]}</strong> na entrega.
            <br />O comércio irá preparar seu pedido.
          </p>
        </div>
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 18px",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 13, color: "#888" }}>
              Total a pagar na entrega
            </span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}>
              R$ {orderTotal.toFixed(2)}
            </span>
          </div>
          <p style={{ fontSize: 10, color: "#aaa" }}>
            #{orderId?.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div
          style={{
            background: "#f0fdf4",
            border: "1px solid #86efac",
            borderRadius: 12,
            padding: "10px 14px",
            width: "100%",
            maxWidth: 360,
          }}
        >
          <p style={{ fontSize: 11, color: "#15803d", lineHeight: 1.6 }}>
            ✅ Tenha o valor exato em mãos ou seu cartão disponível para a
            entrega.
          </p>
        </div>
        <button
          onClick={() => navigate(`/orders/${orderId}`)}
          style={{
            width: "100%",
            maxWidth: 360,
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
          📍 Acompanhar pedido →
        </button>
        <button
          onClick={() => navigate("/home")}
          style={{
            background: "none",
            border: "none",
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar para o início
        </button>
      </div>
    );
  }

  // QR Code
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
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
          ← Voltar
        </button>
        <p style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>
          Pagamento
        </p>
        <p
          style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}
        >
          Escaneie o QR Code para pagar via Pix
        </p>
      </div>
      <div
        style={{
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "24px 20px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Total a pagar
          </p>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 32,
              color: colors.rosa,
            }}
          >
            R$ {orderTotal.toFixed(2)}
          </p>
          <div
            style={{
              width: 200,
              height: 200,
              background: "#fff",
              border: `3px solid ${colors.noite}`,
              borderRadius: 12,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {generating ? (
              <Spinner color={colors.noite} size={32} />
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                alt="QR Code Pix"
              />
            ) : (
              <Spinner color={colors.noite} size={24} />
            )}
          </div>
          <p
            style={{
              fontSize: 11,
              color: "#aaa",
              textAlign: "center",
              lineHeight: 1.6,
            }}
          >
            Abra o app do banco e escaneie
          </p>
          {pixPayload && (
            <button
              onClick={() =>
                navigator.clipboard
                  .writeText(pixPayload)
                  .then(() => alert("Código Pix copiado!"))
              }
              style={{
                width: "100%",
                padding: "10px",
                borderRadius: 10,
                background: colors.lilasClaro,
                border: "none",
                color: "#7e22ce",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              📋 Copiar código Pix
            </button>
          )}
        </div>
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "12px 16px",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#f59e0b",
              flexShrink: 0,
              animation: "chegô-blink 1s ease-in-out infinite",
            }}
          />
          <p style={{ fontSize: 12, color: "#92400e", fontWeight: 600 }}>
            Aguardando confirmação do pagamento...
          </p>
        </div>
        <style>{`@keyframes chegô-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>
        <p style={{ fontSize: 11, color: "#aaa", textAlign: "center" }}>
          O pedido será confirmado automaticamente após o pagamento
        </p>
        <button
          onClick={() => navigate("/home")}
          style={{
            background: "none",
            border: "none",
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar para o início
        </button>
      </div>
    </div>
  );
}
