import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";

interface Motoboy {
  id: string;
  vehicle_plate: string | null;
  active: boolean;
  created_at: string;
  profiles: { full_name: string; phone: string | null };
}

export default function StoreMotoboyScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [motoboys, setMotoboys] = useState<Motoboy[]>([]);
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
    vehicle_plate: "",
  });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchMotoboys = useCallback(async () => {
    if (!store) return;
    setLoading(true);

    const { data } = await supabase
      .from("motoboys")
      .select("*, profiles(full_name, phone)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });

    setMotoboys((data ?? []) as Motoboy[]);
    setLoading(false);
  }, [store]);

  useEffect(() => {
    fetchMotoboys();
  }, [fetchMotoboys]);

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
      const { data, error } = await supabase.functions.invoke(
        "create-motoboy",
        {
          body: {
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
            email: form.email.trim().toLowerCase(),
            password: form.password,
            vehicle_plate: form.vehicle_plate.trim() || null,
            store_id: store.id,
          },
        },
      );

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      showToast("Motoboy cadastrado com sucesso!");
      setForm({
        full_name: "",
        phone: "",
        email: "",
        password: "",
        vehicle_plate: "",
      });
      setShowForm(false);
      fetchMotoboys();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(motoboy: Motoboy) {
    await supabase
      .from("motoboys")
      .update({ active: !motoboy.active })
      .eq("id", motoboy.id);

    setMotoboys((prev) =>
      prev.map((m) => (m.id === motoboy.id ? { ...m, active: !m.active } : m)),
    );
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
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
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
            <p
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
                marginBottom: 2,
              }}
            >
              Meus Motoboys
            </p>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
              {motoboys.filter((m) => m.active).length} ativo
              {motoboys.filter((m) => m.active).length !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => setShowForm((f) => !f)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              background: showForm ? colors.lilasClaro : colors.rosa,
              color: showForm ? "#7e22ce" : "#fff",
              border: "none",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {showForm ? "Cancelar" : "+ Cadastrar"}
          </button>
        </div>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Formulário de cadastro */}
        {showForm && (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 4,
              }}
            >
              Novo motoboy
            </p>

            <Input
              label="Nome completo *"
              placeholder="João da Silva"
              value={form.full_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, full_name: e.target.value }))
              }
            />
            <Input
              label="Telefone / WhatsApp"
              placeholder="+55 11 99999-9999"
              value={form.phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, phone: e.target.value }))
              }
              type="tel"
            />
            <Input
              label="Placa do veículo"
              placeholder="ABC-1234"
              value={form.vehicle_plate}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  vehicle_plate: e.target.value.toUpperCase(),
                }))
              }
              maxLength={8}
            />

            <div style={{ height: 1, background: colors.bordaLilas }} />
            <p style={{ fontSize: 11, color: "#aaa" }}>
              O motoboy usará as credenciais abaixo para acessar o app:
            </p>

            <Input
              label="E-mail de acesso *"
              placeholder="joao@email.com"
              value={form.email}
              onChange={(e) =>
                setForm((f) => ({ ...f, email: e.target.value }))
              }
              type="email"
              autoComplete="off"
            />
            <Input
              label="Senha inicial *"
              placeholder="Mínimo 6 caracteres"
              value={form.password}
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
              type="password"
              autoComplete="new-password"
            />

            <div
              style={{
                background: "#fff8e6",
                border: "1px solid #fcd34d",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
                💡 Informe o e-mail e a senha ao motoboy. Ele pode trocar a
                senha depois pelo app.
              </p>
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={saving}
              onClick={handleCreate}
            >
              Cadastrar motoboy
            </Button>
          </div>
        )}

        {/* Lista de motoboys */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : motoboys.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 10 }}>🏍️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum motoboy cadastrado
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 6 }}>
              Cadastre seu primeiro motoboy usando o botão acima
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {motoboys.map((motoboy) => (
              <div
                key={motoboy.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1.5px solid ${motoboy.active ? colors.bordaLilas : "#e5e7eb"}`,
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: motoboy.active ? 1 : 0.6,
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: motoboy.active ? colors.rosa : "#9ca3af",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Righteous', cursive",
                    fontSize: 16,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {motoboy.profiles?.full_name?.slice(0, 1).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {motoboy.profiles?.full_name}
                  </p>
                  <p style={{ fontSize: 10, color: "#888", marginTop: 1 }}>
                    🏍️ {motoboy.vehicle_plate ?? "Placa não cadastrada"}
                    {motoboy.profiles?.phone
                      ? ` · ${motoboy.profiles.phone}`
                      : ""}
                  </p>
                  <div style={{ marginTop: 4 }}>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        background: motoboy.active ? "#f0fdf4" : "#f3f4f6",
                        color: motoboy.active ? "#15803d" : "#6b7280",
                      }}
                    >
                      {motoboy.active ? "● Ativo" : "● Inativo"}
                    </span>
                  </div>
                </div>

                {/* Toggle ativo/inativo */}
                <button
                  onClick={() => toggleActive(motoboy)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 9,
                    background: motoboy.active ? "#fff0f3" : "#f0fdf4",
                    border: `1px solid ${motoboy.active ? "#fca5a5" : "#86efac"}`,
                    color: motoboy.active ? colors.rosa : "#15803d",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                    flexShrink: 0,
                  }}
                >
                  {motoboy.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav active="profile" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
