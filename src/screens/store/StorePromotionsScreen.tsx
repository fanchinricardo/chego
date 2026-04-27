import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "../store/StoreDashboard";
import Swal from "sweetalert2";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discount: number | null;
  valid_until: string;
  active: boolean;
  created_at: string;
}

const EMPTY = { title: "", description: "", discount: "", valid_until: "" };

export default function StorePromotionsScreen() {
  const { store } = useStore();
  const storeId = store?.id ?? null;

  const [promos, setPromos] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchPromos = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("promotions")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false });
    setPromos((data ?? []) as Promotion[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchPromos();
  }, [fetchPromos]);

  async function handleSave() {
    if (!form.title.trim()) {
      showToast("Informe o título da promoção", "error");
      return;
    }
    if (!form.valid_until) {
      showToast("Informe a validade", "error");
      return;
    }
    if (new Date(form.valid_until) <= new Date()) {
      showToast("A validade deve ser uma data futura", "error");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("promotions").insert({
        store_id: storeId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        discount: form.discount ? Number(form.discount) : null,
        valid_until: new Date(form.valid_until).toISOString(),
        active: true,
      });
      if (error) throw new Error(error.message);
      showToast("Promoção criada!");
      setForm(EMPTY);
      setShowForm(false);
      await fetchPromos();

      // Pergunta se quer notificar clientes
      const { isConfirmed } = await Swal.fire({
        title: "📣 Notificar clientes?",
        html: `<p>Deseja enviar WhatsApp para todos os clientes que já compraram em <strong>${store?.name}</strong>?</p>`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "📲 Enviar WhatsApp",
        cancelButtonText: "Agora não",
        confirmButtonColor: "#22c55e",
      });
      if (isConfirmed)
        await sendWhatsApp(
          form.title.trim(),
          form.description.trim(),
          form.valid_until,
        );
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function sendWhatsApp(
    title: string,
    description: string,
    validUntil: string,
  ) {
    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const url = `${SUPABASE_URL}/functions/v1/notify-promotion`;
      console.log("[Promoção] Chamando:", url);
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({
          store_id: storeId,
          store_name: store?.name,
          title,
          description,
          valid_until: validUntil,
        }),
      });
      const data = await res.json();
      console.log("[Promoção] Resposta:", res.status, data);
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar");
      showToast(`✅ ${data.sent ?? 0} clientes notificados!`);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  async function toggleActive(promo: Promotion) {
    await supabase
      .from("promotions")
      .update({ active: !promo.active })
      .eq("id", promo.id);
    await fetchPromos();
  }

  async function handleDelete(id: string) {
    const { isConfirmed } = await Swal.fire({
      title: "Excluir promoção?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#ef4444",
    });
    if (!isConfirmed) return;
    await supabase.from("promotions").delete().eq("id", id);
    await fetchPromos();
  }

  function isExpired(validUntil: string) {
    return new Date(validUntil) < new Date();
  }

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // Data mínima para o input datetime-local (agora + 1 hora)
  const minDate = new Date(Date.now() + 3600000).toISOString().slice(0, 16);

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
      <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
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
                  fontFamily: "'Righteous', cursive",
                  fontSize: 22,
                  color: "#fff",
                }}
              >
                🎉 Promoções
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 2,
                }}
              >
                Crie e notifique seus clientes
              </p>
            </div>
            <button
              onClick={() => setShowForm((v) => !v)}
              style={{
                padding: "8px 16px",
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
              {showForm ? "Cancelar" : "+ Nova"}
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
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nova promoção
            </p>

            <Input
              label="Título *"
              placeholder="Ex: 20% de desconto em pizzas!"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.noite,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Descrição (opcional)
              </label>
              <textarea
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Detalhes da promoção..."
                rows={3}
                style={{
                  background: "#fff",
                  border: `1.5px solid ${colors.bordaLilas}`,
                  borderRadius: 11,
                  padding: "9px 12px",
                  fontSize: 13,
                  color: colors.noite,
                  fontFamily: "'Space Grotesk', sans-serif",
                  resize: "none",
                  outline: "none",
                }}
              />
            </div>

            <Input
              label="Desconto % (opcional)"
              placeholder="Ex: 20"
              value={form.discount}
              type="number"
              onChange={(e) =>
                setForm((f) => ({ ...f, discount: e.target.value }))
              }
            />

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.noite,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Válido até *
              </label>
              <input
                type="datetime-local"
                min={minDate}
                value={form.valid_until}
                onChange={(e) =>
                  setForm((f) => ({ ...f, valid_until: e.target.value }))
                }
                style={{
                  background: "#fff",
                  border: `1.5px solid ${colors.bordaLilas}`,
                  borderRadius: 11,
                  padding: "10px 12px",
                  fontSize: 13,
                  color: colors.noite,
                  fontFamily: "'Space Grotesk', sans-serif",
                  outline: "none",
                }}
              />
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={saving}
              onClick={handleSave}
            >
              Criar e notificar clientes
            </Button>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : promos.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 10 }}>🎉</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhuma promoção criada
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Crie uma promoção e notifique seus clientes!
            </p>
          </div>
        ) : (
          promos.map((promo) => {
            const expired = isExpired(promo.valid_until);
            const inactive = !promo.active || expired;
            return (
              <div
                key={promo.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1.5px solid ${inactive ? colors.bordaLilas : colors.rosa}`,
                  padding: "14px",
                  opacity: inactive ? 0.7 : 1,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "flex-start", gap: 10 }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        marginBottom: 4,
                      }}
                    >
                      {promo.discount && (
                        <span
                          style={{
                            background: colors.rosa,
                            color: "#fff",
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 7px",
                          }}
                        >
                          -{promo.discount}%
                        </span>
                      )}
                      {expired && (
                        <span
                          style={{
                            background: "#f5f5f5",
                            color: "#888",
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 7px",
                          }}
                        >
                          Expirada
                        </span>
                      )}
                      {!expired && !promo.active && (
                        <span
                          style={{
                            background: "#fff8e6",
                            color: "#b45309",
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 7px",
                          }}
                        >
                          Inativa
                        </span>
                      )}
                      {!expired && promo.active && (
                        <span
                          style={{
                            background: "#f0fdf4",
                            color: "#15803d",
                            fontSize: 10,
                            fontWeight: 700,
                            borderRadius: 6,
                            padding: "2px 7px",
                          }}
                        >
                          ✅ Ativa
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      {promo.title}
                    </p>
                    {promo.description && (
                      <p style={{ fontSize: 12, color: "#888", marginTop: 3 }}>
                        {promo.description}
                      </p>
                    )}
                    <p style={{ fontSize: 11, color: "#aaa", marginTop: 6 }}>
                      Válido até {fmtDate(promo.valid_until)}
                    </p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  {!expired && (
                    <button
                      onClick={() => toggleActive(promo)}
                      style={{
                        flex: 1,
                        padding: "7px",
                        borderRadius: 8,
                        background: promo.active ? "#fff8e6" : "#f0fdf4",
                        border: `1px solid ${promo.active ? "#fcd34d" : "#86efac"}`,
                        color: promo.active ? "#b45309" : "#15803d",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {promo.active ? "⏸ Pausar" : "▶ Ativar"}
                    </button>
                  )}
                  {!expired && promo.active && (
                    <button
                      onClick={() =>
                        sendWhatsApp(
                          promo.title,
                          promo.description ?? "",
                          promo.valid_until,
                        )
                      }
                      disabled={sending}
                      style={{
                        flex: 1,
                        padding: "7px",
                        borderRadius: 8,
                        background: "#f0fdf4",
                        border: "1px solid #86efac",
                        color: "#15803d",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {sending ? "..." : "📲 Reenviar"}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(promo.id)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 8,
                      background: "#fff0f3",
                      border: `1px solid ${colors.rosa}`,
                      color: colors.rosa,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sending && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              padding: "24px 32px",
              textAlign: "center",
            }}
          >
            <Spinner color={colors.rosa} />
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.noite,
                marginTop: 12,
              }}
            >
              Enviando notificações...
            </p>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} type={toastType} />}
      <BottomNav active="profile" storeActive={store?.active ?? false} />
    </div>
  );
}
