import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../../hooks/useStore";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";
import { LocationPicker } from "../../components/LocationPicker";

export default function StoreProfileScreen() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { store, loading, updateStore } = useStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    description: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    min_order_value: 0,
    delivery_fee: 0,
    estimated_time: 30,
  });
  const [showMap, setShowMap] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  function startEdit() {
    if (!store) return;
    setForm({
      name: store.name ?? "",
      phone: store.phone ?? "",
      whatsapp: store.whatsapp ?? "",
      description: store.description ?? "",
      address: store.address ?? "",
      city: store.city ?? "",
      state: store.state ?? "",
      zip_code: store.zip_code ?? "",
      min_order_value: store.min_order_value ?? 0,
      delivery_fee: store.delivery_fee ?? 0,
      estimated_time: store.estimated_time ?? 30,
    });
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await updateStore({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        description: form.description.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        zip_code: form.zip_code.replace(/\D/g, ""),
        min_order_value: Number(form.min_order_value),
        delivery_fee: Number(form.delivery_fee),
        estimated_time: Number(form.estimated_time),
      });
      showToast("Dados salvos!");
      setEditing(false);
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLocationConfirm(lat: number, lng: number) {
    try {
      await updateStore({ lat, lng });
      showToast("Localização salva!");
    } catch (e: any) {
      showToast(e.message, "error");
    }
    setShowMap(false);
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  if (loading)
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

  const initials = store?.name?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Header / Hero */}
      <div
        style={{
          background: colors.noite,
          padding: "20px 20px 28px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: colors.rosa,
            margin: "0 auto 10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Righteous', cursive",
            fontSize: 24,
            color: "#fff",
            overflow: "hidden",
          }}
        >
          {store?.logo_url ? (
            <img
              src={store.logo_url}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            initials
          )}
        </div>
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          {store?.name ?? "—"}
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {store?.store_groups?.icon} {store?.store_groups?.name} ·{" "}
          {store?.city}
        </p>

        {/* Métricas */}
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 16,
            justifyContent: "center",
          }}
        >
          {[
            { label: "Pedidos", value: "—", color: colors.rosa },
            { label: "Avaliação", value: "—", color: "#22c55e" },
            { label: "Este mês", value: "—", color: "#fff" },
          ].map((m) => (
            <div
              key={m.label}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "8px 16px",
                textAlign: "center",
                flex: 1,
              }}
            >
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 18,
                  color: m.color,
                  lineHeight: 1,
                }}
              >
                {m.value}
              </p>
              <p
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.3)",
                  marginTop: 3,
                }}
              >
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Editar dados */}
      {!editing ? (
        <div style={{ padding: "16px" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.bordaLilas}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Dados da loja
              </p>
              <button
                onClick={startEdit}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.rosa,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Editar
              </button>
            </div>
            {[
              { label: "Nome", value: store?.name },
              { label: "Telefone", value: store?.phone ?? "—" },
              { label: "WhatsApp", value: store?.whatsapp ?? "—" },
              { label: "Endereço", value: store?.address },
              {
                label: "Pedido mínimo",
                value: `R$ ${Number(store?.min_order_value ?? 0).toFixed(2)}`,
              },
              {
                label: "Taxa de entrega",
                value: `R$ ${Number(store?.delivery_fee ?? 0).toFixed(2)}`,
              },
              {
                label: "Tempo estimado",
                value: `${store?.estimated_time ?? "—"} min`,
              },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  padding: "10px 16px",
                  borderBottom: `1px solid ${colors.fundo}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <p style={{ fontSize: 12, color: "#aaa" }}>{row.label}</p>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.noite,
                    textAlign: "right",
                    maxWidth: "60%",
                  }}
                >
                  {row.value}
                </p>
              </div>
            ))}
          </div>

          {/* Menu de configurações */}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
              marginBottom: 12,
            }}
          >
            {[
              {
                icon: "🕐",
                label: "Horário de funcionamento",
                path: "/store/schedule",
              },
              { icon: "💳", label: "Mercado Pago", path: "/store/mp-config" },
              {
                icon: "💰",
                label: "Faturamento e faturas",
                path: "/store/billing",
              },
              {
                icon: "📐",
                label: "Tamanhos de produto",
                path: "/store/sizes",
              },
              { icon: "🏍️", label: "Meus motoboys", path: "/store/motoboys" },
              {
                icon: "📧",
                label: "Alterar e-mail",
                path: "/store/change-email",
              },
              {
                icon: "🔔",
                label: "Notificações",
                path: "/store/notifications",
              },
            ].map((item, i, arr) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderBottom:
                    i < arr.length - 1 ? `1px solid ${colors.fundo}` : "none",
                  fontFamily: "'Space Grotesk', sans-serif",
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
                    fontSize: 15,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.noite,
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  {item.label}
                </p>
                <p style={{ fontSize: 14, color: "#aaa" }}>›</p>
              </button>
            ))}
          </div>

          {/* Sair */}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 13,
              background: "#fff0f3",
              border: `1px solid ${colors.bordaLilas}`,
              color: colors.rosa,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            🚪 Sair da conta
          </button>
        </div>
      ) : (
        /* Formulário de edição */
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <Input
            label="Nome da loja"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Input
            label="Telefone"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            type="tel"
          />
          <Input
            label="WhatsApp (com DDI)"
            value={form.whatsapp}
            onChange={(e) =>
              setForm((f) => ({ ...f, whatsapp: e.target.value }))
            }
            placeholder="+5511999999999"
          />

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
              Descrição
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              rows={3}
              placeholder="Conte um pouco sobre sua loja..."
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

          <div style={{ display: "flex", gap: 10 }}>
            <Input
              label="Pedido mínimo (R$)"
              type="number"
              value={form.min_order_value}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  min_order_value: Number(e.target.value),
                }))
              }
            />
            <Input
              label="Taxa entrega (R$)"
              type="number"
              value={form.delivery_fee}
              onChange={(e) =>
                setForm((f) => ({ ...f, delivery_fee: Number(e.target.value) }))
              }
            />
          </div>
          <Input
            label="Tempo estimado (min)"
            type="number"
            value={form.estimated_time}
            onChange={(e) =>
              setForm((f) => ({ ...f, estimated_time: Number(e.target.value) }))
            }
          />

          <div
            style={{
              height: 1,
              background: colors.bordaLilas,
              margin: "4px 0",
            }}
          />
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Endereço
          </p>
          <Input
            label="Rua e número"
            value={form.address}
            onChange={(e) =>
              setForm((f) => ({ ...f, address: e.target.value }))
            }
            placeholder="Rua das Flores, 142"
          />
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 2 }}>
              <Input
                label="Cidade"
                value={form.city}
                onChange={(e) =>
                  setForm((f) => ({ ...f, city: e.target.value }))
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="UF"
                value={form.state}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    state: e.target.value.toUpperCase().slice(0, 2),
                  }))
                }
                maxLength={2}
              />
            </div>
          </div>
          <Input
            label="CEP"
            value={form.zip_code}
            onChange={(e) =>
              setForm((f) => ({ ...f, zip_code: e.target.value }))
            }
            inputMode="numeric"
          />

          <button
            type="button"
            onClick={() => setShowMap(true)}
            style={{
              width: "100%",
              padding: "11px",
              borderRadius: 11,
              background: store?.lat ? "#f0fdf4" : colors.lilasClaro,
              border: `1px solid ${store?.lat ? "#86efac" : colors.bordaLilas}`,
              color: store?.lat ? "#15803d" : "#7e22ce",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {store?.lat
              ? `✅ Localização definida (${store.lat.toFixed(4)}, ${store.lng?.toFixed(4)})`
              : "📍 Marcar localização no mapa"}
          </button>

          <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
            <button
              onClick={() => setEditing(false)}
              style={{
                flex: 1,
                padding: "12px",
                borderRadius: 12,
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
              onClick={handleSave}
              disabled={saving}
              style={{
                flex: 2,
                padding: "12px",
                borderRadius: 12,
                border: "none",
                background: colors.rosa,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      )}

      {showMap && (
        <LocationPicker
          lat={store?.lat}
          lng={store?.lng}
          onConfirm={handleLocationConfirm}
          onClose={() => setShowMap(false)}
        />
      )}

      <BottomNav active="profile" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
