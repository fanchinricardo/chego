import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { useProducts } from "../../hooks/useProducts";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";
import Swal from "sweetalert2";

interface KitchenUser {
  id: string;
  full_name: string;
  phone: string | null;
  created_at: string;
  kitchen_categories: string[] | null | undefined;
}

export default function StoreKitchenScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [users, setUsers] = useState<KitchenUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    categories: [] as string[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const { categories } = useProducts(store?.id ?? null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchUsers = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, created_at, kitchen_categories")
      .eq("role", "kitchen")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    setUsers((data ?? []) as KitchenUser[]);
    setLoading(false);
  }, [store]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate() {
    if (!store) return;
    if (!form.full_name.trim()) {
      showToast("Nome obrigatório", "error");
      return;
    }
    if (!form.email.trim()) {
      showToast("E-mail obrigatório", "error");
      return;
    }
    if (form.password.length < 6) {
      showToast("Senha mínima de 6 caracteres", "error");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-kitchen",
        {
          body: {
            full_name: form.full_name.trim(),
            email: form.email.trim().toLowerCase(),
            password: form.password,
            store_id: store.id,
            kitchen_categories: form.categories,
          },
        },
      );
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      showToast("Acesso da cozinha criado!");
      setForm({ full_name: "", email: "", password: "" });
      setShowForm(false);
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(userId: string) {
    const { isConfirmed } = await Swal.fire({
      title: "Remover acesso?",
      text: "Este usuário não conseguirá mais acessar a tela da cozinha.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e9181c",
    });
    if (!isConfirmed) return;
    try {
      const { data, error } = await supabase.functions.invoke("remove-staff", {
        body: { user_id: userId },
      });
      if (error || data?.error) throw new Error(error?.message ?? data?.error);
      showToast("Acesso removido");
      await fetchUsers();
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
      {/* Header */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 18px" }}
        >
          <button
            onClick={() => navigate(-1)}
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
                Cozinha
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                {users.length} acesso{users.length !== 1 ? "s" : ""} cadastrado
                {users.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() =>
                setShowForm((v) => {
                  if (!v) {
                    setForm({
                      full_name: "",
                      email: "",
                      password: "",
                      categories: [],
                    });
                    setEditingId(null);
                  }
                  return !v;
                })
              }
              style={{
                background: showForm ? "rgba(255,255,255,0.1)" : colors.rosa,
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "8px 16px",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {showForm ? "Cancelar" : "+ Novo"}
            </button>
          </div>
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
        {/* Formulário */}
        {showForm && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 14,
              }}
            >
              {editingId ? "Editar categorias" : "Novo acesso da cozinha"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {!editingId && (
                <>
                  <Input
                    label="Nome"
                    placeholder="Ex: Cozinha Principal"
                    value={form.full_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, full_name: e.target.value }))
                    }
                  />
                  <Input
                    label="E-mail"
                    placeholder="cozinha@email.com"
                    value={form.email}
                    type="email"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, email: e.target.value }))
                    }
                  />
                  <Input
                    label="Senha"
                    placeholder="mínimo 6 caracteres"
                    value={form.password}
                    type="password"
                    onChange={(e) =>
                      setForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </>
              )}
              {/* Seleção de categorias */}
              <div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                  }}
                >
                  Categorias (deixe vazio para ver tudo)
                </p>
                {categories.length === 0 ? (
                  <p style={{ fontSize: 12, color: "#aaa" }}>
                    Nenhuma categoria encontrada
                  </p>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {categories.map((cat) => {
                      const selected = (form.categories ?? []).includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          onClick={() =>
                            setForm((f) => ({
                              ...f,
                              categories: selected
                                ? (f.categories ?? []).filter((c) => c !== cat)
                                : [...f.categories, cat],
                            }))
                          }
                          style={{
                            padding: "6px 14px",
                            borderRadius: 20,
                            background: selected
                              ? colors.rosa
                              : colors.lilasClaro,
                            color: selected ? "#fff" : "#7e22ce",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          {selected ? "✓ " : ""}
                          {cat}
                        </button>
                      );
                    })}
                  </div>
                )}
                {form.categories.length === 0 && (
                  <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
                    Sem filtro — verá todos os itens
                  </p>
                )}
              </div>
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                onClick={handleCreate}
              >
                Criar acesso
              </Button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : users.length === 0 && !showForm ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>👨‍🍳</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum acesso cadastrado
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Clique em "+ Novo" para criar um acesso para a cozinha
            </p>
          </div>
        ) : (
          users.map((u) => (
            <div
              key={u.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "12px 14px",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "50%",
                  background: colors.lilasClaro,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  flexShrink: 0,
                }}
              >
                👨‍🍳
              </div>
              <div style={{ flex: 1 }}>
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  {u.full_name}
                </p>
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {(u.kitchen_categories ?? []).length > 0
                    ? (u.kitchen_categories ?? []).join(", ")
                    : "Todas as categorias"}
                </p>
              </div>
              <button
                onClick={() => handleRemove(u.id)}
                style={{
                  background: "#fff0f3",
                  border: `1px solid ${colors.rosa}`,
                  borderRadius: 8,
                  padding: "5px 12px",
                  color: colors.rosa,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  flexShrink: 0,
                }}
              >
                Remover
              </button>
            </div>
          ))
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
            💡 A cozinha acessa pelo mesmo app com o e-mail e senha cadastrados.
            <br />
            ⚠️ Ao remover o acesso o funcionário perde o acesso imediatamente.
          </p>
        </div>
      </div>

      <BottomNav active="profile" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
