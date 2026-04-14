import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStoreDetail, useStoreProducts } from "../../hooks/useCustomer";
import { useCart } from "../../contexts/CartContext";
import { ProductModal, CartItem } from "../../components/ProductModal";
import { colors, Spinner, Toast } from "../../components/ui";

export default function CustomerStoreScreen() {
  const { id } = useParams<{ id: string }>(); // rota: /loja/:id
  const navigate = useNavigate();
  const { store, loading: storeLoading } = useStoreDetail(id ?? null);
  const {
    products,
    categories,
    loading: prodsLoading,
  } = useStoreProducts(id ?? null);
  const { addItem, items, itemCount, total, storeId: cartStoreId } = useCart();

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [productQty, setProductQty] = useState(1);
  const [productNotes, setProductNotes] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showDiffStoreModal, setShowDiffStoreModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<any | null>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 2500);
  }

  function openProduct(product: any) {
    setSelectedProduct(product);
    setProductQty(1);
    setProductNotes("");
  }

  function handleAddToCart(product: any) {
    if (!store) return;

    // Carrinho de loja diferente
    if (cartStoreId && cartStoreId !== store.id) {
      setPendingProduct(product);
      setShowDiffStoreModal(true);
      return;
    }

    doAddToCart(product);
  }

  function doAddToCart(product: any) {
    if (!store) return;
    addItem(
      {
        product_id: product.id,
        name: product.name,
        price: Number(product.price),
        image_url: product.image_url,
        notes: productNotes || undefined,
      },
      store.id,
      store.name,
    );
    setSelectedProduct(null);
    showToast(`${product.name} adicionado!`);
  }

  function confirmClearCart() {
    if (!pendingProduct) return;
    doAddToCart(pendingProduct);
    setPendingProduct(null);
    setShowDiffStoreModal(false);
  }

  const filteredProducts = activeCat
    ? products.filter((p) => p.category === activeCat)
    : products;

  const groupedProducts = categories.reduce(
    (acc, cat) => {
      const prods = filteredProducts.filter((p) => p.category === cat);
      if (prods.length > 0) acc[cat] = prods;
      return acc;
    },
    {} as Record<string, any[]>,
  );

  if (storeLoading)
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

  if (!store)
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
        <p style={{ color: "#888" }}>Comércio não encontrado</p>
      </div>
    );

  const cartItems = items.filter((i) => cartStoreId === store.id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: cartItems.length > 0 ? 100 : 24,
      }}
    >
      {/* Banner / header da loja */}
      <div
        style={{
          background: colors.noite,
          padding: "0 0 14px",
          position: "relative",
        }}
      >
        <div
          style={{
            height: 90,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          {store.logo_url ? (
            <img
              src={store.logo_url}
              alt={store.name}
              style={{ height: 56, objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 24,
                color: "#fff",
                letterSpacing: 1,
              }}
            >
              {store.name.toUpperCase()}
            </span>
          )}
          <button
            onClick={() => navigate(-1)}
            style={{
              position: "absolute",
              top: 14,
              left: 16,
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 8,
              padding: "5px 10px",
              color: "#fff",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Voltar
          </button>
          {store.open_now && (
            <span
              style={{
                position: "absolute",
                bottom: 8,
                right: 14,
                background: "#22c55e",
                color: "#fff",
                fontSize: 9,
                fontWeight: 700,
                padding: "3px 9px",
                borderRadius: 8,
              }}
            >
              Aberto · {store.estimated_time ?? 30} min
            </span>
          )}
        </div>

        {/* Info rápida */}
        <div style={{ padding: "0 16px", display: "flex", gap: 12 }}>
          {[
            { icon: "⏱", label: `${store.estimated_time ?? 30} min` },
            {
              icon: "🛵",
              label:
                store.delivery_fee > 0
                  ? `R$\u00a0${store.delivery_fee.toFixed(0)}`
                  : "Grátis",
            },
            {
              icon: "🛒",
              label:
                store.min_order_value > 0
                  ? `Mín. R$\u00a0${store.min_order_value.toFixed(0)}`
                  : "Sem mínimo",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              <span style={{ fontSize: 12 }}>{s.icon}</span>
              <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* Filtro de categorias */}
        <div
          style={{
            display: "flex",
            gap: 6,
            padding: "10px 16px 0",
            overflowX: "auto",
          }}
        >
          <button
            onClick={() => setActiveCat(null)}
            style={{
              padding: "5px 13px",
              borderRadius: 20,
              border: "none",
              whiteSpace: "nowrap",
              background: !activeCat ? colors.rosa : "rgba(255,255,255,0.1)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCat(cat)}
              style={{
                padding: "5px 13px",
                borderRadius: 20,
                border: "none",
                whiteSpace: "nowrap",
                background:
                  activeCat === cat ? colors.rosa : "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de produtos */}
      {prodsLoading ? (
        <div style={{ padding: 40, textAlign: "center" }}>
          <Spinner color={colors.rosa} />
        </div>
      ) : (
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "12px 16px" }}>
          {Object.entries(groupedProducts).map(([cat, prods]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
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
                {cat}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {prods.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => openProduct(product)}
                    style={{
                      background: "#fff",
                      borderRadius: 13,
                      border: `1px solid ${colors.bordaLilas}`,
                      padding: "10px 12px",
                      display: "flex",
                      gap: 10,
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 10,
                        background: colors.lilasClaro,
                        flexShrink: 0,
                        overflow: "hidden",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 24,
                      }}
                    >
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        "🍕"
                      )}
                    </div>
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
                            fontSize: 10,
                            color: "#aaa",
                            marginTop: 2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {product.description}
                        </p>
                      )}
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.rosa,
                          marginTop: 4,
                        }}
                      >
                        R$ {Number(product.price).toFixed(2)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddToCart(product);
                      }}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 8,
                        background: colors.rosa,
                        border: "none",
                        color: "#fff",
                        fontSize: 18,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Barra do carrinho */}
      {cartItems.length > 0 && (
        <div
          onClick={() => navigate("/cart")}
          style={{
            position: "fixed",
            bottom: 16,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 448,
            background: colors.noite,
            borderRadius: 13,
            padding: "12px 16px",
            cursor: "pointer",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                background: colors.rosa,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              {cartItems.reduce((s, i) => s + i.quantity, 0)}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
              itens
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 16,
              color: colors.rosa,
            }}
          >
            R$ {total.toFixed(2)} →
          </span>
        </div>
      )}

      {/* Modal de produto — com tamanhos e meia pizza */}
      {selectedProduct && store && (
        <ProductModal
          product={selectedProduct}
          storeId={store.id}
          allProducts={products}
          onAdd={handleCartItemAdd}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* REMOVIDO: modal inline antigo */}
      {false && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: colors.fundo,
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              maxHeight: "85dvh",
              overflowY: "auto",
            }}
          >
            {/* Imagem */}
            <div
              style={{
                height: 100,
                background: colors.noite,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 40,
                position: "relative",
              }}
            >
              {selectedProduct.image_url ? (
                <img
                  src={selectedProduct.image_url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                "🍕"
              )}
              <button
                onClick={() => setSelectedProduct(null)}
                style={{
                  position: "absolute",
                  top: 10,
                  right: 14,
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "16px 20px 32px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div>
                <p
                  style={{ fontSize: 17, fontWeight: 700, color: colors.noite }}
                >
                  {selectedProduct.name}
                </p>
                {selectedProduct.description && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#888",
                      marginTop: 4,
                      lineHeight: 1.6,
                    }}
                  >
                    {selectedProduct.description}
                  </p>
                )}
                <p
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: colors.rosa,
                    marginTop: 6,
                  }}
                >
                  R$ {Number(selectedProduct.price).toFixed(2)}
                </p>
              </div>

              {/* Observação */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: colors.noite,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 6,
                  }}
                >
                  Observação
                </p>
                <textarea
                  value={productNotes}
                  onChange={(e) => setProductNotes(e.target.value)}
                  placeholder="Sem cebola, borda recheada..."
                  rows={2}
                  style={{
                    width: "100%",
                    background: "#fff",
                    border: `1.5px solid ${colors.bordaLilas}`,
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 13,
                    color: colors.noite,
                    fontFamily: "'Space Grotesk', sans-serif",
                    resize: "none",
                    outline: "none",
                  }}
                />
              </div>

              {/* Quantidade */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff",
                  borderRadius: 12,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "10px 14px",
                }}
              >
                <p
                  style={{ fontSize: 13, fontWeight: 600, color: colors.noite }}
                >
                  Quantidade
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    onClick={() => setProductQty((q) => Math.max(1, q - 1))}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: colors.lilasClaro,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: 700,
                      color: colors.noite,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 700,
                      color: colors.noite,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {productQty}
                  </span>
                  <button
                    onClick={() => setProductQty((q) => q + 1)}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: colors.rosa,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 16,
                      fontWeight: 700,
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              <button
                onClick={() => handleAddToCart(selectedProduct)}
                style={{
                  width: "100%",
                  padding: "13px",
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
                Adicionar · R${" "}
                {(Number(selectedProduct.price) * productQty).toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: loja diferente */}
      {showDiffStoreModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 300,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              width: "100%",
              maxWidth: 320,
            }}
          >
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 8,
              }}
            >
              Esvaziar carrinho?
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#888",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              Você já tem itens de outro comércio no carrinho. Deseja esvaziar e
              continuar?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => {
                  setShowDiffStoreModal(false);
                  setPendingProduct(null);
                }}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 10,
                  border: `1px solid ${colors.bordaLilas}`,
                  background: "#fff",
                  color: colors.noite,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmClearCart}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background: colors.rosa,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Esvaziar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
