import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Spinner } from "../../components/ui";
import { BottomNav } from "../store/StoreDashboard";

interface DaySummary {
  date: string;
  orders: number;
  revenue: number;
  delivery: number;
  pdv: number;
  balcao: number;
}

interface MonthSummary {
  total: number;
  orders: number;
  delivery: number;
  pdv: number;
  balcao: number;
  avg_ticket: number;
  days: DaySummary[];
}

const MONTHS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

export default function StoreRevenueScreen() {
  const navigate = useNavigate();
  const { store } = useStore();
  const storeId = store?.id ?? null;

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [data, setData] = useState<MonthSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const fetchRevenue = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);

    // Usa strings de data sem conversão de timezone
    const fromDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const toDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    const from = fromDate + "T00:00:00.000Z";
    const to = toDate + "T23:59:59.999Z";

    // Busca pedidos delivery/balcão
    const { data: orders } = await supabase
      .from("orders")
      .select("id, total, created_at, status, delivery_type, notes")
      .eq("store_id", storeId)
      .not("status", "in", '("pending","cancelled")')
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });

    // Busca pedidos PDV (mesas)
    const { data: pdvOrders } = await supabase
      .from("pdv_orders")
      .select("id, total, created_at, status")
      .eq("store_id", storeId)
      .in("status", ["closed"])
      .gte("created_at", from)
      .lte("created_at", to)
      .order("created_at", { ascending: true });

    // Agrupa por dia
    const dayMap: Record<string, DaySummary> = {};

    const addDay = (dateStr: string) => {
      if (!dayMap[dateStr])
        dayMap[dateStr] = {
          date: dateStr,
          orders: 0,
          revenue: 0,
          delivery: 0,
          pdv: 0,
          balcao: 0,
        };
    };

    for (const o of orders ?? []) {
      const d = o.created_at.slice(0, 10);
      addDay(d);
      const val = Number(o.total);
      dayMap[d].orders++;
      dayMap[d].revenue += val;
      const isBalcao = o.notes?.includes("Balcão");
      if (isBalcao) dayMap[d].balcao += val;
      else dayMap[d].delivery += val;
    }

    for (const o of pdvOrders ?? []) {
      const d = o.created_at.slice(0, 10);
      addDay(d);
      const val = Number(o.total);
      dayMap[d].orders++;
      dayMap[d].revenue += val;
      dayMap[d].pdv += val;
    }

    const days = Object.values(dayMap).sort((a, b) =>
      a.date.localeCompare(b.date),
    );

    const total = days.reduce((s, d) => s + d.revenue, 0);
    const ordersN = days.reduce((s, d) => s + d.orders, 0);
    const delivery = days.reduce((s, d) => s + d.delivery, 0);
    const pdv = days.reduce((s, d) => s + d.pdv, 0);
    const balcao = days.reduce((s, d) => s + d.balcao, 0);

    setData({
      total,
      orders: ordersN,
      delivery,
      pdv,
      balcao,
      avg_ticket: ordersN > 0 ? total / ordersN : 0,
      days,
    });
    setLoading(false);
  }, [storeId, year, month]);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  function fmt(v: number) {
    return v.toFixed(2).replace(".", ",");
  }
  function fmtDate(d: string) {
    const [y, m, day] = d.split("-");
    return `${day}/${m}`;
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
      <div style={{ background: colors.noite, padding: "16px 20px 20px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 22,
              color: "#fff",
            }}
          >
            📊 Faturamento
          </p>
          <p
            style={{
              fontSize: 11,
              color: "rgba(255,255,255,0.35)",
              marginTop: 2,
            }}
          >
            Receitas por período
          </p>

          {/* Seletor de mês/ano */}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "9px 12px",
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                outline: "none",
              }}
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i} style={{ color: colors.noite }}>
                  {m}
                </option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                width: 100,
                padding: "9px 12px",
                borderRadius: 10,
                border: "none",
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "'Space Grotesk', sans-serif",
                outline: "none",
              }}
            >
              {years.map((y) => (
                <option key={y} value={y} style={{ color: colors.noite }}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : !data || data.orders === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 36, marginBottom: 10 }}>📭</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
              Nenhum pedido em {MONTHS[month]}/{year}
            </p>
          </div>
        ) : (
          <>
            {/* Cards de resumo */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "14px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Total do mês
                </p>
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 26,
                    color: colors.rosa,
                    marginTop: 4,
                  }}
                >
                  R$ {fmt(data.total)}
                </p>
              </div>
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "14px",
                }}
              >
                <p
                  style={{
                    fontSize: 11,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Pedidos
                </p>
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 26,
                    color: colors.noite,
                    marginTop: 4,
                  }}
                >
                  {data.orders}
                </p>
                <p style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  ticket médio R$ {fmt(data.avg_ticket)}
                </p>
              </div>
            </div>

            {/* Breakdown por canal */}
            <div
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1px solid ${colors.bordaLilas}`,
                padding: "14px",
                marginBottom: 16,
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
                Por canal
              </p>
              {[
                {
                  label: "🛵 Delivery",
                  value: data.delivery,
                  color: "#3b82f6",
                },
                { label: "🍽️ Mesa (PDV)", value: data.pdv, color: colors.rosa },
                { label: "🏪 Balcão", value: data.balcao, color: "#22c55e" },
              ].map((c) => (
                <div key={c.label} style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.noite,
                      }}
                    >
                      {c.label}
                    </span>
                    <span
                      style={{ fontSize: 13, fontWeight: 700, color: c.color }}
                    >
                      R$ {fmt(c.value)}
                    </span>
                  </div>
                  <div
                    style={{
                      background: colors.fundo,
                      borderRadius: 4,
                      height: 6,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${data.total > 0 ? (c.value / data.total) * 100 : 0}%`,
                        background: c.color,
                        height: "100%",
                        borderRadius: 4,
                        transition: "width 0.5s",
                      }}
                    />
                  </div>
                  <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                    {data.total > 0
                      ? ((c.value / data.total) * 100).toFixed(1)
                      : 0}
                    % do total
                  </p>
                </div>
              ))}
            </div>

            {/* Por dia */}
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
                  padding: "12px 14px",
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
                  Por dia
                </p>
              </div>
              {data.days.map((day) => {
                const isExpanded = expandedDay === day.date;
                return (
                  <div
                    key={day.date}
                    style={{ borderBottom: `1px solid ${colors.fundo}` }}
                  >
                    <div
                      onClick={() =>
                        setExpandedDay(isExpanded ? null : day.date)
                      }
                      style={{
                        padding: "10px 14px",
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: colors.lilasClaro,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <p
                          style={{
                            fontFamily: "'Righteous', cursive",
                            fontSize: 15,
                            color: "#7e22ce",
                          }}
                        >
                          {fmtDate(day.date)}
                        </p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <p
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: colors.noite,
                          }}
                        >
                          R$ {fmt(day.revenue)}
                        </p>
                        <p style={{ fontSize: 11, color: "#aaa" }}>
                          {day.orders} pedido{day.orders !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <span style={{ fontSize: 12, color: "#ccc" }}>
                        {isExpanded ? "▲" : "▼"}
                      </span>
                    </div>
                    {isExpanded && (
                      <div
                        style={{
                          padding: "0 14px 12px",
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        {day.delivery > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#3b82f6" }}>
                              🛵 Delivery
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#3b82f6",
                              }}
                            >
                              R$ {fmt(day.delivery)}
                            </span>
                          </div>
                        )}
                        {day.pdv > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ fontSize: 12, color: colors.rosa }}>
                              🍽️ Mesa
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: colors.rosa,
                              }}
                            >
                              R$ {fmt(day.pdv)}
                            </span>
                          </div>
                        )}
                        {day.balcao > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <span style={{ fontSize: 12, color: "#22c55e" }}>
                              🏪 Balcão
                            </span>
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                color: "#22c55e",
                              }}
                            >
                              R$ {fmt(day.balcao)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {/* Total */}
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: colors.lilasClaro,
                }}
              >
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  Total {MONTHS[month]}
                </p>
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 20,
                    color: colors.rosa,
                  }}
                >
                  R$ {fmt(data.total)}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <BottomNav active="profile" storeActive={store?.active ?? false} />
    </div>
  );
}
