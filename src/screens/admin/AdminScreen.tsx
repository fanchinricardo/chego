import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { colors, Spinner, Toast } from "../../components/ui";

interface Store {
  id: string;
  name: string;
  active: boolean;
  signup_paid: boolean;
  open_now: boolean;
  created_at: string;
  owner_id: string;
  profiles: { full_name: string; phone: string | null };
}

interface AdminConfig {
  id: string;
  signup_fee: number;
  monthly_pct: number;
  due_day: number;
  mp_access_token: string | null;
}

interface FinancialStats {
  receivedTotal: number; // faturas pagas no mês
  pendingTotal: number; // faturas pendentes no mês
  estimatedNext: number; // estimativa do próximo mês baseada nas vendas atuais
  paidInvoices: number;
  pendingInvoices: number;
  totalSalesMonth: number; // total de vendas do mês em todos os comércios
}

interface Stats {
  totalStores: number;
  activeStores: number;
  totalCustomers: number;
  totalMotoboys: number;
}

type Tab = "stores" | "config";

export default function AdminScreen() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("stores");
  const [editingStore, setEditingStore] = useState<string | null>(null);
  const [customFees, setCustomFees] = useState<Record<string, any>>({});
  const [savingFees, setSavingFees] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [stats, setStats] = useState<Stats>({
    totalStores: 0,
    activeStores: 0,
    totalCustomers: 0,
    totalMotoboys: 0,
  });
  const [financial, setFinancial] = useState<FinancialStats>({
    receivedTotal: 0,
    pendingTotal: 0,
    estimatedNext: 0,
    paidInvoices: 0,
    pendingInvoices: 0,
    totalSalesMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [showToken, setShowToken] = useState(false);
  const [signupFee, setSignupFee] = useState("");
  const [monthlyPct, setMonthlyPct] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [mpToken, setMpToken] = useState("");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/", { replace: true });
  }

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    await Promise.all([
      fetchStores(),
      fetchConfig(),
      fetchStats(),
      fetchFinancial(),
    ]);
    setLoading(false);
  }

  async function fetchStores() {
    const { data } = await supabase
      .from("stores")
      .select(
        "id, name, active, signup_paid, open_now, created_at, owner_id, billing_type, custom_signup_fee, custom_monthly_fee, custom_monthly_pct, profiles!owner_id(full_name, phone)",
      )
      .order("created_at", { ascending: false });
    setStores((data ?? []) as Store[]);
  }

  async function fetchConfig() {
    const { data } = await supabase.from("admin_config").select("*").single();
    if (data) {
      setConfig(data);
      setSignupFee(String(data.signup_fee));
      setMonthlyPct(String(data.monthly_pct));
      setDueDay(String(data.due_day));
      setMpToken(data.mp_access_token ?? "");
    }
  }

  async function fetchFinancial() {
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      .toISOString()
      .slice(0, 10);

    // Faturas pagas este mês
    const { data: paid } = await supabase
      .from("store_invoices")
      .select("amount")
      .eq("status", "paid")
      .gte("paid_at", monthStart);

    // Faturas pendentes/vencidas
    const { data: pending } = await supabase
      .from("store_invoices")
      .select("amount")
      .in("status", ["pending", "overdue"]);

    // Total de vendas de todos os comércios no mês atual (para estimar próximo mês)
    const { data: sales } = await supabase
      .from("orders")
      .select("total, store_id")
      .not("status", "in", '("pending","cancelled")')
      .gte("created_at", monthStart);

    const { data: pdvSales } = await supabase
      .from("pdv_orders")
      .select("total, store_id")
      .eq("status", "closed")
      .gte("created_at", monthStart);

    const { data: config } = await supabase
      .from("admin_config")
      .select("monthly_pct, signup_fee")
      .single();

    const defaultPct = Number(config?.monthly_pct ?? 5) / 100;
    const minFee = 9.9;

    const receivedTotal = (paid ?? []).reduce(
      (s, i) => s + Number(i.amount),
      0,
    );
    const pendingTotal = (pending ?? []).reduce(
      (s, i) => s + Number(i.amount),
      0,
    );
    const totalSalesMonth = [
      ...(sales ?? []).map((o) => Number(o.total)),
      ...(pdvSales ?? []).map((o) => Number(o.total)),
    ].reduce((s, v) => s + v, 0);

    // Busca taxas customizadas de cada loja
    const { data: allStores } = await supabase
      .from("stores")
      .select("id, billing_type, custom_monthly_fee, custom_monthly_pct")
      .eq("active", true);

    // Mapa de vendas por loja
    const salesByStore: Record<string, number> = {};
    for (const o of [...(sales ?? []), ...(pdvSales ?? [])]) {
      const sid = (o as any).store_id;
      if (sid) salesByStore[sid] = (salesByStore[sid] ?? 0) + Number(o.total);
    }

    // Estimativa total somando por loja
    let estimatedNext = 0;
    for (const store of allStores ?? []) {
      const storeSales = salesByStore[store.id] ?? 0;
      if (store.billing_type === "fixed" && store.custom_monthly_fee) {
        estimatedNext += Number(store.custom_monthly_fee);
      } else {
        const pct = store.custom_monthly_pct
          ? Number(store.custom_monthly_pct) / 100
          : defaultPct;
        estimatedNext += Math.max(storeSales * pct, minFee);
      }
    }

    setFinancial({
      receivedTotal,
      pendingTotal,
      estimatedNext,
      paidInvoices: paid?.length ?? 0,
      pendingInvoices: pending?.length ?? 0,
      totalSalesMonth,
    });
  }

  async function fetchStats() {
    const [{ count: s }, { count: c }, { count: m }, { count: a }] =
      await Promise.all([
        supabase.from("stores").select("*", { count: "exact", head: true }),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "customer"),
        supabase
          .from("profiles")
          .select("*", { count: "exact", head: true })
          .eq("role", "motoboy"),
        supabase
          .from("stores")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
      ]);
    setStats({
      totalStores: s ?? 0,
      activeStores: a ?? 0,
      totalCustomers: c ?? 0,
      totalMotoboys: m ?? 0,
    });
  }

  async function handleSaveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("admin_config")
        .update({
          signup_fee: Number(signupFee),
          monthly_pct: Number(monthlyPct),
          due_day: Number(dueDay),
          mp_access_token: mpToken.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
      if (error) throw new Error(error.message);
      showToast("Configurações salvas! ✅");
      fetchConfig();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCustomFees(storeId: string) {
    setSavingFees(true);
    const fees = customFees[storeId] ?? {};
    await supabase
      .from("stores")
      .update({
        billing_type: fees.billing_type ?? "pct",
        custom_signup_fee: fees.custom_signup_fee
          ? Number(fees.custom_signup_fee)
          : null,
        custom_monthly_fee: fees.custom_monthly_fee
          ? Number(fees.custom_monthly_fee)
          : null,
        custom_monthly_pct: fees.custom_monthly_pct
          ? Number(fees.custom_monthly_pct)
          : null,
      })
      .eq("id", storeId);
    setSavingFees(false);
    setEditingStore(null);
    await fetchStores();
  }

  function initCustomFees(s: Store) {
    setCustomFees((prev) => ({
      ...prev,
      [s.id]: {
        billing_type: (s as any).billing_type ?? "pct",
        custom_signup_fee: (s as any).custom_signup_fee ?? "",
        custom_monthly_fee: (s as any).custom_monthly_fee ?? "",
        custom_monthly_pct: (s as any).custom_monthly_pct ?? "",
      },
    }));
    setEditingStore(s.id);
  }

  async function handleToggleStore(store: Store) {
    await supabase
      .from("stores")
      .update({ active: !store.active })
      .eq("id", store.id);
    fetchStores();
    showToast(store.active ? "Loja desativada" : "Loja ativada!");
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
      <div style={{ background: colors.noite, padding: "20px 20px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 2,
          }}
        >
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 22,
              color: "#fff",
            }}
          >
            Cheg<span style={{ color: colors.rosa }}>ô</span> Admin
          </p>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => navigate("/support")}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              🎧 Suporte
            </button>
            <button
              onClick={handleLogout}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                borderRadius: 8,
                padding: "6px 14px",
                color: "rgba(255,255,255,0.7)",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Sair →
            </button>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Painel de administração
        </p>

        {/* Cards Financeiros */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          {[
            {
              label: "✅ Recebido no mês",
              value: `R$ ${financial.receivedTotal.toFixed(2)}`,
              color: "#22c55e",
              sub: `${financial.paidInvoices} fatura(s)`,
            },
            {
              label: "⏳ A receber",
              value: `R$ ${financial.pendingTotal.toFixed(2)}`,
              color: "#f59e0b",
              sub: `${financial.pendingInvoices} pendente(s)`,
            },
            {
              label: "📊 Estimativa próx. mês",
              value: `R$ ${financial.estimatedNext.toFixed(2)}`,
              color: "#60a5fa",
              sub: `Vendas: R$ ${financial.totalSalesMonth.toFixed(0)}`,
            },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 16,
                  color: c.color,
                  lineHeight: 1,
                }}
              >
                {c.value}
              </p>
              <p
                style={{
                  fontSize: 8,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 4,
                  lineHeight: 1.4,
                }}
              >
                {c.label}
              </p>
              <p
                style={{
                  fontSize: 8,
                  color: "rgba(255,255,255,0.25)",
                  marginTop: 2,
                }}
              >
                {c.sub}
              </p>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 8,
            marginTop: 4,
          }}
        >
          {[
            {
              label: "Comércios",
              value: stats.totalStores,
              color: colors.rosa,
            },
            { label: "Ativos", value: stats.activeStores, color: "#22c55e" },
            {
              label: "Clientes",
              value: stats.totalCustomers,
              color: "#60a5fa",
            },
            { label: "Motoboys", value: stats.totalMotoboys, color: "#f59e0b" },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "rgba(255,255,255,0.07)",
                borderRadius: 10,
                padding: "10px 8px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 20,
                  color: s.color,
                  lineHeight: 1,
                }}
              >
                {s.value}
              </p>
              <p
                style={{
                  fontSize: 9,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 4,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          background: "#fff",
          borderBottom: `1px solid ${colors.bordaLilas}`,
        }}
      >
        {(
          [
            ["stores", "🏪 Comércios"],
            ["config", "⚙️ Configurações"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              color: tab === key ? colors.rosa : "#aaa",
              borderBottom: `2px solid ${tab === key ? colors.rosa : "transparent"}`,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spinner color={colors.rosa} />
          </div>
        ) : (
          <>
            {/* Tab Comércios */}
            {tab === "stores" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {stores.length === 0 ? (
                  <div
                    style={{
                      background: "#fff",
                      borderRadius: 14,
                      padding: "32px 20px",
                      textAlign: "center",
                      border: `1px solid ${colors.bordaLilas}`,
                    }}
                  >
                    <p style={{ fontSize: 13, color: "#aaa" }}>
                      Nenhum comércio cadastrado
                    </p>
                  </div>
                ) : (
                  stores.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        background: "#fff",
                        borderRadius: 14,
                        border: `1px solid ${colors.bordaLilas}`,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          display: "flex",
                          alignItems: "flex-start",
                          justifyContent: "space-between",
                          gap: 8,
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              marginBottom: 3,
                            }}
                          >
                            <p
                              style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: colors.noite,
                              }}
                            >
                              {s.name}
                            </p>
                            {s.open_now && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: 6,
                                  background: "#f0fdf4",
                                  color: "#15803d",
                                  border: "1px solid #86efac",
                                }}
                              >
                                ABERTA
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 11, color: "#888" }}>
                            👤 {(s.profiles as any)?.full_name ?? "—"}
                          </p>
                          {(s.profiles as any)?.phone && (
                            <p style={{ fontSize: 11, color: "#888" }}>
                              📱 {(s.profiles as any).phone}
                            </p>
                          )}
                          <p
                            style={{
                              fontSize: 10,
                              color: "#bbb",
                              marginTop: 2,
                            }}
                          >
                            Cadastro:{" "}
                            {new Date(s.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          {(s as any).billing_type === "fixed" &&
                            (s as any).custom_monthly_fee && (
                              <p
                                style={{
                                  fontSize: 10,
                                  color: "#7e22ce",
                                  fontWeight: 600,
                                  marginTop: 2,
                                }}
                              >
                                💜 Fixo: R${" "}
                                {Number((s as any).custom_monthly_fee).toFixed(
                                  2,
                                )}
                                /mês
                              </p>
                            )}
                          {(s as any).billing_type !== "fixed" &&
                            (s as any).custom_monthly_pct && (
                              <p
                                style={{
                                  fontSize: 10,
                                  color: "#7e22ce",
                                  fontWeight: 600,
                                  marginTop: 2,
                                }}
                              >
                                💜 {(s as any).custom_monthly_pct}% customizado
                              </p>
                            )}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-end",
                            gap: 6,
                          }}
                        >
                          <button
                            onClick={() => handleToggleStore(s)}
                            style={{
                              padding: "6px 12px",
                              borderRadius: 8,
                              border: "none",
                              cursor: "pointer",
                              fontSize: 11,
                              fontWeight: 700,
                              fontFamily: "'Space Grotesk', sans-serif",
                              background: s.active ? "#f0fdf4" : "#fef2f2",
                              color: s.active ? "#15803d" : "#dc2626",
                            }}
                          >
                            {s.active ? "✓ Ativa" : "✗ Inativa"}
                          </button>
                          <span
                            style={{
                              fontSize: 9,
                              color: s.signup_paid ? "#15803d" : "#b45309",
                              fontWeight: 700,
                            }}
                          >
                            {s.signup_paid
                              ? "✓ Adesão paga"
                              : "⏳ Adesão pendente"}
                          </span>
                          <button
                            onClick={() =>
                              editingStore === s.id
                                ? setEditingStore(null)
                                : initCustomFees(s)
                            }
                            style={{
                              padding: "4px 10px",
                              borderRadius: 8,
                              border: `1px solid ${colors.bordaLilas}`,
                              background:
                                editingStore === s.id
                                  ? colors.lilasClaro
                                  : "#fff",
                              color: "#7e22ce",
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            ⚙️ Taxas
                          </button>
                        </div>
                      </div>

                      {/* Painel de taxas customizadas */}
                      {editingStore === s.id && (
                        <div
                          style={{
                            borderTop: `1px solid ${colors.bordaLilas}`,
                            padding: "12px 14px",
                            background: colors.fundo,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: "#aaa",
                              textTransform: "uppercase",
                              letterSpacing: "0.08em",
                              marginBottom: 10,
                            }}
                          >
                            Taxas customizadas
                          </p>

                          {/* Tipo de cobrança */}
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginBottom: 12,
                            }}
                          >
                            {[
                              ["pct", "% sobre vendas"],
                              ["fixed", "Valor fixo mensal"],
                            ].map(([val, label]) => (
                              <button
                                key={val}
                                onClick={() =>
                                  setCustomFees((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      ...prev[s.id],
                                      billing_type: val,
                                    },
                                  }))
                                }
                                style={{
                                  flex: 1,
                                  padding: "8px",
                                  borderRadius: 10,
                                  border: `1.5px solid ${customFees[s.id]?.billing_type === val ? colors.rosa : colors.bordaLilas}`,
                                  background:
                                    customFees[s.id]?.billing_type === val
                                      ? "#fff0f8"
                                      : "#fff",
                                  color:
                                    customFees[s.id]?.billing_type === val
                                      ? colors.rosa
                                      : "#888",
                                  fontSize: 12,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                }}
                              >
                                {label}
                              </button>
                            ))}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 8,
                              marginBottom: 12,
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "#888",
                                  marginBottom: 4,
                                }}
                              >
                                Taxa de adesão customizada (R$) — deixe vazio
                                para usar o padrão
                              </p>
                              <input
                                type="number"
                                step="0.01"
                                placeholder={`Padrão: R$ ${config?.signup_fee ?? "—"}`}
                                value={
                                  customFees[s.id]?.custom_signup_fee ?? ""
                                }
                                onChange={(e) =>
                                  setCustomFees((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      ...prev[s.id],
                                      custom_signup_fee: e.target.value,
                                    },
                                  }))
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  borderRadius: 10,
                                  border: `1.5px solid ${colors.bordaLilas}`,
                                  fontSize: 13,
                                  outline: "none",
                                  boxSizing: "border-box",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                }}
                              />
                            </div>
                            {customFees[s.id]?.billing_type === "fixed" ? (
                              <div>
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: "#888",
                                    marginBottom: 4,
                                  }}
                                >
                                  Valor fixo mensal (R$)
                                </p>
                                <input
                                  type="number"
                                  step="0.01"
                                  placeholder="Ex: 49,90"
                                  value={
                                    customFees[s.id]?.custom_monthly_fee ?? ""
                                  }
                                  onChange={(e) =>
                                    setCustomFees((prev) => ({
                                      ...prev,
                                      [s.id]: {
                                        ...prev[s.id],
                                        custom_monthly_fee: e.target.value,
                                      },
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: `1.5px solid ${colors.bordaLilas}`,
                                    fontSize: 13,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    fontFamily: "'Space Grotesk', sans-serif",
                                  }}
                                />
                              </div>
                            ) : (
                              <div>
                                <p
                                  style={{
                                    fontSize: 11,
                                    color: "#888",
                                    marginBottom: 4,
                                  }}
                                >
                                  % sobre vendas customizado — deixe vazio para
                                  usar o padrão ({config?.monthly_pct ?? "—"}%)
                                </p>
                                <input
                                  type="number"
                                  step="0.1"
                                  placeholder={`Padrão: ${config?.monthly_pct ?? "—"}%`}
                                  value={
                                    customFees[s.id]?.custom_monthly_pct ?? ""
                                  }
                                  onChange={(e) =>
                                    setCustomFees((prev) => ({
                                      ...prev,
                                      [s.id]: {
                                        ...prev[s.id],
                                        custom_monthly_pct: e.target.value,
                                      },
                                    }))
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    borderRadius: 10,
                                    border: `1.5px solid ${colors.bordaLilas}`,
                                    fontSize: 13,
                                    outline: "none",
                                    boxSizing: "border-box",
                                    fontFamily: "'Space Grotesk', sans-serif",
                                  }}
                                />
                              </div>
                            )}
                          </div>

                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              onClick={() => setEditingStore(null)}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: 10,
                                border: `1px solid ${colors.bordaLilas}`,
                                background: "#fff",
                                color: "#888",
                                fontSize: 12,
                                fontWeight: 600,
                                cursor: "pointer",
                                fontFamily: "'Space Grotesk', sans-serif",
                              }}
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveCustomFees(s.id)}
                              disabled={savingFees}
                              style={{
                                flex: 1,
                                padding: "8px",
                                borderRadius: 10,
                                border: "none",
                                background: colors.rosa,
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "'Space Grotesk', sans-serif",
                              }}
                            >
                              {savingFees ? "Salvando..." : "Salvar"}
                            </button>
                          </div>

                          {/* Mostra taxas atuais */}
                          {((s as any).billing_type === "fixed" ||
                            (s as any).custom_monthly_pct ||
                            (s as any).custom_signup_fee) && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "8px 10px",
                                background: colors.lilasClaro,
                                borderRadius: 8,
                              }}
                            >
                              <p
                                style={{
                                  fontSize: 11,
                                  color: "#7e22ce",
                                  fontWeight: 600,
                                }}
                              >
                                Taxas atuais deste comércio:
                              </p>
                              {(s as any).custom_signup_fee && (
                                <p style={{ fontSize: 11, color: "#7e22ce" }}>
                                  • Adesão: R${" "}
                                  {Number((s as any).custom_signup_fee).toFixed(
                                    2,
                                  )}
                                </p>
                              )}
                              {(s as any).billing_type === "fixed" &&
                                (s as any).custom_monthly_fee && (
                                  <p style={{ fontSize: 11, color: "#7e22ce" }}>
                                    • Mensalidade fixa: R${" "}
                                    {Number(
                                      (s as any).custom_monthly_fee,
                                    ).toFixed(2)}
                                  </p>
                                )}
                              {(s as any).billing_type === "pct" &&
                                (s as any).custom_monthly_pct && (
                                  <p style={{ fontSize: 11, color: "#7e22ce" }}>
                                    • % vendas: {(s as any).custom_monthly_pct}%
                                  </p>
                                )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab Configurações */}
            {tab === "config" && config && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: `1px solid ${colors.bordaLilas}`,
                    padding: "16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#aaa",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 14,
                    }}
                  >
                    Valores do contrato
                  </p>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.noite,
                          marginBottom: 6,
                        }}
                      >
                        Taxa de adesão (R$)
                      </p>
                      <input
                        type="number"
                        value={signupFee}
                        onChange={(e) => setSignupFee(e.target.value)}
                        placeholder="99.00"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${colors.bordaLilas}`,
                          fontSize: 14,
                          fontWeight: 700,
                          color: colors.noite,
                          fontFamily: "'Space Grotesk', sans-serif",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                        Valor cobrado no cadastro do comércio
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.noite,
                          marginBottom: 6,
                        }}
                      >
                        Percentual mensal (%)
                      </p>
                      <input
                        type="number"
                        value={monthlyPct}
                        onChange={(e) => setMonthlyPct(e.target.value)}
                        placeholder="5.00"
                        step="0.1"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${colors.bordaLilas}`,
                          fontSize: 14,
                          fontWeight: 700,
                          color: colors.noite,
                          fontFamily: "'Space Grotesk', sans-serif",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                        % sobre as vendas do mês anterior
                      </p>
                    </div>
                    <div>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: colors.noite,
                          marginBottom: 6,
                        }}
                      >
                        Dia de vencimento
                      </p>
                      <input
                        type="number"
                        value={dueDay}
                        onChange={(e) => setDueDay(e.target.value)}
                        placeholder="10"
                        min="1"
                        max="28"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${colors.bordaLilas}`,
                          fontSize: 14,
                          fontWeight: 700,
                          color: colors.noite,
                          fontFamily: "'Space Grotesk', sans-serif",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                        Dia do mês para vencimento das mensalidades
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    background: "#fff",
                    borderRadius: 14,
                    border: `1px solid ${colors.bordaLilas}`,
                    padding: "16px",
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#aaa",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: 14,
                    }}
                  >
                    Mercado Pago
                  </p>
                  <div>
                    <p
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: colors.noite,
                        marginBottom: 6,
                      }}
                    >
                      Access Token (produção)
                    </p>
                    <div style={{ position: "relative" }}>
                      <input
                        type={showToken ? "text" : "password"}
                        value={mpToken}
                        onChange={(e) => setMpToken(e.target.value)}
                        placeholder="APP_USR-..."
                        style={{
                          width: "100%",
                          padding: "10px 40px 10px 12px",
                          borderRadius: 10,
                          border: `1.5px solid ${colors.bordaLilas}`,
                          fontSize: 13,
                          color: colors.noite,
                          fontFamily: "'Space Grotesk', sans-serif",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                      />
                      <button
                        onClick={() => setShowToken(!showToken)}
                        style={{
                          position: "absolute",
                          right: 10,
                          top: "50%",
                          transform: "translateY(-50%)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 16,
                        }}
                      >
                        {showToken ? "🙈" : "👁️"}
                      </button>
                    </div>
                    <p style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>
                      Token da conta MP que receberá as faturas dos comércios
                    </p>
                    {mpToken && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: "8px 12px",
                          background: "#f0fdf4",
                          borderRadius: 8,
                          border: "1px solid #86efac",
                        }}
                      >
                        <p style={{ fontSize: 10, color: "#15803d" }}>
                          ✓ Token configurado
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    background: colors.lilasClaro,
                    borderRadius: 12,
                    padding: "14px 16px",
                    border: `1px solid ${colors.bordaLilas}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#7e22ce",
                      marginBottom: 8,
                    }}
                  >
                    📋 Configuração atual
                  </p>
                  <p
                    style={{ fontSize: 12, color: "#6b21a8", lineHeight: 1.8 }}
                  >
                    Taxa de adesão:{" "}
                    <strong>R$ {Number(signupFee).toFixed(2)}</strong>
                    <br />
                    Mensalidade: <strong>{monthlyPct}%</strong> das vendas do
                    mês
                    <br />
                    Vencimento: <strong>todo dia {dueDay}</strong>
                  </p>
                </div>

                <button
                  onClick={handleSaveConfig}
                  disabled={saving}
                  style={{
                    width: "100%",
                    padding: "14px",
                    borderRadius: 13,
                    background: saving ? "#aaa" : colors.rosa,
                    color: "#fff",
                    border: "none",
                    fontSize: 15,
                    fontWeight: 700,
                    cursor: saving ? "not-allowed" : "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {saving ? "⏳ Salvando..." : "💾 Salvar configurações"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
