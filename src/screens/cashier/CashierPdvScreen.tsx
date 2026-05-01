import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { useAuth } from "../../contexts/AuthContext";
import { useStoreProducts } from "../../hooks/useCustomer";
import { colors, Spinner } from "../../components/ui";
import { ProductModal, CartItem } from "../../components/ProductModal";
import { printReceipt, ReceiptData } from "../../components/ThermalReceipt";
import Swal from "sweetalert2";

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "💵 Dinheiro",
  credito: "💳 Cartão Crédito",
  debito: "💳 Cartão Débito",
  pix: "⚡ Pix",
};

export default function CashierPDVScreen() {
  const navigate = useNavigate();

  const { store } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    supabase
      .from("store_invoices")
      .select("id")
      .eq("store_id", store.id)
      .eq("status", "overdue")
      .then(({ data }) => {
        if ((data?.length ?? 0) > 0)
          navigate("/store/billing", { replace: true });
      });
  }, [store?.id]);
  const { profile } = useAuth();
  const storeId = store?.id ?? null;
  const { products, categories } = useStoreProducts(storeId);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [deliveryType, setDeliveryType] = useState<"pickup" | "delivery">(
    "pickup",
  );
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city2, setCity2] = useState(store?.city ?? "");
  const [state2, setState2] = useState(store?.state ?? "");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"products" | "cart">("products");

  useEffect(() => {
    if (store?.city) setCity2(store.city);
    if (store?.state) setState2(store.state);
  }, [store?.city, store?.state]);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const existing = prev.findIndex(
        (c) => c.name === item.name && c.notes === item.notes,
      );
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          quantity: updated[existing].quantity + item.quantity,
        };
        return updated;
      }
      return [...prev, item];
    });
    setSelectedProduct(null);
    setTab("cart");
  }

  function removeFromCart(idx: number) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateQty(idx: number, qty: number) {
    if (qty <= 0) {
      removeFromCart(idx);
      return;
    }
    setCart((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, quantity: qty } : item)),
    );
  }

  async function handleFinish() {
    if (cart.length === 0) {
      Swal.fire({
        title: "Carrinho vazio",
        icon: "warning",
        confirmButtonColor: colors.rosa,
      });
      return;
    }
    if (!customerName.trim()) {
      Swal.fire({
        title: "Informe o nome do cliente",
        icon: "warning",
        confirmButtonColor: colors.rosa,
      });
      return;
    }
    if (deliveryType === "delivery") {
      if (!customerPhone.trim()) {
        Swal.fire({
          title: "Informe o celular do cliente",
          text: "Necessário para notificar quando o pedido sair para entrega.",
          icon: "warning",
          confirmButtonColor: colors.rosa,
        });
        return;
      }
      if (!street.trim() || !number.trim() || !city2.trim() || !state2.trim()) {
        Swal.fire({
          title: "Preencha o endereço completo",
          icon: "warning",
          confirmButtonColor: colors.rosa,
        });
        return;
      }
    }
    const fullAddress =
      deliveryType === "delivery"
        ? `${street.trim()}, ${number.trim()}${neighborhood.trim() ? ", " + neighborhood.trim() : ""}, ${city2.trim()} - ${state2.trim()}`
        : null;

    // Seleciona pagamento
    const { value: method, isConfirmed } = await Swal.fire({
      title: "Forma de pagamento",
      input: "select",
      inputOptions: METHOD_LABEL,
      inputPlaceholder: "Selecione",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#22c55e",
    });
    if (!isConfirmed) return;

    // Troco se dinheiro
    let amountPaid = total;
    let changeAmount = 0;
    if (method === "dinheiro") {
      const totalStr = total.toFixed(2);
      const { value: received, isConfirmed: confirmedPay } = await Swal.fire({
        title: "Valor recebido em dinheiro",
        html: `
          <p style="margin-bottom:10px;color:#666">Total: <strong>R$ ${totalStr}</strong></p>
          <p style="font-size:12px;color:#aaa;margin-bottom:6px">Digite o valor entregue pelo cliente</p>
          <input id="swal-valor" type="number" step="0.01" min="${totalStr}" value="${totalStr}"
            class="swal2-input" style="font-size:18px;font-weight:700"/>
          <p id="swal-troco" style="margin-top:10px;font-size:14px;color:#15803d;font-weight:600"></p>
        `,
        confirmButtonText: "Confirmar",
        confirmButtonColor: "#22c55e",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        didOpen: () => {
          const input = document.getElementById(
            "swal-valor",
          ) as HTMLInputElement;
          const trocoEl = document.getElementById("swal-troco")!;
          input.addEventListener("input", () => {
            const v = Number(input.value);
            trocoEl.textContent =
              v > total ? "Troco: R$ " + (v - total).toFixed(2) : "";
          });
        },
        preConfirm: () => {
          const val = (
            document.getElementById("swal-valor") as HTMLInputElement
          )?.value;
          if (!val || Number(val) < total) {
            Swal.showValidationMessage("Valor mínimo: R$ " + totalStr);
            return false;
          }
          return val;
        },
      });
      if (!confirmedPay) return;
      if (received) {
        amountPaid = Number(received);
        const diffCents =
          Math.round(amountPaid * 100) - Math.round(total * 100);
        changeAmount = diffCents > 0 ? diffCents / 100 : 0;
      }
    }

    setSaving(true);
    try {
      // Cria pedido na tabela orders (igual delivery mas sem motoboy)
      const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);

      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          store_id: storeId,
          customer_id: profile?.id,
          status: "confirmed", // já confirmado — vai direto para cozinha
          payment_status: "paid",
          payment_method: method,
          subtotal,
          delivery_fee: 0,
          total: subtotal,
          delivery_type: deliveryType,
          delivery_address: fullAddress,
          notes: `Balcão — ${customerName.trim()}${customerPhone.trim() ? " | Tel: " + customerPhone.trim() : ""}`,
          customer_phone: customerPhone.trim() || null,
        })
        .select()
        .single();

      if (orderErr) throw new Error(orderErr.message);

      // Insere itens
      await supabase.from("order_items").insert(
        cart.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          notes: item.notes ?? null,
          custom_name: item.name,
        })),
      );

      // Pergunta se imprime
      const { isConfirmed: shouldPrint } = await Swal.fire({
        title: "✅ Pedido enviado para a cozinha!",
        text: "Deseja imprimir o cupom?",
        icon: "success",
        showCancelButton: true,
        confirmButtonText: "🖨️ Imprimir",
        cancelButtonText: "Não",
        confirmButtonColor: "#22c55e",
      });

      if (shouldPrint) {
        const receiptData: ReceiptData = {
          store: {
            name: store?.name ?? "",
            address: store?.address ?? null,
            city: store?.city ?? null,
            state: store?.state ?? null,
            phone: store?.phone ?? null,
          },
          items: cart.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unit_price: i.price,
            total: i.price * i.quantity,
            notes: i.notes ?? null,
          })),
          subtotal,
          total: subtotal,
          payments: [
            {
              method,
              amount: amountPaid,
              change: changeAmount > 0 ? changeAmount : undefined,
            },
          ],
          customer: customerName.trim(),
          order_code: order.id.slice(0, 6).toUpperCase(),
          type: "delivery",
          printed_at: new Date().toISOString(),
        };
        printReceipt(receiptData);
      }

      // Limpa
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setStreet("");
      setNumber("");
      setNeighborhood("");
      setTab("products");
    } catch (e: any) {
      Swal.fire({
        title: "Erro",
        text: e.message,
        icon: "error",
        confirmButtonColor: colors.rosa,
      });
    } finally {
      setSaving(false);
    }
  }

  const filtered = products.filter((p) => {
    const matchCat = !activeCategory || p.category === activeCategory;
    const matchSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch && p.active;
  });

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "12px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <div>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 20,
                color: "#fff",
                lineHeight: 1,
              }}
            >
              🏪 Balcão
            </p>
            <p
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.35)",
                marginTop: 2,
              }}
            >
              Pedido direto no caixa
            </p>
          </div>
          <button
            onClick={() => navigate("/cashier")}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 10,
              padding: "8px 14px",
              color: "rgba(255,255,255,0.6)",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Voltar
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8 }}>
          {[
            { key: "products", label: "🍕 Produtos" },
            {
              key: "cart",
              label: `🛒 Carrinho${cart.length > 0 ? ` (${cart.reduce((s, i) => s + i.quantity, 0)})` : ""}`,
            },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              style={{
                padding: "7px 16px",
                borderRadius: 20,
                border: "none",
                background: tab === t.key ? "#fff" : "rgba(255,255,255,0.1)",
                color: tab === t.key ? colors.noite : "rgba(255,255,255,0.5)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Aba Produtos */}
      {tab === "products" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          {/* Busca */}
          <div style={{ padding: "12px 16px 0" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Buscar produto..."
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${colors.bordaLilas}`,
                fontSize: 13,
                fontFamily: "'Space Grotesk', sans-serif",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Categorias */}
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "10px 16px",
              overflowX: "auto",
            }}
          >
            <button
              onClick={() => setActiveCategory(null)}
              style={{
                padding: "5px 14px",
                borderRadius: 20,
                border: "none",
                background: !activeCategory ? colors.rosa : colors.lilasClaro,
                color: !activeCategory ? "#fff" : colors.noite,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "5px 14px",
                  borderRadius: 20,
                  border: "none",
                  background:
                    activeCategory === cat ? colors.rosa : colors.lilasClaro,
                  color: activeCategory === cat ? "#fff" : colors.noite,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Grid de produtos */}
          <div
            style={{
              padding: "0 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {filtered.map((product) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  cursor: "pointer",
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      objectFit: "cover",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      background: colors.lilasClaro,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                    }}
                  >
                    {product.emoji ?? "🍽️"}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {product.name}
                  </p>
                  {product.description && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#aaa",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.description}
                    </p>
                  )}
                  {product.size_type !== "sizes" && (
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.rosa,
                        marginTop: 2,
                      }}
                    >
                      R$ {Number(product.price).toFixed(2)}
                    </p>
                  )}
                </div>
                <div
                  style={{
                    background: colors.rosa,
                    borderRadius: 8,
                    width: 28,
                    height: 28,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <p style={{ color: "#fff", fontSize: 18, lineHeight: 1 }}>
                    +
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aba Carrinho */}
      {tab === "cart" && (
        <div style={{ flex: 1, overflow: "auto", padding: "16px" }}>
          {/* Dados do cliente */}
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "12px",
              marginBottom: 12,
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
              Dados do pedido
            </p>

            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nome do cliente *"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid ${colors.bordaLilas}`,
                fontSize: 13,
                fontFamily: "'Space Grotesk', sans-serif",
                outline: "none",
                marginBottom: 8,
                boxSizing: "border-box",
              }}
            />

            <div
              style={{
                display: "flex",
                gap: 8,
                marginBottom: deliveryType === "delivery" ? 8 : 0,
              }}
            >
              {(["pickup", "delivery"] as const).map((dt) => (
                <button
                  key={dt}
                  onClick={() => setDeliveryType(dt)}
                  style={{
                    flex: 1,
                    padding: "9px",
                    borderRadius: 10,
                    border: `1.5px solid ${deliveryType === dt ? colors.rosa : colors.bordaLilas}`,
                    background: deliveryType === dt ? "#fff0f8" : "#fff",
                    color: deliveryType === dt ? colors.rosa : "#888",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {dt === "pickup" ? "🏪 Retirada no balcão" : "🛵 Entrega"}
                </button>
              ))}
            </div>

            {deliveryType === "delivery" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginTop: 4,
                }}
              >
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Celular do cliente * (com DDD)"
                  type="tel"
                  inputMode="numeric"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${colors.bordaLilas}`,
                    fontSize: 13,
                    fontFamily: "'Space Grotesk', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Rua / Avenida *"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${colors.bordaLilas}`,
                    fontSize: 13,
                    fontFamily: "'Space Grotesk', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="Número *"
                    style={{
                      width: 90,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.bordaLilas}`,
                      fontSize: 13,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    style={{
                      flex: 1,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.bordaLilas}`,
                      fontSize: 13,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={city2}
                    onChange={(e) => setCity2(e.target.value)}
                    placeholder="Cidade *"
                    style={{
                      flex: 2,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.bordaLilas}`,
                      fontSize: 13,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                  <input
                    value={state2}
                    onChange={(e) =>
                      setState2(e.target.value.toUpperCase().slice(0, 2))
                    }
                    placeholder="UF *"
                    maxLength={2}
                    style={{
                      width: 60,
                      padding: "10px 12px",
                      borderRadius: 10,
                      border: `1.5px solid ${colors.bordaLilas}`,
                      fontSize: 13,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                      textAlign: "center",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Itens do carrinho */}
          {cart.length === 0 ? (
            <div
              style={{ textAlign: "center", padding: "32px 0", color: "#aaa" }}
            >
              <p style={{ fontSize: 28, marginBottom: 8 }}>🛒</p>
              <p style={{ fontSize: 14 }}>Carrinho vazio</p>
            </div>
          ) : (
            <div
              style={{
                background: "#fff",
                borderRadius: 12,
                border: `1px solid ${colors.bordaLilas}`,
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              {cart.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: "10px 12px",
                    borderBottom: `1px solid ${colors.fundo}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.noite,
                      }}
                    >
                      {item.name}
                    </p>
                    {item.notes && (
                      <p
                        style={{
                          fontSize: 11,
                          color: "#aaa",
                          fontStyle: "italic",
                        }}
                      >
                        {item.notes}
                      </p>
                    )}
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: colors.rosa,
                      }}
                    >
                      R$ {(item.price * item.quantity).toFixed(2)}
                    </p>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <button
                      onClick={() => updateQty(idx, item.quantity - 1)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        border: `1px solid ${colors.bordaLilas}`,
                        background: "#fff",
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        minWidth: 20,
                        textAlign: "center",
                      }}
                    >
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQty(idx, item.quantity + 1)}
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 8,
                        border: `1px solid ${colors.bordaLilas}`,
                        background: "#fff",
                        fontSize: 14,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => removeFromCart(idx)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#ccc",
                      fontSize: 18,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <div
                style={{
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  Total
                </p>
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 22,
                    color: colors.rosa,
                  }}
                >
                  R$ {total.toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Botão finalizar */}
          <button
            onClick={handleFinish}
            disabled={saving || cart.length === 0}
            style={{
              width: "100%",
              padding: "15px",
              borderRadius: 13,
              background: cart.length === 0 ? "#ccc" : "#22c55e",
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: cart.length === 0 ? "default" : "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {saving ? "Enviando..." : `✅ Finalizar — R$ ${total.toFixed(2)}`}
          </button>
        </div>
      )}

      {/* Modal de produto */}
      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          storeId={storeId ?? ""}
          allProducts={products}
          onAdd={addToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
