import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useWaiter, usePDVOrder } from "../../hooks/usePDV";
import {
  fetchSizePricesForProduct,
  ProductSizePrice,
} from "../../hooks/useProductSizes";
import { useStoreProducts } from "../../hooks/useCustomer";
import { colors, Spinner, Toast } from "../../components/ui";

export default function WaiterOrderScreen() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const { tables, requestBill, storeId } = useWaiter();
  const table = tables.find((t) => t.id === tableId);

  const { order, loading, addItem, removeItem, updateItemQty, refetch } =
    usePDVOrder(tableId ?? null);
  const { products, categories } = useStoreProducts(
    order?.store_id ?? storeId ?? null,
  );

  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [adding, setAdding] = useState<string | null>(null);
  const [tab, setTab] = useState<"products" | "order">("products");
  const [noteProduct, setNoteProduct] = useState<any | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteSizes, setNoteSizes] = useState<ProductSizePrice[]>([]);
  const [noteSelectedSize, setNoteSelectedSize] =
    useState<ProductSizePrice | null>(null);
  const [loadingSizes, setLoadingSizes] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 2500);
  }

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = !activeCategory || p.category === activeCategory;
      const matchSearch =
        !search || p.name.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch && p.active !== false;
    });
  }, [products, activeCategory, search]);

  async function handleAddProduct(product: any) {
    setNoteProduct(product);
    setNoteText("");
    setNoteSizes([]);
    setNoteSelectedSize(null);
    if (product.size_type === "sizes") {
      setLoadingSizes(true);
      const sizes = await fetchSizePricesForProduct(product.id);
      setNoteSizes(sizes);
      if (sizes.length > 0) setNoteSelectedSize(sizes[0]);
      setLoadingSizes(false);
    }
  }

  async function confirmAddProduct() {
    if (!noteProduct) return;
    if (!order) {
      showToast("Comanda não encontrada. Tente recarregar a página.", "error");
      return;
    }
    if (noteProduct.size_type === "sizes" && !noteSelectedSize) {
      showToast("Selecione um tamanho", "error");
      return;
    }
    setAdding(noteProduct.id);
    try {
      const sizeName = noteSelectedSize?.product_sizes?.name;
      const sizePrice = noteSelectedSize
        ? Number(noteSelectedSize.price)
        : Number(noteProduct.price);
      const itemName = sizeName
        ? `${noteProduct.name} (${sizeName})`
        : noteProduct.name;
      await addItem({
        product_id: noteProduct.id,
        name: itemName,
        quantity: 1,
        unit_price: sizePrice,
        notes: noteText.trim() || undefined,
      });
      showToast(`${itemName} adicionado!`);
      setNoteProduct(null);
      setNoteText("");
      setNoteSizes([]);
      setNoteSelectedSize(null);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setAdding(null);
    }
  }

  async function handleMarkServed() {
    if (!order || readyItems.length === 0) return;
    for (const item of readyItems) {
      await supabase
        .from("pdv_order_items")
        .update({ status: "served" })
        .eq("id", item.id);
    }
    showToast("Itens entregues!");
    await refetch();
  }

  async function handleRequestBill() {
    if (!tableId) return;
    // Marca mesa como aguardando conta e abre tela de fechamento
    await requestBill(tableId);
    navigate(`/waiter/bill/${tableId}`);
  }

  const orderTotal = order?.total ?? 0;
  const itemCount =
    order?.pdv_order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const readyItems =
    order?.pdv_order_items?.filter((i) => i.status === "ready") ?? [];
  const readyCount = readyItems.reduce((s, i) => s + i.quantity, 0);

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
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "14px 20px 16px" }}
        >
          <button
            onClick={() => navigate("/waiter")}
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
              <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                {table?.name ?? `Mesa ${table?.number ?? "..."}`}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                {itemCount} {itemCount === 1 ? "item" : "itens"} · R${" "}
                {orderTotal.toFixed(2)}
              </p>
              {table?.pin && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                  }}
                >
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                    PIN do cliente:
                  </p>
                  <div
                    style={{
                      background: colors.rosa,
                      borderRadius: 6,
                      padding: "2px 10px",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "'Righteous', cursive",
                        fontSize: 16,
                        color: "#fff",
                        letterSpacing: "0.2em",
                      }}
                    >
                      {table.pin}
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {readyCount > 0 && (
                <button
                  onClick={handleMarkServed}
                  style={{
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    padding: "8px 14px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                    animation: "none",
                  }}
                >
                  ✓ Retirei ({readyCount})
                </button>
              )}
              <button
                onClick={handleRequestBill}
                disabled={itemCount === 0}
                style={{
                  background: itemCount === 0 ? "#ccc" : "#f59e0b",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: itemCount === 0 ? "not-allowed" : "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Pedir conta
              </button>
            </div>
          </div>

          {/* Abas */}
          <div style={{ display: "flex", gap: 4, marginTop: 14 }}>
            {(["products", "order"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  flex: 1,
                  padding: "8px",
                  borderRadius: 10,
                  background:
                    tab === t ? colors.rosa : "rgba(255,255,255,0.08)",
                  color: tab === t ? "#fff" : "rgba(255,255,255,0.5)",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {t === "products" ? "🍕 Produtos" : `📋 Comanda (${itemCount})`}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "12px 16px" }}>
        {/* ── Aba Produtos ── */}
        {tab === "products" && (
          <>
            {/* Busca */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#fff",
                borderRadius: 11,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "9px 12px",
                marginBottom: 10,
              }}
            >
              <span style={{ fontSize: 14 }}>🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produto..."
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  fontSize: 13,
                  color: colors.noite,
                  fontFamily: "'Space Grotesk', sans-serif",
                  background: "none",
                }}
              />
            </div>

            {/* Categorias */}
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
                marginBottom: 12,
              }}
            >
              <button
                onClick={() => setActiveCategory(null)}
                style={{
                  flexShrink: 0,
                  padding: "6px 14px",
                  borderRadius: 20,
                  background: !activeCategory ? colors.rosa : colors.lilasClaro,
                  color: !activeCategory ? "#fff" : "#7e22ce",
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() =>
                    setActiveCategory(cat === activeCategory ? null : cat)
                  }
                  style={{
                    flexShrink: 0,
                    padding: "6px 14px",
                    borderRadius: 20,
                    background:
                      activeCategory === cat ? colors.rosa : colors.lilasClaro,
                    color: activeCategory === cat ? "#fff" : "#7e22ce",
                    border: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Lista de produtos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredProducts.map((product) => (
                <div
                  key={product.id}
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
                  {/* Imagem */}
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 10,
                      background: colors.lilasClaro,
                      overflow: "hidden",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 22,
                    }}
                  >
                    {product.image_url ? (
                      <img
                        src={product.image_url}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    ) : (
                      "🍽️"
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
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
                      {product.name}
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: colors.rosa,
                        fontWeight: 600,
                      }}
                    ></p>
                  </div>
                  <button
                    onClick={() => handleAddProduct(product)}
                    disabled={adding === product.id}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background: adding === product.id ? "#ccc" : colors.rosa,
                      border: "none",
                      color: "#fff",
                      fontSize: 20,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {adding === product.id ? "…" : "+"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Aba Comanda ── */}
        {tab === "order" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {!order?.pdv_order_items?.length ? (
              <div style={{ textAlign: "center", padding: "40px 20px" }}>
                <p style={{ fontSize: 32, marginBottom: 8 }}>🍽️</p>
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  Comanda vazia
                </p>
                <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                  Adicione itens na aba Produtos
                </p>
              </div>
            ) : (
              <>
                {order.pdv_order_items.map((item) => (
                  <div
                    key={item.id}
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.noite,
                        }}
                      >
                        {item.name}
                      </p>
                      <p style={{ fontSize: 11, color: "#888" }}>
                        R$ {Number(item.unit_price).toFixed(2)} cada
                      </p>
                      {item.status === "ready" && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "#f0fdf4",
                            border: "1px solid #86efac",
                            borderRadius: 6,
                            padding: "1px 6px",
                            color: "#15803d",
                            fontWeight: 700,
                          }}
                        >
                          🔔 Pronto para retirar
                        </span>
                      )}
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
                    </div>
                    {/* Quantidade */}
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <button
                        onClick={() =>
                          updateItemQty(item.id, item.quantity - 1)
                        }
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: colors.lilasClaro,
                          border: "none",
                          color: colors.noite,
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        −
                      </button>
                      <span
                        style={{
                          fontSize: 14,
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
                          updateItemQty(item.id, item.quantity + 1)
                        }
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 8,
                          background: colors.rosa,
                          border: "none",
                          color: "#fff",
                          fontSize: 16,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        +
                      </button>
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.rosa,
                        minWidth: 60,
                        textAlign: "right",
                      }}
                    >
                      R$ {Number(item.total_price).toFixed(2)}
                    </p>
                  </div>
                ))}

                {/* Total */}
                <div
                  style={{
                    background: colors.noite,
                    borderRadius: 13,
                    padding: "14px 16px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 4,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "rgba(255,255,255,0.7)",
                    }}
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
                    R$ {orderTotal.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={handleRequestBill}
                  disabled={itemCount === 0}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 13,
                    background: itemCount === 0 ? "#ccc" : "#f59e0b",
                    color: "#fff",
                    border: "none",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: itemCount === 0 ? "not-allowed" : "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                    marginTop: 4,
                  }}
                >
                  {itemCount === 0
                    ? "Adicione itens para solicitar a conta"
                    : "Solicitar a conta"}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Modal de observação */}
      {noteProduct && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              padding: "20px 20px 32px",
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 4,
              }}
            >
              {noteProduct.name}
            </p>
            <p
              style={{
                fontSize: 13,
                color: colors.rosa,
                fontWeight: 600,
                marginBottom: noteProduct.size_type === "sizes" ? 12 : 16,
              }}
            >
              {noteSelectedSize
                ? `R$ ${Number(noteSelectedSize.price).toFixed(2)}`
                : noteProduct.price > 0
                  ? `R$ ${Number(noteProduct.price).toFixed(2)}`
                  : "Selecione o tamanho"}
            </p>
            {noteProduct.size_type === "sizes" && (
              <div style={{ marginBottom: 14 }}>
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
                  Tamanho
                </p>
                {loadingSizes ? (
                  <p style={{ fontSize: 12, color: "#aaa" }}>Carregando...</p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {noteSizes.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setNoteSelectedSize(s)}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 20,
                          border: `1.5px solid ${noteSelectedSize?.id === s.id ? colors.rosa : colors.bordaLilas}`,
                          background:
                            noteSelectedSize?.id === s.id
                              ? "#fff0f8"
                              : "#fafafa",
                          color:
                            noteSelectedSize?.id === s.id
                              ? colors.rosa
                              : "#888",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        {s.product_sizes?.name} · R${" "}
                        {Number(s.price).toFixed(2)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Observação (opcional)
            </p>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Ex: sem cebola, bem passado, sem gelo..."
              rows={3}
              autoFocus
              style={{
                width: "100%",
                border: `1.5px solid ${colors.bordaLilas}`,
                borderRadius: 10,
                padding: "10px 12px",
                fontSize: 13,
                color: colors.noite,
                fontFamily: "'Space Grotesk', sans-serif",
                resize: "none",
                outline: "none",
                marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setNoteProduct(null);
                  setNoteText("");
                }}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: 11,
                  background: colors.lilasClaro,
                  color: "#7e22ce",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddProduct}
                disabled={adding === noteProduct.id}
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: 11,
                  background: colors.rosa,
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {adding === noteProduct.id ? "Adicionando..." : "+ Adicionar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
