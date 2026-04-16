import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { colors, Spinner } from "./ui";
import {
  ProductSizePrice,
  fetchSizePricesForProduct,
} from "../hooks/useProductSizes";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  allows_half: boolean;
  size_type: string;
}

interface ProductModalProps {
  product: Product;
  storeId: string;
  allProducts: Product[]; // lista completa para escolher a metade
  onAdd: (item: CartItem) => void;
  onClose: () => void;
}

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  notes: string | undefined;
  quantity: number;
  size_id?: string;
  size_name?: string;
  half_id?: string;
  half_name?: string;
}

export function ProductModal({
  product,
  storeId,
  allProducts,
  onAdd,
  onClose,
}: ProductModalProps) {
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [selectedSize, setSelectedSize] = useState<ProductSizePrice | null>(
    null,
  );
  const [sizes, setSizes] = useState<ProductSizePrice[]>([]);
  const [loadingSizes, setLoadingSizes] = useState(false);

  // Meia pizza
  const [wantsHalf, setWantsHalf] = useState(false);
  const [halfProduct, setHalfProduct] = useState<Product | null>(null);
  const [halfSize, setHalfSize] = useState<ProductSizePrice | null>(null);
  const [halfSizes, setHalfSizes] = useState<ProductSizePrice[]>([]);
  const [halfSearch, setHalfSearch] = useState("");

  // Debug — remover após confirmar
  console.log("[ProductModal]", product.name, {
    allows_half: product.allows_half,
    size_type: product.size_type,
    halfCandidatesCount: allProducts.filter(
      (p) => p.allows_half === true && p.id !== product.id,
    ).length,
  });

  const hasSizes = product.size_type === "sizes";
  const allowsHalf = product.allows_half === true; // defensivo contra null/undefined

  // Carrega tamanhos do produto principal
  useEffect(() => {
    if (!hasSizes) return;
    setLoadingSizes(true);
    fetchSizePricesForProduct(product.id).then((data) => {
      setSizes(data);
      if (data.length > 0) setSelectedSize(data[0]);
      setLoadingSizes(false);
    });
  }, [product.id, hasSizes]);

  // Carrega tamanhos da metade escolhida
  useEffect(() => {
    if (!halfProduct || !hasSizes) return;
    fetchSizePricesForProduct(halfProduct.id).then((data) => {
      setHalfSizes(data);
      // Tenta pré-selecionar o mesmo tamanho
      const match = data.find((d) => d.size_id === selectedSize?.size_id);
      setHalfSize(match ?? (data.length > 0 ? data[0] : null));
    });
  }, [halfProduct, selectedSize]);

  // Preço final: maior entre as duas metades (ou preço base se sem tamanho)
  function finalPrice(): number {
    if (hasSizes) {
      const p1 = selectedSize?.price ?? 0;
      if (wantsHalf && halfSize) {
        return Math.max(p1, halfSize.price);
      }
      return p1;
    }
    // sem tamanho
    if (wantsHalf && halfProduct) {
      return Math.max(Number(product.price), Number(halfProduct.price));
    }
    return Number(product.price);
  }

  const unitPrice = finalPrice();
  const totalPrice = unitPrice * qty;

  // Produtos compatíveis para meia pizza (mesma loja, allows_half, diferente do atual)
  const halfCandidates = allProducts
    .filter(
      (p) =>
        p.id !== product.id && p.allows_half === true && p.active !== false,
    )
    .filter(
      (p) =>
        halfSearch.length < 2 ||
        p.name.toLowerCase().includes(halfSearch.toLowerCase()),
    );

  function handleAdd() {
    const item: CartItem = {
      product_id: product.id,
      name:
        wantsHalf && halfProduct
          ? `½ ${product.name} + ½ ${halfProduct.name}`
          : product.name,
      price: unitPrice,
      image_url: product.image_url,
      notes: notes.trim() || undefined,
      quantity: qty,
      size_id: selectedSize?.size_id,
      size_name: selectedSize?.product_sizes?.name,
      half_id: halfProduct?.id,
      half_name: halfProduct?.name,
    };
    onAdd(item);
  }

  return (
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
          maxWidth: 520,
          maxHeight: "90dvh",
          overflowY: "auto",
        }}
      >
        {/* Imagem */}
        <div
          style={{
            height: 110,
            background: colors.noite,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 44,
          }}
        >
          {product.image_url ? (
            <img
              src={product.image_url}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            "🍕"
          )}
          <button
            onClick={onClose}
            style={{
              position: "absolute",
              top: 10,
              right: 14,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 30,
              height: 30,
              color: "#fff",
              cursor: "pointer",
              fontSize: 15,
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
            gap: 14,
          }}
        >
          {/* Nome e preço */}
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: colors.noite }}>
              {product.name}
            </p>
            {product.description && (
              <p
                style={{
                  fontSize: 12,
                  color: "#888",
                  marginTop: 4,
                  lineHeight: 1.6,
                }}
              >
                {product.description}
              </p>
            )}
          </div>

          {/* ── Tamanhos ── */}
          {hasSizes && (
            <div>
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
                Tamanho
              </p>
              {loadingSizes ? (
                <Spinner color={colors.rosa} size={20} />
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {sizes.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSize(s)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 10,
                        border: `2px solid ${selectedSize?.id === s.id ? colors.rosa : colors.bordaLilas}`,
                        background:
                          selectedSize?.id === s.id ? "#fff0f8" : "#fff",
                        cursor: "pointer",
                        transition: "all 0.15s",
                      }}
                    >
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: colors.noite,
                        }}
                      >
                        {s.product_sizes?.name}
                      </p>
                      <p
                        style={{
                          fontSize: 12,
                          color: colors.rosa,
                          fontWeight: 600,
                        }}
                      >
                        R$ {Number(s.price).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Meia pizza ── */}
          {allowsHalf && (
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
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: wantsHalf ? 12 : 0,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    🍕 Meia pizza
                  </p>
                  <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    Escolha outro sabor para a metade
                  </p>
                </div>
                {/* Toggle */}
                <div
                  onClick={() => {
                    setWantsHalf((v) => !v);
                    setHalfProduct(null);
                    setHalfSearch("");
                  }}
                  style={{
                    width: 42,
                    height: 24,
                    borderRadius: 12,
                    background: wantsHalf ? colors.rosa : "#d1d5db",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 4,
                      left: wantsHalf ? 20 : 4,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>

              {wantsHalf && (
                <div>
                  {/* Busca */}
                  <input
                    value={halfSearch}
                    onChange={(e) => setHalfSearch(e.target.value)}
                    placeholder="Buscar sabor..."
                    style={{
                      width: "100%",
                      background: colors.fundo,
                      border: `1px solid ${colors.bordaLilas}`,
                      borderRadius: 9,
                      padding: "8px 12px",
                      fontSize: 12,
                      color: colors.noite,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                      marginBottom: 8,
                    }}
                  />

                  {halfCandidates.length === 0 ? (
                    <p
                      style={{
                        fontSize: 12,
                        color: "#aaa",
                        textAlign: "center",
                        padding: "8px 0",
                      }}
                    >
                      Nenhum sabor encontrado
                    </p>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        maxHeight: 200,
                        overflowY: "auto",
                      }}
                    >
                      {halfCandidates.map((p) => (
                        <div
                          key={p.id}
                          onClick={() => setHalfProduct(p)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: `1.5px solid ${halfProduct?.id === p.id ? colors.rosa : colors.bordaLilas}`,
                            background:
                              halfProduct?.id === p.id ? "#fff0f8" : "#fafafa",
                            cursor: "pointer",
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 8,
                              background: colors.lilasClaro,
                              overflow: "hidden",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 18,
                              flexShrink: 0,
                            }}
                          >
                            {p.image_url ? (
                              <img
                                src={p.image_url}
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
                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: colors.noite,
                              }}
                            >
                              {p.name}
                            </p>
                            <p style={{ fontSize: 11, color: "#888" }}>
                              {p.size_type === "sizes"
                                ? "Preço varia por tamanho"
                                : `R$ ${Number(p.price).toFixed(2)}`}
                            </p>
                          </div>
                          {halfProduct?.id === p.id && (
                            <span style={{ fontSize: 14, color: colors.rosa }}>
                              ✓
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Aviso de preço */}
                  {halfProduct && (
                    <div
                      style={{
                        marginTop: 8,
                        background: "#fff8e6",
                        border: "1px solid #fcd34d",
                        borderRadius: 8,
                        padding: "8px 10px",
                      }}
                    >
                      <p style={{ fontSize: 11, color: "#92400e" }}>
                        💡 O preço cobrado é sempre o{" "}
                        <strong>maior valor</strong> entre os dois sabores.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Observação ── */}
          <div>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 6,
              }}
            >
              Observação
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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

          {/* ── Quantidade ── */}
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
            <p style={{ fontSize: 13, fontWeight: 600, color: colors.noite }}>
              Quantidade
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <button
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                style={{
                  width: 30,
                  height: 30,
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
                {qty}
              </span>
              <button
                onClick={() => setQty((q) => q + 1)}
                style={{
                  width: 30,
                  height: 30,
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

          {/* ── Botão adicionar ── */}
          <button
            onClick={handleAdd}
            disabled={hasSizes && !selectedSize}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 13,
              background: hasSizes && !selectedSize ? "#ccc" : colors.rosa,
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: hasSizes && !selectedSize ? "not-allowed" : "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Adicionar · R$ {totalPrice.toFixed(2)}
          </button>
        </div>
      </div>
    </div>
  );
}
