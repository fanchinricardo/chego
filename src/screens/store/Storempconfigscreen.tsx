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
    mp_test_token: "",
    mp_test_mode: true,
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  // Carrega config existente
  useEffect(() => {
    if (!store) return;
    supabase
      .from("store_mp_config")
      .select("*")
      .eq("store_id", store.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setForm({
            pix_key: data.pix_key ?? "",
            merchant_name: data.merchant_name ?? "",
            merchant_city: data.merchant_city ?? "",
            mp_access_token: data.mp_access_token ?? "",
            mp_public_key: data.mp_public_key ?? "",
            mp_test_token: data.mp_test_token ?? "",
            mp_test_mode: data.mp_test_mode ?? true,
          });
        }
        setLoading(false);
      });
  }, [store]);

  async function handleSave() {
    if (!store) return;
    setSaving(true);
    try {
      // 1. Salva em store_mp_config
      const { error } = await supabase.from("store_mp_config").upsert(
        {
          store_id: store.id,
          pix_key: form.pix_key.trim() || null,
          merchant_name: form.merchant_name.trim() || null,
          merchant_city: form.merchant_city.trim() || null,
          mp_access_token: form.mp_access_token.trim() || null,
          mp_public_key: form.mp_public_key.trim() || null,
          mp_test_token: form.mp_test_token.trim() || null,
          mp_test_mode: form.mp_test_mode,
        },
        { onConflict: "store_id" },
      );

      if (error) throw new Error(error.message);

      // 2. Salva pix_key também na tabela stores (para o cliente conseguir ler)
      if (form.pix_key.trim()) {
        const { error: storeErr } = await supabase
          .from("stores")
          .update({ pix_key: form.pix_key.trim() })
          .eq("id", store.id);

        if (storeErr)
          console.warn("Erro ao salvar pix_key em stores:", storeErr.message);
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
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
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
          Configure sua conta para receber pagamentos via QR Code / Pix
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
        {/* Como obter as credenciais */}
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
            1. Acesse <strong>mercadopago.com.br</strong> e faça login{"\n"}
            2. Vá em <strong>Seu negócio → Configurações → Credenciais</strong>
            {"\n"}
            3. Copie o <strong>Access Token</strong> de Produção{"\n"}
            4. Para testes, use as credenciais de <strong>Sandbox</strong>
          </p>
        </div>

        {/* Chave Pix — obrigatório para QR Code funcionar */}
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
            Chave Pix (obrigatório)
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
            label="Nome do estabelecimento (aparece no Pix)"
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
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <p style={{ fontSize: 11, color: "#15803d", lineHeight: 1.6 }}>
              Com a chave Pix configurada, o QR Code é gerado automaticamente
              para cada pedido. O cliente escaneia e paga diretamente na sua
              conta.
            </p>
          </div>
        </div>

        {/* Modo de operação */}
        <div
          style={{
            background: "#fff",
            borderRadius: 14,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "14px 16px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 12,
            }}
          >
            Modo de operação
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            {[
              { value: true, label: "🧪 Sandbox", sub: "Para testes" },
              { value: false, label: "✅ Produção", sub: "Dinheiro real" },
            ].map((opt) => (
              <div
                key={String(opt.value)}
                onClick={() =>
                  setForm((f) => ({ ...f, mp_test_mode: opt.value }))
                }
                style={{
                  flex: 1,
                  borderRadius: 12,
                  padding: "12px",
                  border: `1.5px solid ${form.mp_test_mode === opt.value ? colors.rosa : colors.bordaLilas}`,
                  background:
                    form.mp_test_mode === opt.value ? "#fff0f8" : "#fff",
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color:
                      form.mp_test_mode === opt.value
                        ? colors.rosa
                        : colors.noite,
                  }}
                >
                  {opt.label}
                </p>
                <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                  {opt.sub}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Credenciais de produção */}
        {!form.mp_test_mode && (
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
              label="Access Token (produção) *"
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
        )}

        {/* Credenciais de sandbox */}
        {form.mp_test_mode && (
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
              Credenciais de sandbox (testes)
            </p>
            <Input
              label="Access Token (sandbox) *"
              placeholder="TEST-0000000000000000-..."
              value={form.mp_test_token}
              onChange={(e) =>
                setForm((f) => ({ ...f, mp_test_token: e.target.value }))
              }
              type="password"
              autoComplete="off"
            />
            <div
              style={{
                background: "#f0fdf4",
                border: "1px solid #86efac",
                borderRadius: 10,
                padding: "10px 12px",
              }}
            >
              <p style={{ fontSize: 11, color: "#15803d", lineHeight: 1.6 }}>
                No modo sandbox, use cartões de teste do Mercado Pago.
                Pagamentos não são reais.
              </p>
            </div>
          </div>
        )}

        <Button
          variant="primary"
          fullWidth
          loading={saving}
          onClick={handleSave}
        >
          💾 Salvar configuração
        </Button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
