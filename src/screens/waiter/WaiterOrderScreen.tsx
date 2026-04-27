import { useState, useMemo } from "react";
import Swal from "sweetalert2";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useWaiter, usePDVOrder } from "../../hooks/usePdv";
import {
  fetchSizePricesForProduct,
  ProductSizePrice,
} from "../../hooks/useProductSizes";
import { ProductModal, CartItem } from "../../components/ProductModal";
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

  function handleAddProduct(product: any) {
    setNoteProduct(product);
  }

  async function handleCartItemAdd(item: CartItem) {
    if (!order) {
      showToast("Comanda não encontrada. Tente recarregar a página.", "error");
      return;
    }
    setAdding(item.product_id);
    try {
      for (let q = 0; q < item.quantity; q++) {
        await addItem({
          product_id: item.product_id,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          notes: item.notes || undefined,
        });
      }
      showToast(`${item.name} adicionado!`);
      setNoteProduct(null);
      setTab("order");
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

    // Busca itens atualizados do banco
    const { data: freshItems } = await supabase
      .from("pdv_order_items")
      .select("*")
      .eq("order_id", order?.id ?? "");
    const currentItems = freshItems ?? order?.pdv_order_items ?? [];

    // Bloqueia se tiver itens pendentes ou em preparo
    const pendingItems = currentItems.filter((i: any) =>
      ["pending", "preparing"].includes(i.status),
    );
    if (pendingItems.length > 0) {
      await Swal.fire({
        title: "⚠️ Itens em preparo",
        html: `<p>Ainda há <strong>${pendingItems.length} item(s)</strong> sendo preparado(s) ou aguardando a cozinha.</p><p style="margin-top:8px;color:#888;font-size:13px">Aguarde a cozinha marcar como pronto e confirme a entrega antes de fechar.</p>`,
        icon: "warning",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#f59e0b",
      });
      return;
    }

    // Avisa se tiver itens prontos não entregues
    const readyNotServed = currentItems.filter(
      (i: any) => i.status === "ready",
    );
    if (readyNotServed.length > 0) {
      const { isConfirmed: proceed } = await Swal.fire({
        title: "⚠️ Itens prontos não entregues",
        html: `<p>Há <strong>${readyNotServed.length} item(s)</strong> prontos que ainda não foram entregues.</p><p style="margin-top:8px;color:#888;font-size:13px">Deseja fechar mesmo assim?</p>`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Fechar mesmo assim",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#f59e0b",
      });
      if (!proceed) return;
      // Marca itens prontos como entregues
      for (const item of readyNotServed) {
        await supabase
          .from("pdv_order_items")
          .update({ status: "served" })
          .eq("id", item.id);
      }
    }

    const { isConfirmed } = await Swal.fire({
      title: "Fechar a conta?",
      text: "A mesa será marcada como aguardando pagamento.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, fechar conta",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#f59e0b",
    });
    if (!isConfirmed) return;
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
              color: "#fff",
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
                    >
                      R$ {Number(product.price).toFixed(2)}
                    </p>
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
        <ProductModal
          product={noteProduct}
          storeId={storeId ?? ""}
          allProducts={products}
          onAdd={handleCartItemAdd}
          onClose={() => setNoteProduct(null)}
        />
      )}

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
