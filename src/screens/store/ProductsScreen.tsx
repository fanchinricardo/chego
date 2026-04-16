import { useState, useRef, useEffect } from "react";
import { useStore } from "../../hooks/useStore";
import { useProducts, Product, ProductPayload } from "../../hooks/useProducts";
import {
  useProductSizes,
  useProductSizePrices,
} from "../../hooks/useProductSizes";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";
import { useNavigate } from "react-router-dom";

const EMOJI_CATEGORIES: Record<string, string> = {
  Geral: "📦",
  Pizzas: "🍕",
  Bebidas: "🥤",
  Lanches: "🍔",
  Sobremesas: "🍰",
  Entradas: "🥗",
  Massas: "🍝",
  Carnes: "🥩",
  Outros: "🏷️",
};

const EMPTY_FORM: ProductPayload & { imageFile?: File; imagePreview?: string } =
  {
    name: "",
    description: "",
    price: 0,
    category: "Geral",
    active: true,
    allows_half: false,
    size_type: "none",
  };

export default function ProductsScreen() {
  const { store } = useStore();
  const navigate = useNavigate();
  const {
    products,
    categories,
    loading,
    saving,
    createProduct,
    updateProduct,
    toggleActive,
    deleteProduct,
  } = useProducts(store?.id ?? null);

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("Todos");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setErrors({});
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      category: p.category,
      active: p.active,
      allows_half: (p as any).allows_half ?? false,
      size_type: (p as any).size_type ?? "none",
    });
    setErrors({});
    setShowModal(true);
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setForm((f) => ({ ...f, imageFile: file, imagePreview: preview }));
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Informe o nome";
    if (form.price <= 0) e.price = "Preço deve ser maior que zero";
    if (!form.category.trim()) e.category = "Escolha uma categoria";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    try {
      const payload: ProductPayload = {
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        price: Number(form.price),
        category: form.category,
        active: form.active,
        allows_half: (form as any).allows_half ?? false,
        size_type: (form as any).size_type ?? "none",
      };
      if (editing) {
        await updateProduct(editing.id, payload, form.imageFile);
        showToast("Produto atualizado!");
      } else {
        await createProduct(payload, form.imageFile);
        showToast("Produto criado!");
      }
      setShowModal(false);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteProduct(id);
      showToast("Produto removido");
      setDeleteConfirm(null);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  const allCategories = ["Todos", ...categories];

  const filtered = products.filter((p) => {
    const matchSearch =
      !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = catFilter === "Todos" || p.category === catFilter;
    return matchSearch && matchCat;
  });

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
      <div style={{ background: colors.noite, padding: "16px 20px 16px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 12,
          }}
        >
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            Meus Produtos
          </p>
          <button
            onClick={openCreate}
            style={{
              background: colors.rosa,
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            + Novo
          </button>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Buscar produto..."
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.08)",
            border: "none",
            borderRadius: 10,
            padding: "9px 12px",
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
            outline: "none",
          }}
        />
      </div>

      {/* Filtro de categorias */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "12px 16px",
          overflowX: "auto",
        }}
      >
        {allCategories.map((cat) => (
          <button
            key={cat}
            onClick={() => setCatFilter(cat)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "none",
              whiteSpace: "nowrap",
              background: catFilter === cat ? colors.rosa : colors.lilasClaro,
              color: catFilter === cat ? "#fff" : colors.noite,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              flexShrink: 0,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {EMOJI_CATEGORIES[cat] ?? ""} {cat}
          </button>
        ))}
      </div>

      {/* Info */}
      <p style={{ fontSize: 11, color: "#aaa", padding: "0 16px 8px" }}>
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""}
        {catFilter !== "Todos" ? ` em ${catFilter}` : " no total"}
      </p>

      {/* Lista */}
      <div
        style={{
          padding: "0 16px",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {loading && (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner color={colors.rosa} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>📦</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum produto aqui
            </p>
            <button
              onClick={openCreate}
              style={{
                marginTop: 12,
                padding: "9px 20px",
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
              Criar primeiro produto
            </button>
          </div>
        )}

        {filtered.map((p) => (
          <div
            key={p.id}
            style={{
              background: "#fff",
              borderRadius: 13,
              border: `1px solid ${colors.bordaLilas}`,
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 12px",
              opacity: p.active ? 1 : 0.55,
            }}
          >
            {/* Imagem ou emoji */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: colors.lilasClaro,
                flexShrink: 0,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
              }}
            >
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                (EMOJI_CATEGORIES[p.category] ?? "📦")
              )}
            </div>

            {/* Info */}
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
                {p.name}
              </p>
              <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                {p.category} · {p.active ? "✅ ativo" : "⏸ inativo"}
              </p>
            </div>

            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.rosa,
                flexShrink: 0,
              }}
            >
              R${Number(p.price).toFixed(2)}
            </p>

            {/* Ações */}
            <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
              <button
                onClick={() => toggleActive(p.id, !p.active)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: p.active ? "#f0fdf4" : "#f5eeff",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                title={p.active ? "Desativar" : "Ativar"}
              >
                {p.active ? "✅" : "⏸"}
              </button>
              <button
                onClick={() => openEdit(p)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: colors.lilasClaro,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✏️
              </button>
              <button
                onClick={() => setDeleteConfirm(p.id)}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  border: "none",
                  cursor: "pointer",
                  background: "#fff0f3",
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ── Modal de criar/editar ── */}
      {showModal && (
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
              padding: "20px 20px 36px",
              maxHeight: "90dvh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 20,
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>
                {editing ? "Editar produto" : "Novo produto"}
              </p>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#aaa",
                }}
              >
                ✕
              </button>
            </div>

            {/* Upload de imagem */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                height: 100,
                borderRadius: 12,
                border: `1.5px dashed ${colors.bordaLilas}`,
                background: "#fff",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                marginBottom: 16,
                overflow: "hidden",
              }}
            >
              {form.imagePreview ? (
                <img
                  src={form.imagePreview}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : editing?.image_url ? (
                <img
                  src={editing.image_url}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <>
                  <span style={{ fontSize: 24 }}>📷</span>
                  <span style={{ fontSize: 11, color: "#aaa" }}>
                    Toque para adicionar foto
                  </span>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleImageChange}
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input
                label="Nome do produto"
                placeholder="Ex: Pizza Calabresa G"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                error={errors.name}
              />

              <div style={{ display: "flex", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <Input
                    label="Preço (R$)"
                    type="number"
                    placeholder="0,00"
                    value={form.price || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, price: Number(e.target.value) }))
                    }
                    error={errors.price}
                  />
                </div>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: colors.noite,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    style={{
                      background: "#fff",
                      border: `1.5px solid ${colors.bordaLilas}`,
                      borderRadius: 11,
                      padding: "11px 10px",
                      fontSize: 13,
                      color: colors.noite,
                      fontFamily: "'Space Grotesk', sans-serif",
                      outline: "none",
                    }}
                  >
                    {Object.keys(EMOJI_CATEGORIES).map((c) => (
                      <option key={c} value={c}>
                        {EMOJI_CATEGORIES[c]} {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <label
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.noite,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Descrição (opcional)
                </label>
                <textarea
                  placeholder="Ingredientes, tamanho, detalhes..."
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  rows={3}
                  style={{
                    background: "#fff",
                    border: `1.5px solid ${colors.bordaLilas}`,
                    borderRadius: 11,
                    padding: "10px 12px",
                    fontSize: 13,
                    color: colors.noite,
                    fontFamily: "'Space Grotesk', sans-serif",
                    resize: "none",
                    outline: "none",
                  }}
                />
              </div>

              {/* ── Tipo de tamanho ── */}
              <div
                style={{
                  background: "#fff",
                  borderRadius: 11,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "10px 14px",
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
                  Tamanhos
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { val: "none", label: "❌ Sem tamanho" },
                    { val: "sizes", label: "📐 Com tamanhos" },
                  ].map((opt) => (
                    <div
                      key={opt.val}
                      onClick={() =>
                        setForm((f) => ({ ...f, size_type: opt.val }) as any)
                      }
                      style={{
                        flex: 1,
                        padding: "8px",
                        borderRadius: 9,
                        border: `1.5px solid ${(form as any).size_type === opt.val ? colors.rosa : colors.bordaLilas}`,
                        background:
                          (form as any).size_type === opt.val
                            ? "#fff0f8"
                            : "#fafafa",
                        cursor: "pointer",
                        textAlign: "center",
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          (form as any).size_type === opt.val
                            ? colors.rosa
                            : "#888",
                      }}
                    >
                      {opt.label}
                    </div>
                  ))}
                </div>
                {(form as any).size_type === "sizes" && editing && (
                  <button
                    onClick={() => {
                      const pid = editing?.id;
                      setShowModal(false);
                      if (pid) navigate(`/store/product-sizes/${pid}`);
                    }}
                    style={{
                      marginTop: 8,
                      width: "100%",
                      padding: "8px",
                      borderRadius: 9,
                      background: colors.lilasClaro,
                      border: "none",
                      color: "#7e22ce",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    ⚙️ Definir preços por tamanho →
                  </button>
                )}
                {(form as any).size_type === "sizes" && !editing && (
                  <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
                    💡 Salve o produto primeiro para definir preços por tamanho.
                  </p>
                )}
              </div>

              {/* ── Meia pizza ── */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff",
                  borderRadius: 11,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "10px 14px",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.noite,
                    }}
                  >
                    🍕 Permite meia pizza
                  </p>
                  <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    Cliente pode escolher dois sabores
                  </p>
                </div>
                <div
                  onClick={() =>
                    setForm(
                      (f) =>
                        ({ ...f, allows_half: !(f as any).allows_half }) as any,
                    )
                  }
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    background: (form as any).allows_half
                      ? colors.rosa
                      : "#d1d5db",
                    position: "relative",
                    cursor: "pointer",
                    transition: "background 0.2s",
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: (form as any).allows_half ? 20 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>

              {/* Toggle ativo */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#fff",
                  borderRadius: 11,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "10px 14px",
                }}
              >
                <p
                  style={{ fontSize: 13, fontWeight: 600, color: colors.noite }}
                >
                  Produto ativo
                </p>
                <div
                  onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
                  style={{
                    width: 40,
                    height: 22,
                    borderRadius: 11,
                    cursor: "pointer",
                    background: form.active ? colors.rosa : "#d1d5db",
                    position: "relative",
                    transition: "background 0.2s",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 3,
                      left: form.active ? 20 : 3,
                      width: 16,
                      height: 16,
                      borderRadius: "50%",
                      background: "#fff",
                      transition: "left 0.2s",
                    }}
                  />
                </div>
              </div>

              <Button
                variant="primary"
                fullWidth
                loading={saving}
                onClick={handleSave}
                style={{ marginTop: 4 }}
              >
                {editing ? "Salvar alterações" : "Criar produto"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal de confirmação de exclusão ── */}
      {deleteConfirm && (
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
              Remover produto?
            </p>
            <p
              style={{
                fontSize: 13,
                color: "#888",
                marginBottom: 20,
                lineHeight: 1.5,
              }}
            >
              Esta ação não pode ser desfeita. O produto será removido do
              cardápio.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setDeleteConfirm(null)}
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
                onClick={() => handleDelete(deleteConfirm)}
                style={{
                  flex: 1,
                  padding: "11px",
                  borderRadius: 10,
                  border: "none",
                  background: "#ef4444",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="products" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
