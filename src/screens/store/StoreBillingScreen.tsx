import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Spinner } from "../../components/ui";

interface DaySales {
  date: string;
  total: number;
  count: number;
}

interface MonthlySales {
  month: string;
  total: number;
  count: number;
}

export default function StoreBillingScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const [tab, setTab] = useState<"day" | "month">("day");
  const [loading, setLoading] = useState(true);
  const [dailySales, setDailySales] = useState<DaySales[]>([]);
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  useEffect(() => {
    if (!store) return;
    fetchSales(selectedMonth);
  }, [store, selectedMonth]);

  async function fetchSales(month: string) {
    if (!store) return;
    setLoading(true);

    // Calcula o fim do mês
    const [y, m] = month.split("-").map(Number);
    const nextMonth =
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

    // Vendas por dia do mês selecionado
    const { data: daily } = await supabase
      .from("orders")
      .select("total, created_at")
      .eq("store_id", store.id)
      .in("status", [
        "delivered",
        "confirmed",
        "preparing",
        "ready",
        "in_delivery",
      ])
      .gte("created_at", `${month}-01`)
      .lt("created_at", nextMonth)
      .order("created_at");

    // Agrupa por dia
    const dayMap = new Map<string, { total: number; count: number }>();
    for (const o of daily ?? []) {
      const day = o.created_at.slice(0, 10);
      const cur = dayMap.get(day) ?? { total: 0, count: 0 };
      dayMap.set(day, {
        total: cur.total + Number(o.total),
        count: cur.count + 1,
      });
    }
    const days = Array.from(dayMap.entries()).map(([date, v]) => ({
      date,
      ...v,
    }));
    setDailySales(days);

    // Vendas por mês (últimos 12 meses)
    const { data: monthly } = await supabase
      .from("orders")
      .select("total, created_at")
      .eq("store_id", store.id)
      .in("status", [
        "delivered",
        "confirmed",
        "preparing",
        "ready",
        "in_delivery",
      ])
      .gte(
        "created_at",
        new Date(
          new Date().setFullYear(new Date().getFullYear() - 2),
        ).toISOString(),
      )
      .order("created_at");

    const monthMap = new Map<string, { total: number; count: number }>();
    for (const o of monthly ?? []) {
      const month = o.created_at.slice(0, 7);
      const cur = monthMap.get(month) ?? { total: 0, count: 0 };
      monthMap.set(month, {
        total: cur.total + Number(o.total),
        count: cur.count + 1,
      });
    }
    const months = Array.from(monthMap.entries())
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month));
    setMonthlySales(months);

    setLoading(false);
  }

  const totalDay = dailySales.reduce((s, d) => s + d.total, 0);
  const totalMonth =
    monthlySales.find((m) => m.month === selectedMonth)?.total ?? 0;
  const countMonth =
    monthlySales.find((m) => m.month === selectedMonth)?.count ?? 0;
  const maxDay = Math.max(...dailySales.map((d) => d.total), 1);
  const maxMonth = Math.max(...monthlySales.map((m) => m.total), 1);

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

  function formatMonth(m: string) {
    const [y, mo] = m.split("-");
    return `${MONTH_NAMES[Number(mo) - 1]}/${y.slice(2)}`;
  }

  function formatDate(d: string) {
    const [, , day] = d.split("-");
    return `${day}`;
  }

  // Gera lista de meses para o seletor (últimos 12)
  const monthOptions = Array.from({ length: 24 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
          Vendas
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {store?.name}
        </p>

        {/* Cards resumo */}
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
              Este mês
            </p>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: colors.rosa,
                lineHeight: 1,
              }}
            >
              R$ {totalMonth.toFixed(2)}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              {countMonth} pedidos
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
              Hoje
            </p>
            <p
              style={{
                fontFamily: "'Righteous', cursive",
                fontSize: 22,
                color: "#22c55e",
                lineHeight: 1,
              }}
            >
              R${" "}
              {(
                dailySales.find(
                  (d) => d.date === new Date().toISOString().slice(0, 10),
                )?.total ?? 0
              ).toFixed(2)}
            </p>
            <p
              style={{
                fontSize: 10,
                color: "rgba(255,255,255,0.3)",
                marginTop: 4,
              }}
            >
              {dailySales.find(
                (d) => d.date === new Date().toISOString().slice(0, 10),
              )?.count ?? 0}{" "}
              pedidos
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Seletor de mês */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#888",
              flexShrink: 0,
            }}
          >
            Mês:
          </p>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: 10,
              border: `1.5px solid ${colors.bordaLilas}`,
              background: "#fff",
              fontSize: 13,
              color: colors.noite,
              fontFamily: "'Space Grotesk', sans-serif",
              outline: "none",
            }}
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {formatMonth(m)}
              </option>
            ))}
          </select>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            background: "#fff",
            borderRadius: 12,
            border: `1px solid ${colors.bordaLilas}`,
            padding: 4,
            gap: 4,
          }}
        >
          {[
            { key: "day", label: "📅 Por dia" },
            { key: "month", label: "📊 Por mês" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as "day" | "month")}
              style={{
                flex: 1,
                padding: "8px",
                borderRadius: 9,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "'Space Grotesk', sans-serif",
                background: tab === t.key ? colors.noite : "transparent",
                color: tab === t.key ? "#fff" : "#aaa",
                transition: "all 0.15s",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            style={{ display: "flex", justifyContent: "center", padding: 40 }}
          >
            <Spinner color={colors.rosa} />
          </div>
        ) : (
          <>
            {/* Gráfico de barras */}
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "16px 14px",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 16,
                }}
              >
                {tab === "day"
                  ? `Vendas por dia — ${formatMonth(selectedMonth)}`
                  : "Vendas por mês"}
              </p>

              {(tab === "day" ? dailySales : monthlySales).length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 0" }}>
                  <p style={{ fontSize: 24, marginBottom: 8 }}>📊</p>
                  <p style={{ fontSize: 13, color: "#aaa" }}>
                    Nenhuma venda neste período
                  </p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 4,
                    height: 140,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {(tab === "day" ? dailySales : monthlySales).map(
                    (item, i) => {
                      const val = item.total;
                      const max = tab === "day" ? maxDay : maxMonth;
                      const pct = Math.max((val / max) * 100, 4);
                      const label =
                        tab === "day"
                          ? formatDate((item as DaySales).date)
                          : formatMonth((item as MonthlySales).month);
                      const isToday =
                        tab === "day" &&
                        (item as DaySales).date ===
                          new Date().toISOString().slice(0, 10);
                      const isCurMonth =
                        tab === "month" &&
                        (item as MonthlySales).month === selectedMonth;
                      const highlight = isToday || isCurMonth;
                      return (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 4,
                            minWidth: tab === "day" ? 28 : 36,
                            flex: 1,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 8,
                              color: highlight ? colors.rosa : "#aaa",
                              fontWeight: highlight ? 700 : 400,
                              whiteSpace: "nowrap",
                            }}
                          >
                            R$
                            {val >= 1000
                              ? `${(val / 1000).toFixed(1)}k`
                              : val.toFixed(0)}
                          </p>
                          <div
                            style={{
                              width: "100%",
                              height: `${pct}%`,
                              borderRadius: "4px 4px 0 0",
                              background: highlight
                                ? colors.rosa
                                : colors.lilasClaro,
                              transition: "height 0.3s",
                              minHeight: 4,
                            }}
                          />
                          <p
                            style={{
                              fontSize: 8,
                              color: highlight ? colors.rosa : "#aaa",
                              fontWeight: highlight ? 700 : 400,
                            }}
                          >
                            {label}
                          </p>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </div>

            {/* Tabela detalhada */}
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1px solid ${colors.bordaLilas}`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: `1px solid ${colors.bordaLilas}`,
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
                  {tab === "day"
                    ? "Detalhamento por dia"
                    : "Detalhamento por mês"}
                </p>
              </div>

              {(tab === "day" ? dailySales : monthlySales).length === 0 ? (
                <p
                  style={{
                    fontSize: 13,
                    color: "#aaa",
                    textAlign: "center",
                    padding: "24px 0",
                  }}
                >
                  Nenhuma venda
                </p>
              ) : (
                [...(tab === "day" ? dailySales : monthlySales)]
                  .reverse()
                  .map((item, i, arr) => {
                    const label =
                      tab === "day"
                        ? new Date(
                            (item as DaySales).date + "T12:00:00",
                          ).toLocaleDateString("pt-BR", {
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                          })
                        : formatMonth((item as MonthlySales).month);
                    const isLast = i === arr.length - 1;
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "10px 16px",
                          borderBottom: isLast
                            ? "none"
                            : `1px solid ${colors.fundo}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <p
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: colors.noite,
                            }}
                          >
                            {label}
                          </p>
                          <p
                            style={{
                              fontSize: 10,
                              color: "#aaa",
                              marginTop: 1,
                            }}
                          >
                            {item.count} pedido{item.count !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <p
                          style={{
                            fontFamily: "'Righteous', cursive",
                            fontSize: 16,
                            color: colors.rosa,
                          }}
                        >
                          R$ {item.total.toFixed(2)}
                        </p>
                      </div>
                    );
                  })
              )}

              {/* Total */}
              {(tab === "day" ? dailySales : monthlySales).length > 0 && (
                <div
                  style={{
                    padding: "12px 16px",
                    background: colors.fundo,
                    borderTop: `1px solid ${colors.bordaLilas}`,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    Total{" "}
                    {tab === "day" ? formatMonth(selectedMonth) : "período"}
                  </p>
                  <p
                    style={{
                      fontFamily: "'Righteous', cursive",
                      fontSize: 18,
                      color: colors.rosa,
                    }}
                  >
                    R${" "}
                    {(tab === "day"
                      ? totalDay
                      : monthlySales.reduce((s, m) => s + m.total, 0)
                    ).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
