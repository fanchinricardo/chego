import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Toast } from "../../components/ui";

export default function StoreMpConfigScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [form, setForm] = useState({
    pix_key: "",
    merchant_name: "",
    merchant_city: "",
    mp_access_token: "",
    mp_public_key: "",
  });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    if (!store) return;
    supabase
      .from("store_mp_config")
      .select("*")
      .eq("store_id", store.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data)
          setForm({
            pix_key: data.pix_key ?? "",
            merchant_name: data.merchant_name ?? "",
            merchant_city: data.merchant_city ?? "",
            mp_access_token: data.mp_access_token ?? "",
            mp_public_key: data.mp_public_key ?? "",
          });
      });
  }, [store]);

  async function handleSave() {
    if (!store) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("store_mp_config").upsert(
        {
          store_id: store.id,
          pix_key: form.pix_key.trim() || null,
          merchant_name: form.merchant_name.trim() || null,
          merchant_city: form.merchant_city.trim() || null,
          mp_access_token: form.mp_access_token.trim() || null,
          mp_public_key: form.mp_public_key.trim() || null,
          mp_test_mode: false,
        },
        { onConflict: "store_id" },
      );

      if (error) throw new Error(error.message);

      if (form.pix_key.trim()) {
        await supabase
          .from("stores")
          .update({ pix_key: form.pix_key.trim() })
          .eq("id", store.id);
      }

      showToast("Configuração salva!");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
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
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: 12,
              padding: 0,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Voltar
          </button>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 2,
            }}
          >
            Mercado Pago
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            Configure sua conta para receber pagamentos via Pix
          </p>
        </div>

        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              background: "#fff8e6",
              border: "1px solid #fcd34d",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#b45309",
                marginBottom: 6,
              }}
            >
              📋 Como obter suas credenciais
            </p>
            <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.7 }}>
              1. Acesse mercadopago.com.br e faça login{"\n"}
              2. Vá em Seu negócio → Configurações → Credenciais{"\n"}
              3. Copie o Access Token de Produção
            </p>
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Chave Pix
            </p>
            <Input
              label="Chave Pix *"
              placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
              value={form.pix_key}
              onChange={(e) =>
                setForm((f) => ({ ...f, pix_key: e.target.value }))
              }
            />
            <Input
              label="Nome do estabelecimento"
              placeholder="PIZZARIA DO ZE"
              value={form.merchant_name}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  merchant_name: e.target.value.toUpperCase().slice(0, 25),
                }))
              }
            />
            <Input
              label="Cidade"
              placeholder="SAO PAULO"
              value={form.merchant_city}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  merchant_city: e.target.value.toUpperCase().slice(0, 15),
                }))
              }
            />
          </div>

          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <p
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#aaa",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Credenciais de produção
            </p>
            <Input
              label="Access Token *"
              placeholder="APP_USR-0000000000000000-..."
              value={form.mp_access_token}
              onChange={(e) =>
                setForm((f) => ({ ...f, mp_access_token: e.target.value }))
              }
              type="password"
              autoComplete="off"
            />
            <Input
              label="Public Key"
              placeholder="APP_USR-..."
              value={form.mp_public_key}
              onChange={(e) =>
                setForm((f) => ({ ...f, mp_public_key: e.target.value }))
              }
              autoComplete="off"
            />
          </div>

          <Button
            variant="primary"
            fullWidth
            loading={saving}
            onClick={handleSave}
          >
            💾 Salvar configuração
          </Button>
        </div>
      </div>
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
