import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../hooks/useStore";
import { useProductSizes } from "../../hooks/useProductSizes";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

export default function StoreSizesScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const { sizes, loading, createSize, deleteSize } = useProductSizes(
    store?.id ?? null,
  );

  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleCreate() {
    if (!newName.trim()) {
      showToast("Digite o nome do tamanho", "error");
      return;
    }
    setSaving(true);
    try {
      await createSize(newName);
      setNewName("");
      showToast("Tamanho criado!");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover este tamanho?")) return;
    try {
      await deleteSize(id);
      showToast("Tamanho removido");
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

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
            Tamanhos
          </p>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.4)",
              marginTop: 2,
            }}
          >
            Ex: Pequena, Média, Grande — usados nos produtos
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
          gap: 12,
        }}
      >
        {/* Criar tamanho */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
            display: "flex",
            gap: 10,
            alignItems: "flex-end",
          }}
        >
          <div style={{ flex: 1 }}>
            <Input
              label="Nome do tamanho"
              placeholder="Ex: Pequena, Média, Grande..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>
          <Button
            variant="primary"
            loading={saving}
            onClick={handleCreate}
            style={{ marginBottom: 0 }}
          >
            + Adicionar
          </Button>
        </div>

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : sizes.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>📐</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum tamanho cadastrado
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Crie tamanhos para usar nos produtos (ex: pizzas, bebidas)
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sizes.map((s, i) => (
              <div
                key={s.id}
                style={{
                  background: "#fff",
                  borderRadius: 12,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: colors.lilasClaro,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Righteous', cursive",
                    fontSize: 14,
                    color: colors.rosa,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                <p
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: 600,
                    color: colors.noite,
                  }}
                >
                  {s.name}
                </p>
                <button
                  onClick={() => handleDelete(s.id)}
                  style={{
                    background: "#fff0f3",
                    border: "1px solid #fca5a5",
                    borderRadius: 8,
                    padding: "5px 12px",
                    color: colors.rosa,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div
          style={{
            background: colors.lilasClaro,
            borderRadius: 12,
            padding: "12px 14px",
          }}
        >
          <p style={{ fontSize: 12, color: "#7e22ce", lineHeight: 1.6 }}>
            💡 Após criar os tamanhos, vá em{" "}
            <strong>Produtos → editar produto</strong> para definir o preço de
            cada tamanho.
          </p>
        </div>
      </div>

      <BottomNav active="products" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
