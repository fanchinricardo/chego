import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Input, Button, StepBar, Toast } from "../../components/ui";
import { LocationPicker } from "../../components/LocationPicker";
import { geocodeAddress } from "../../hooks/routing";

interface StoreGroup {
  id: string;
  name: string;
  icon: string | null;
}

interface FormData {
  // Passo 0
  group_id: string;
  // Passo 1
  name: string;
  description: string;
  phone: string;
  whatsapp: string;
  // Passo 2
  address: string;
  city: string;
  state: string;
  zip_code: string;
  delivery_fee: string;
  min_order_value: string;
  estimated_time: string;
}

const EMPTY: FormData = {
  group_id: "",
  name: "",
  description: "",
  phone: "",
  whatsapp: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  delivery_fee: "0",
  min_order_value: "0",
  estimated_time: "45",
};

const STEP_TITLES = [
  { title: "Tipo de", accent: "comércio" },
  { title: "Dados da", accent: "loja" },
  { title: "Endereço e", accent: "entrega" },
];

export default function StoreSetupScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [form, setForm] = useState<FormData>({ ...EMPTY });
  const [showMap, setShowMap] = useState(false);
  const [pickedLat, setPickedLat] = useState<number | null>(null);
  const [pickedLng, setPickedLng] = useState<number | null>(null);
  const [groups, setGroups] = useState<StoreGroup[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  // Carrega grupos de comércio
  useEffect(() => {
    supabase
      .from("store_groups")
      .select("id, name, icon")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setGroups((data ?? []) as StoreGroup[]));
  }, []);

  function set(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: "" }));
  }

  function validateStep0(): boolean {
    if (!form.group_id) {
      setErrors({ group_id: "Selecione o tipo de comércio" });
      return false;
    }
    return true;
  }

  function validateStep1(): boolean {
    const e: Record<string, string> = {};

    if (!form.name.trim()) e.name = "Informe o nome da loja";
    else if (form.name.trim().length < 3)
      e.name = "Nome deve ter no mínimo 3 caracteres";

    const phoneDigits = form.phone.replace(/\D/g, "");
    if (!form.phone.trim()) e.phone = "Informe o telefone";
    else if (phoneDigits.length < 10) e.phone = "Informe o telefone com DDD";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Record<string, string> = {};

    if (!form.address.trim()) e.address = "Informe o endereço";
    else if (form.address.trim().length < 5) e.address = "Endereço muito curto";

    if (!form.city.trim()) e.city = "Informe a cidade";
    else if (form.city.trim().length < 2) e.city = "Cidade inválida";

    if (!form.state.trim()) e.state = "Informe o estado (UF)";
    else if (form.state.trim().length !== 2)
      e.state = "Use a sigla do estado (ex: SP)";

    const cepDigits = form.zip_code.replace(/\D/g, "");
    if (!form.zip_code.trim()) e.zip_code = "Informe o CEP";
    else if (cepDigits.length !== 8)
      e.zip_code = "CEP inválido (deve ter 8 dígitos)";

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep((s) => (s + 1) as 0 | 1 | 2);
  }

  async function handleSubmit() {
    if (!validateStep2()) return;
    if (!user) return;
    setSaving(true);

    try {
      let lat: number | null = pickedLat;
      let lng: number | null = pickedLng;

      try {
        if (!lat || !lng) {
          const geo = await geocodeAddress({
            address: form.address.trim(),
            city: form.city.trim(),
            state: form.state.trim().toUpperCase().slice(0, 2),
            zip_code: form.zip_code.replace(/\D/g, ""),
          });
          if (geo) {
            lat = geo.lat;
            lng = geo.lng;
          }
        }
      } catch {
        console.warn("Não foi possível geocodificar o endereço da loja");
      }

      const { error } = await supabase.from("stores").insert({
        owner_id: user.id,
        group_id: form.group_id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        zip_code: form.zip_code.replace(/\D/g, ""),
        delivery_fee: Number(form.delivery_fee) || 0,
        min_order_value: Number(form.min_order_value) || 0,
        estimated_time: Number(form.estimated_time) || 45,
        active: false,
        open_now: false,
        signup_paid: false,
      });

      if (error) throw new Error(error.message);

      // Cria fatura de adesão
      const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
      const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const { data: newStore } = await supabase
        .from("stores")
        .select("id")
        .eq("owner_id", user.id)
        .single();
      if (newStore) {
        await fetch(`${SUPABASE_URL}/functions/v1/store-billing`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            action: "create_signup_invoice",
            store_id: newStore.id,
          }),
        });
      }

      showToast("Loja cadastrada! Pague a taxa de adesão para ativar.");
      setTimeout(() => navigate("/store", { replace: true }), 1500);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const selectedGroup = groups.find((g) => g.id === form.group_id);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite }}>
        {step > 0 && (
          <button
            onClick={() => setStep((s) => (s - 1) as 0 | 1 | 2)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 12,
              padding: 0,
            }}
          >
            ← Voltar
          </button>
        )}

        <StepBar total={3} current={step} />

        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 6,
            marginTop: 8,
          }}
        >
          Passo {step + 1} de 3
        </p>
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.2,
          }}
        >
          {STEP_TITLES[step].title}{" "}
          <span style={{ color: colors.rosa }}>{STEP_TITLES[step].accent}</span>
        </p>
      </div>
      {/* fecha maxWidth */}

      {/* Corpo */}
      <div
        style={{
          flex: 1,
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "20px 20px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* ── PASSO 0: Tipo de comércio ── */}
        {step === 0 && (
          <>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>
              Escolha a categoria que melhor descreve seu negócio
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {groups.map((g) => (
                <div
                  key={g.id}
                  onClick={() => set("group_id", g.id)}
                  style={{
                    borderRadius: 14,
                    padding: "14px 10px",
                    border: `1.5px solid ${form.group_id === g.id ? colors.rosa : colors.bordaLilas}`,
                    background:
                      form.group_id === g.id ? colors.lilasInput : "#fff",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                  }}
                >
                  <div style={{ fontSize: 26, marginBottom: 6 }}>
                    {g.icon ?? "🏪"}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {g.name}
                  </div>
                </div>
              ))}
            </div>
            {errors.group_id && (
              <p style={{ fontSize: 12, color: colors.rosa }}>
                {errors.group_id}
              </p>
            )}
            <Button
              variant="primary"
              fullWidth
              onClick={next}
              style={{ marginTop: 8 }}
            >
              Continuar →
            </Button>
          </>
        )}

        {/* ── PASSO 1: Dados da loja ── */}
        {step === 1 && (
          <>
            {/* Preview do grupo selecionado */}
            {selectedGroup && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: colors.lilasClaro,
                  borderRadius: 12,
                  padding: "10px 14px",
                  marginBottom: 4,
                }}
              >
                <span style={{ fontSize: 20 }}>{selectedGroup.icon}</span>
                <span
                  style={{ fontSize: 13, fontWeight: 600, color: colors.noite }}
                >
                  {selectedGroup.name}
                </span>
                <button
                  onClick={() => setStep(0)}
                  style={{
                    marginLeft: "auto",
                    background: "none",
                    border: "none",
                    fontSize: 11,
                    color: colors.rosa,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Trocar
                </button>
              </div>
            )}

            <Input
              label="Nome da loja *"
              placeholder="Ex: Pizzaria do Zé"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              error={errors.name}
              autoComplete="organization"
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
                Descrição (opcional)
              </label>
              <textarea
                placeholder="Conte um pouco sobre sua loja..."
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
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

            <Input
              label="Telefone *"
              placeholder="(11) 99999-9999"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              error={errors.phone}
              type="tel"
              inputMode="numeric"
            />

            <Input
              label="WhatsApp (com DDI)"
              placeholder="+55 11 99999-9999"
              value={form.whatsapp}
              onChange={(e) => set("whatsapp", e.target.value)}
              type="tel"
              inputMode="numeric"
            />

            <Button variant="primary" fullWidth onClick={next}>
              Continuar →
            </Button>
          </>
        )}

        {/* ── PASSO 2: Endereço e entrega ── */}
        {step === 2 && (
          <>
            <Input
              label="Endereço completo *"
              placeholder="Rua das Flores, 142"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              error={errors.address}
              autoComplete="street-address"
            />

            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 2 }}>
                <Input
                  label="Cidade *"
                  placeholder="São Paulo"
                  value={form.city}
                  onChange={(e) => set("city", e.target.value)}
                  error={errors.city}
                />
              </div>
              <div style={{ flex: 1 }}>
                <Input
                  label="UF *"
                  placeholder="SP"
                  value={form.state}
                  onChange={(e) =>
                    set("state", e.target.value.toUpperCase().slice(0, 2))
                  }
                  error={errors.state}
                  maxLength={2}
                />
              </div>
            </div>

            <Input
              label="CEP *"
              placeholder="00000-000"
              value={form.zip_code}
              onChange={(e) => set("zip_code", e.target.value)}
              error={errors.zip_code}
              inputMode="numeric"
            />

            {/* Localização no mapa */}
            <div>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.noite,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 8,
                }}
              >
                Localização no mapa
              </p>
              <button
                onClick={() => setShowMap(true)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 12,
                  border: `1.5px solid ${pickedLat ? "#22c55e" : colors.bordaLilas}`,
                  background: pickedLat ? "#f0fdf4" : "#fff",
                  color: pickedLat ? "#15803d" : "#888",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                  textAlign: "left",
                }}
              >
                {pickedLat
                  ? `✅ Localização definida (${pickedLat.toFixed(4)}, ${pickedLng?.toFixed(4)})`
                  : "📍 Marcar localização no mapa (opcional)"}
              </button>
            </div>

            <div style={{ height: 1, background: colors.bordaLilas }} />

            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#888",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Configurações de entrega
            </p>

            <div style={{ display: "flex", gap: 10 }}>
              <Input
                label="Taxa de entrega (R$)"
                placeholder="0,00"
                value={form.delivery_fee}
                onChange={(e) => set("delivery_fee", e.target.value)}
                type="number"
                inputMode="decimal"
              />
              <Input
                label="Pedido mínimo (R$)"
                placeholder="0,00"
                value={form.min_order_value}
                onChange={(e) => set("min_order_value", e.target.value)}
                type="number"
                inputMode="decimal"
              />
            </div>

            <Input
              label="Tempo estimado de entrega (min)"
              placeholder="45"
              value={form.estimated_time}
              onChange={(e) => set("estimated_time", e.target.value)}
              type="number"
              inputMode="numeric"
            />

            <Button
              variant="primary"
              fullWidth
              loading={saving}
              onClick={handleSubmit}
              style={{ marginTop: 8 }}
            >
              🚀 Criar minha loja
            </Button>
          </>
        )}
      </div>

      {showMap && (
        <LocationPicker
          initialLat={pickedLat ?? -23.55}
          initialLng={pickedLng ?? -46.63}
          onConfirm={(lat, lng) => {
            setPickedLat(lat);
            setPickedLng(lng);
            setShowMap(false);
          }}
          onClose={() => setShowMap(false)}
        />
      )}

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
