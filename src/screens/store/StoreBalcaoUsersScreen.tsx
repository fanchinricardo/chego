import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Spinner, Input, Button, Toast } from "../../components/ui";
import Swal from "sweetalert2";

interface BalcaoUser {
  id: string;
  full_name: string;
  email: string;
  active: boolean;
}

export default function StoreBalcaoUsersScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const [users, setUsers] = useState<BalcaoUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [form, setForm] = useState({ full_name: "", email: "", password: "" });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchUsers = useCallback(async () => {
    if (!store?.id) return;
    console.log("[Balcao] store.id:", store.id);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, active")
      .eq("role", "balcao")
      .eq("store_id", store.id)
      .order("full_name");
    console.log("[Balcao] data:", data, "error:", error);
    setUsers((data ?? []) as BalcaoUser[]);
    setLoading(false);
  }, [store?.id]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleCreate() {
    if (!form.full_name.trim()) {
      showToast("Informe o nome", "error");
      return;
    }
    if (!form.email.trim()) {
      showToast("Informe o e-mail", "error");
      return;
    }
    if (!form.password.trim() || form.password.length < 6) {
      showToast("Senha mínima de 6 caracteres", "error");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-balcao-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ ...form, store_id: store!.id }),
        },
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao criar usuário");
      showToast("Usuário criado!");
      setForm({ full_name: "", email: "", password: "" });
      setShowForm(false);
      await fetchUsers();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(user: BalcaoUser) {
    await supabase
      .from("profiles")
      .update({ active: !user.active })
      .eq("id", user.id);
    await fetchUsers();
  }

  async function handleDelete(user: BalcaoUser) {
    const { isConfirmed } = await Swal.fire({
      title: `Remover ${user.full_name}?`,
      text: "O usuário perderá acesso ao sistema.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    });
    if (!isConfirmed) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-staff`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ user_id: user.id }),
      },
    );
    await fetchUsers();
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 32,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              onClick={() => navigate(-1)}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.6)",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              ←
            </button>
            <div>
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 20,
                  color: "#fff",
                }}
              >
                🏪 Usuários Balcão
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 2,
                }}
              >
                Acesso ao caixa e balcão
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowForm((v) => !v)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              background: showForm ? "rgba(255,255,255,0.1)" : colors.rosa,
              color: "#fff",
              border: "none",
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

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px" }}>
        {/* Formulário */}
        {showForm && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
              marginBottom: 16,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Novo usuário balcão
            </p>
            <Input
              label="Nome completo *"
              placeholder="Ex: João Silva"
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
            <Input
              label="E-mail *"
              placeholder="joao@email.com"
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
            />
            <Input
              label="Senha *"
              placeholder="Mínimo 6 caracteres"
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
            <div
              style={{
                background: colors.lilasClaro,
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <p style={{ fontSize: 12, color: "#7e22ce", fontWeight: 600 }}>
                ℹ️ Este usuário terá acesso apenas a:
              </p>
              <p style={{ fontSize: 11, color: "#888", marginTop: 4 }}>
                • Tela de Caixa (fechamento de mesas)
              </p>
              <p style={{ fontSize: 11, color: "#888" }}>
                • Tela de Balcão (venda avulsa)
              </p>
              <p style={{ fontSize: 11, color: "#888" }}>
                • Criação de rotas de entrega
              </p>
            </div>
            <Button
              variant="primary"
              fullWidth
              loading={saving}
              onClick={handleCreate}
            >
              Criar usuário
            </Button>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : users.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>🏪</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum usuário balcão
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Crie usuários para sua equipe de caixa.
            </p>
          </div>
        ) : (
          users.map((user) => (
            <div
              key={user.id}
              style={{
                background: "#fff",
                borderRadius: 12,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "12px 14px",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  background: user.active ? colors.lilasClaro : "#f0f0f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: 18 }}>👤</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}
                >
                  {user.full_name}
                </p>
                <p style={{ fontSize: 11, color: "#aaa" }}>{user.email}</p>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: user.active ? "#f0fdf4" : "#f5f5f5",
                    color: user.active ? "#15803d" : "#888",
                    borderRadius: 8,
                    padding: "2px 8px",
                  }}
                >
                  {user.active ? "✅ Ativo" : "⏸ Inativo"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleToggle(user)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${colors.bordaLilas}`,
                    background: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: user.active ? "#b45309" : "#15803d",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {user.active ? "Pausar" : "Ativar"}
                </button>
                <button
                  onClick={() => handleDelete(user)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: 8,
                    border: `1px solid ${colors.rosa}`,
                    background: "#fff0f3",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: colors.rosa,
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
