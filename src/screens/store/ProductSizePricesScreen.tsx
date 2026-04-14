import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import {
  useProductSizes,
  useProductSizePrices,
} from "../../hooks/useProductSizes";
import { colors, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

export default function ProductSizePricesScreen() {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { store } = useStore();

  const { sizes } = useProductSizes(store?.id ?? null);
  const { prices, loading, upsertPrice } = useProductSizePrices(
    productId ?? null,
  );

  const [product, setProduct] = useState<any>(null);
  const [priceMap, setPriceMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  // Carrega produto
  useEffect(() => {
    if (!productId) return;
    supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single()
      .then(({ data }) => setProduct(data));
  }, [productId]);

  // Inicializa priceMap com valores existentes
  useEffect(() => {
    const map: Record<string, string> = {};
    prices.forEach((p) => {
      map[p.size_id] = String(p.price);
    });
    setPriceMap((prev) => ({ ...prev, ...map }));
  }, [prices]);

  async function handleSave(sizeId: string) {
    const val = parseFloat(priceMap[sizeId] ?? "0");
    if (!val || val <= 0) {
      showToast("Digite um preço válido", "error");
      return;
    }
    if (!productId) return;
    setSaving(sizeId);
    try {
      await upsertPrice(productId, sizeId, val);
      showToast("Preço salvo!");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(null);
    }
  }

  const getPriceForSize = (sizeId: string) =>
    prices.find((p) => p.size_id === sizeId);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 18px" }}
        >
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
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            Preços por tamanho
          </p>
          <p
            style={{
              fontSize: 12,
              color: colors.rosa,
              marginTop: 2,
              fontWeight: 600,
            }}
          >
            {product?.name ?? "..."}
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {sizes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 8,
              }}
            >
              Nenhum tamanho cadastrado
            </p>
            <button
              onClick={() => navigate("/store/sizes")}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                background: colors.rosa,
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Criar tamanhos →
            </button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#aaa" }}>
              Defina o preço deste produto para cada tamanho:
            </p>
            {sizes.map((size) => {
              const existing = getPriceForSize(size.id);
              return (
                <div
                  key={size.id}
                  style={{
                    background: "#fff",
                    borderRadius: 13,
                    border: `1px solid ${existing ? "#86efac" : colors.bordaLilas}`,
                    padding: "12px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.noite,
                        marginBottom: 6,
                      }}
                    >
                      {size.name}
                    </p>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <span style={{ fontSize: 13, color: "#888" }}>R$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0,00"
                        value={priceMap[size.id] ?? ""}
                        onChange={(e) =>
                          setPriceMap((prev) => ({
                            ...prev,
                            [size.id]: e.target.value,
                          }))
                        }
                        style={{
                          width: 90,
                          border: `1.5px solid ${colors.bordaLilas}`,
                          borderRadius: 8,
                          padding: "6px 10px",
                          fontSize: 14,
                          fontWeight: 600,
                          color: colors.noite,
                          fontFamily: "'Space Grotesk', sans-serif",
                          outline: "none",
                        }}
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => handleSave(size.id)}
                    disabled={saving === size.id}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 9,
                      background: existing ? "#f0fdf4" : colors.rosa,
                      color: existing ? "#15803d" : "#fff",
                      border: existing ? "1px solid #86efac" : "none",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                      flexShrink: 0,
                    }}
                  >
                    {saving === size.id
                      ? "..."
                      : existing
                        ? "✓ Salvo"
                        : "Salvar"}
                  </button>
                </div>
              );
            })}

            <div
              style={{
                background: colors.lilasClaro,
                borderRadius: 12,
                padding: "12px 14px",
                marginTop: 4,
              }}
            >
              <p style={{ fontSize: 12, color: "#7e22ce", lineHeight: 1.6 }}>
                💡 No pedido do cliente, o preço da meia pizza será sempre o{" "}
                <strong>maior valor</strong> entre os dois sabores escolhidos no
                mesmo tamanho.
              </p>
            </div>
          </>
        )}
      </div>

      <BottomNav active="products" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
