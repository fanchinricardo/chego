import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

interface Waiter {
  id: string;
  store_id: string;
  active: boolean;
  created_at: string;
  profiles: { full_name: string; phone: string | null; email?: string };
}

export default function StoreWaiterScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [waiters, setWaiters] = useState<Waiter[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    password: "",
  });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchWaiters = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, phone, store_id, created_at")
      .eq("role", "waiter")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    // Adapta para formato compatível
    const list = (data ?? []).map((p: any) => ({
      id: p.id,
      store_id: p.store_id,
      active: true,
      created_at: p.created_at,
      profiles: { full_name: p.full_name, phone: p.phone },
    }));
    setWaiters(list);
    setLoading(false);
  }, [store]);

  useEffect(() => {
    fetchWaiters();
  }, [fetchWaiters]);

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
    if (!form.password.trim() || form.password.length < 6) {
      showToast("Senha mínima de 6 caracteres", "error");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-waiter", {
        body: {
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim().toLowerCase(),
          password: form.password,
          store_id: store.id,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      showToast("Garçom cadastrado com sucesso!");
      setForm({ full_name: "", phone: "", email: "", password: "" });
      setShowForm(false);
      await fetchWaiters();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(waiterId: string) {
    const { isConfirmed } = await Swal.fire({
      title: "Remover garçom?",
      text: "O garçom perderá o acesso ao aplicativo.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, remover",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e9181c",
    });
    if (!isConfirmed) return;
    try {
      const { data, error } = await supabase.functions.invoke("remove-staff", {
        body: { user_id: waiterId },
      });
      if (error || data?.error) throw new Error(error?.message ?? data?.error);
      showToast("Garçom removido");
      await fetchWaiters();
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
                Garçons
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                {waiters.length} cadastrado{waiters.length !== 1 ? "s" : ""}
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
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
              Novo garçom
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Input
                label="Nome completo"
                placeholder="João da Silva"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
              <Input
                label="Telefone (opcional)"
                placeholder="(11) 99999-9999"
                value={form.phone}
                type="tel"
                onChange={(e) =>
                  setForm((f) => ({ ...f, phone: e.target.value }))
                }
              />
              <Input
                label="E-mail"
                placeholder="garcom@email.com"
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
              <Button
                variant="primary"
                fullWidth
                loading={saving}
                onClick={handleCreate}
              >
                Cadastrar garçom
              </Button>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : waiters.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>🧑‍🍳</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum garçom cadastrado
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Clique em "+ Novo" para adicionar
            </p>
          </div>
        ) : (
          waiters.map((w) => (
            <div
              key={w.id}
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
              {/* Avatar */}
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
                🧑‍🍳
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  {w.profiles.full_name}
                </p>
                {w.profiles.phone && (
                  <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                    {w.profiles.phone}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleDeactivate(w.id)}
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
            💡 O garçom faz login com o e-mail e senha cadastrados aqui. No app
            ele verá apenas as mesas do seu estabelecimento.
          </p>
        </div>
      </div>

      <BottomNav active="profile" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
