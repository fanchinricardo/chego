import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Spinner, Toast } from "../../components/ui";

interface Invoice {
  id: string;
  type: "signup" | "monthly";
  reference: string | null;
  amount: number;
  due_date: string;
  paid_at: string | null;
  status: "pending" | "paid" | "overdue";
  qr_code: string | null;
  qr_code_base64: string | null;
  payment_id: string | null;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function StoreBillingScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [nextInvoice, setNextInvoice] = useState<{
    amount: number;
    pct: number;
    salesTotal: number;
    dueDay: number;
  } | null>(null);
  const pollingRef = useRef<any>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    if (!store) return;
    fetchInvoices();
    fetchNextInvoice();
    return () => clearInterval(pollingRef.current);
  }, [store]);

  // Polling automático para faturas pendentes com QR Code gerado
  useEffect(() => {
    const pending = invoices.filter(
      (i) =>
        (i.status === "pending" || i.status === "overdue") && i.qr_code_base64,
    );
    if (pending.length === 0) return;

    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      for (const inv of pending) {
        await checkPayment(inv.id);
      }
    }, 5000);

    return () => clearInterval(pollingRef.current);
  }, [invoices]);

  async function fetchNextInvoice() {
    if (!store) return;
    // Busca config do admin
    const { data: config } = await supabase
      .from("admin_config")
      .select("monthly_pct, due_day")
      .single();
    if (!config) return;

    // Calcula vendas do mês
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const { data: orders } = await supabase
      .from("orders")
      .select("total")
      .eq("store_id", store.id)
      .neq("status", "cancelled")
      .neq("status", "pending")
      .gte("created_at", monthStart);

    const salesTotal = (orders ?? []).reduce((s, o) => s + Number(o.total), 0);
    const amount = Math.max((salesTotal * config.monthly_pct) / 100, 9.9);

    setNextInvoice({
      amount,
      pct: config.monthly_pct,
      salesTotal,
      dueDay: config.due_day,
    });
  }

  async function fetchInvoices() {
    if (!store) return;
    setLoading(true);
    const { data } = await supabase
      .from("store_invoices")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false });
    setInvoices((data ?? []) as Invoice[]);
    setLoading(false);
  }

  async function callBilling(body: Record<string, string>) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/check-invoice-payment`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify(body),
      },
    );
    return res.json();
  }

  async function handleVerifyPayment(invoice: Invoice) {
    if (!invoice.payment_id) {
      showToast("Gere o QR Code primeiro", "error");
      return;
    }
    try {
      const data = await callBilling({
        action: "check_payment",
        invoice_id: invoice.id,
        store_id: store?.id ?? "",
      });
      if (data.paid) {
        showToast("✅ Pagamento confirmado!");
        fetchInvoices();
      } else {
        showToast("Pagamento ainda não identificado", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  }

  async function handleGenerateQR(invoice: Invoice) {
    setGenerating(invoice.id);
    try {
      const data = await callBilling({
        action: "generate_qr",
        invoice_id: invoice.id,
        store_id: store?.id ?? "",
      });
      if (data.error) throw new Error(data.error);
      showToast("QR Code gerado!");
      fetchInvoices();
      startPolling(invoice.id);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setGenerating(null);
    }
  }

  function startPolling(invoiceId: string) {
    clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      await checkPayment(invoiceId);
    }, 5000);
  }

  async function checkPayment(invoiceId: string) {
    try {
      // Verifica status direto no MP via Edge Function
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/check-invoice-payment`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({ invoice_id: invoiceId }),
        },
      );
      const data = await res.json();
      if (data?.status === "paid") {
        clearInterval(pollingRef.current);
        showToast("✅ Pagamento confirmado! Loja ativada!");
        fetchInvoices();
      }
    } catch (err) {
      console.warn("Erro ao verificar pagamento:", err);
    }
  }

  function copyPix(code: string, id: string) {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const MONTH_NAMES = [
    "Jan",
    "Fev",
    "Mar",
    "Abr",
    "Mai",
    "Jun",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
  ];
  function formatRef(ref: string | null) {
    if (!ref) return "";
    const [y, m] = ref.split("-");
    return `${MONTH_NAMES[Number(m) - 1]}/${y}`;
  }

  const pending = invoices.filter(
    (i) => i.status === "pending" || i.status === "overdue",
  );
  const paid = invoices.filter((i) => i.status === "paid");
  const totalPaid = paid.reduce((s, i) => s + Number(i.amount), 0);

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
      <div style={{ background: colors.noite }}>
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
        <p
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Faturas
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {store?.name}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            marginTop: 16,
          }}
        >
          <div
            style={{
              background: "rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              Em aberto
            </p>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: pending.length > 0 ? "#f59e0b" : "#22c55e",
                lineHeight: 1,
              }}
            >
              {pending.length > 0
                ? `${pending.length} fatura${pending.length > 1 ? "s" : ""}`
                : "✓ Em dia"}
            </p>
          </div>
          <div
            style={{
              background: "rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "12px 14px",
            }}
          >
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.4)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: 4,
              }}
            >
              Total pago
            </p>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: "#22c55e",
                lineHeight: 1,
              }}
            >
              R$ {totalPaid.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spinner color={colors.rosa} />
          </div>
        ) : invoices.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>🧾</p>
            <p style={{ fontSize: 14, color: "#aaa" }}>
              Nenhuma fatura encontrada
            </p>
          </div>
        ) : (
          invoices.map((inv) => (
            <div
              key={inv.id}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${inv.status === "overdue" ? "#fca5a5" : inv.status === "paid" ? "#86efac" : colors.bordaLilas}`,
                overflow: "hidden",
              }}
            >
              {/* Header da fatura */}
              <div
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {inv.type === "signup"
                      ? "🏪 Taxa de adesão"
                      : `📅 Mensalidade ${formatRef(inv.reference)}`}
                  </p>
                  <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                    Vencimento:{" "}
                    {new Date(inv.due_date + "T12:00:00").toLocaleDateString(
                      "pt-BR",
                    )}
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p
                    style={{
                      fontFamily: "'Righteous', cursive",
                      fontSize: 18,
                      color:
                        inv.status === "paid"
                          ? "#15803d"
                          : inv.status === "overdue"
                            ? "#dc2626"
                            : colors.rosa,
                    }}
                  >
                    R$ {Number(inv.amount).toFixed(2)}
                  </p>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 8,
                      background:
                        inv.status === "paid"
                          ? "#f0fdf4"
                          : inv.status === "overdue"
                            ? "#fef2f2"
                            : "#fff8e6",
                      color:
                        inv.status === "paid"
                          ? "#15803d"
                          : inv.status === "overdue"
                            ? "#dc2626"
                            : "#b45309",
                      border: `1px solid ${inv.status === "paid" ? "#86efac" : inv.status === "overdue" ? "#fca5a5" : "#fcd34d"}`,
                    }}
                  >
                    {inv.status === "paid"
                      ? "✓ PAGO"
                      : inv.status === "overdue"
                        ? "⚠️ VENCIDO"
                        : "PENDENTE"}
                  </span>
                </div>
              </div>

              {/* QR Code se gerado */}
              {inv.status !== "paid" && inv.qr_code_base64 && (
                <div
                  style={{
                    padding: "0 16px 12px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <img
                    src={`data:image/png;base64,${inv.qr_code_base64}`}
                    style={{
                      width: 180,
                      height: 180,
                      borderRadius: 8,
                      border: `2px solid ${colors.bordaLilas}`,
                    }}
                    alt="QR Code Pix"
                  />
                  <p
                    style={{ fontSize: 11, color: "#888", textAlign: "center" }}
                  >
                    Escaneie o QR Code para pagar
                  </p>
                  {inv.qr_code && (
                    <button
                      onClick={() => copyPix(inv.qr_code!, inv.id)}
                      style={{
                        width: "100%",
                        padding: "9px",
                        borderRadius: 10,
                        background:
                          copiedId === inv.id ? "#f0fdf4" : colors.lilasClaro,
                        border: "none",
                        color: copiedId === inv.id ? "#15803d" : "#7e22ce",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {copiedId === inv.id
                        ? "✓ Copiado!"
                        : "📋 Copiar código Pix"}
                    </button>
                  )}
                  <button
                    onClick={() => handleGenerateQR(inv)}
                    disabled={generating === inv.id}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 10,
                      background: "transparent",
                      border: `1px solid ${colors.bordaLilas}`,
                      color: "#888",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {generating === inv.id
                      ? "⏳ Gerando..."
                      : "🔄 Gerar novo QR Code"}
                  </button>
                  <button
                    onClick={async () => {
                      const data = await callBilling({
                        action: "check_payment",
                        invoice_id: inv.id,
                        store_id: store?.id ?? "",
                      });
                      if (data.status === "paid") {
                        showToast("✅ Pagamento confirmado! Loja ativada!");
                        fetchInvoices();
                      } else {
                        showToast("Pagamento ainda não identificado", "error");
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "8px",
                      borderRadius: 10,
                      background: "transparent",
                      border: `1px solid #86efac`,
                      color: "#15803d",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    🔍 Verificar pagamento
                  </button>
                  <div
                    style={{
                      background: "#fff8e6",
                      border: "1px solid #fcd34d",
                      borderRadius: 10,
                      padding: "8px 12px",
                      width: "100%",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        color: "#92400e",
                        lineHeight: 1.6,
                      }}
                    >
                      ⏳ Pagamento identificado automaticamente em até 5 minutos
                      após o Pix.
                    </p>
                  </div>
                </div>
              )}

              {/* Botão gerar QR */}
              {inv.status !== "paid" && !inv.qr_code_base64 && (
                <div style={{ padding: "0 16px 12px" }}>
                  <button
                    onClick={() => handleGenerateQR(inv)}
                    disabled={generating === inv.id}
                    style={{
                      width: "100%",
                      padding: "11px",
                      borderRadius: 11,
                      background:
                        inv.status === "overdue" ? "#dc2626" : colors.rosa,
                      color: "#fff",
                      border: "none",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: generating === inv.id ? "not-allowed" : "pointer",
                      opacity: generating === inv.id ? 0.7 : 1,
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    {generating === inv.id
                      ? "⏳ Gerando..."
                      : "⚡ Gerar QR Code para pagar"}
                  </button>
                </div>
              )}

              {/* Pago em */}
              {inv.status === "paid" && inv.paid_at && (
                <div style={{ padding: "0 16px 12px" }}>
                  <p style={{ fontSize: 11, color: "#15803d" }}>
                    ✓ Pago em{" "}
                    {new Date(inv.paid_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
