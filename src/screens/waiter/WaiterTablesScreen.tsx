import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useWaiter, PDVTable } from "../../hooks/usePDV";
import { colors, Spinner, Toast } from "../../components/ui";

const STATUS_CONFIG = {
  available: {
    label: "Livre",
    bg: "#f0fdf4",
    border: "#86efac",
    text: "#15803d",
    dot: "#22c55e",
  },
  occupied: {
    label: "Ocupada",
    bg: "#fff0f8",
    border: colors.rosa,
    text: colors.rosa,
    dot: colors.rosa,
  },
  waiting_payment: {
    label: "Aguardando conta",
    bg: "#fff8e6",
    border: "#fcd34d",
    text: "#b45309",
    dot: "#f59e0b",
  },
  closed: {
    label: "Fechada",
    bg: "#f5f5f5",
    border: "#d1d5db",
    text: "#888",
    dot: "#ccc",
  },
};

export default function WaiterTablesScreen() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const { tables, loading, openTable, storeId } = useWaiter();

  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [opening, setOpening] = useState<string | null>(null);
  const [readyTables, setReadyTables] = useState<Set<string>>(new Set());
  const [calledTables, setCalledTables] = useState<Set<string>>(new Set());
  const [pulseBlink, setPulseBlink] = useState(false);

  // Busca chamadas de garçom não respondidas
  const fetchCalls = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("pdv_table_calls")
      .select("table_id")
      .eq("answered", false)
      .in(
        "table_id",
        (
          await supabase.from("pdv_tables").select("id").eq("store_id", storeId)
        ).data?.map((t: any) => t.id) ?? [],
      );
    setCalledTables(new Set((data ?? []).map((c: any) => c.table_id)));
  }, [storeId]);

  // Busca mesas com itens prontos na cozinha
  const fetchReadyTables = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("pdv_order_items")
      .select("order_id, pdv_orders(table_id)")
      .eq("status", "ready");
    const tableIds = new Set<string>(
      (data ?? []).map((d: any) => d.pdv_orders?.table_id).filter(Boolean),
    );
    setReadyTables(tableIds);
  }, [storeId]);

  useEffect(() => {
    fetchReadyTables();
    fetchCalls();
    if (!storeId) return;
    const ch = supabase
      .channel(`waiter-ready-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_order_items" },
        fetchReadyTables,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_table_calls" },
        fetchCalls,
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [fetchReadyTables, fetchCalls, storeId]);

  // Piscar quando há mesas prontas ou chamadas
  useEffect(() => {
    if (readyTables.size === 0 && calledTables.size === 0) {
      setPulseBlink(false);
      return;
    }
    const t = setInterval(() => setPulseBlink((b) => !b), 600);
    return () => clearInterval(t);
  }, [readyTables.size, calledTables.size]);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleTablePress(table: PDVTable) {
    if (table.status === "available") {
      const { isConfirmed } = await Swal.fire({
        title: `Abrir ${table.name ?? `Mesa ${table.number}`}?`,
        text: "Uma nova comanda será criada para esta mesa.",
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Abrir mesa",
        cancelButtonText: "Cancelar",
        confirmButtonColor: "#e9181c",
      });
      if (!isConfirmed) return;
      setOpening(table.id);
      try {
        await openTable(table.id);
        navigate(`/waiter/table/${table.id}`);
      } catch (e: any) {
        showToast(e.message, "error");
      } finally {
        setOpening(null);
      }
    } else if (["occupied", "waiting_payment"].includes(table.status)) {
      navigate(`/waiter/table/${table.id}`);
    }
  }

  const available = tables.filter((t) => t.status === "available").length;
  const occupied = tables.filter((t) => t.status === "occupied").length;
  const waitingPayment = tables.filter(
    (t) => t.status === "waiting_payment",
  ).length;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 20px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 14,
            }}
          >
            <div>
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 22,
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                Chegô
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                Olá, {profile?.full_name?.split(" ")[0]} 👋
              </p>
            </div>
            <button
              onClick={signOut}
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 10,
                padding: "7px 14px",
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Sair
            </button>
          </div>

          {/* Resumo */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {[
              { label: "Livres", value: available, color: "#22c55e" },
              { label: "Ocupadas", value: occupied, color: colors.rosa },
              { label: "Conta", value: waitingPayment, color: "#f59e0b" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  padding: "8px",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 22,
                    color: s.color,
                  }}
                >
                  {s.value}
                </p>
                <p
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 2,
                  }}
                >
                  {s.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid de mesas */}
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "16px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : tables.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <p style={{ fontSize: 36, marginBottom: 12 }}>🍽️</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
              Nenhuma mesa cadastrada
            </p>
            <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>
              Peça ao gerente para cadastrar as mesas
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 12,
            }}
          >
            {tables.map((table) => {
              const cfg = STATUS_CONFIG[table.status];
              const isOpening = opening === table.id;
              return (
                <div
                  key={table.id}
                  onClick={() => !isOpening && handleTablePress(table)}
                  style={{
                    background:
                      calledTables.has(table.id) && pulseBlink
                        ? "#fff0f0"
                        : readyTables.has(table.id) && pulseBlink
                          ? "#f0fdf4"
                          : cfg.bg,
                    border: `2px solid ${calledTables.has(table.id) ? (pulseBlink ? "#ef4444" : "#fca5a5") : readyTables.has(table.id) ? (pulseBlink ? "#22c55e" : "#86efac") : cfg.border}`,
                    borderRadius: 16,
                    padding: "16px 10px",
                    textAlign: "center",
                    cursor: isOpening
                      ? "wait"
                      : table.status === "closed"
                        ? "default"
                        : "pointer",
                    opacity: table.status === "closed" ? 0.5 : 1,
                    transition: "border-color 0.3s, background 0.3s",
                  }}
                >
                  {calledTables.has(table.id) && (
                    <div
                      style={{
                        background: pulseBlink ? "#ef4444" : "#dc2626",
                        borderRadius: 6,
                        padding: "2px 6px",
                        marginBottom: 4,
                        display: "inline-block",
                        transition: "background 0.3s",
                      }}
                    >
                      <p
                        style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}
                      >
                        🛎️ CHAMANDO!
                      </p>
                    </div>
                  )}
                  {readyTables.has(table.id) && (
                    <div
                      style={{
                        background: "#22c55e",
                        borderRadius: 6,
                        padding: "2px 6px",
                        marginBottom: 4,
                        display: "inline-block",
                      }}
                    >
                      <p
                        style={{ fontSize: 9, fontWeight: 700, color: "#fff" }}
                      >
                        🔔 PRONTO!
                      </p>
                    </div>
                  )}
                  <p
                    style={{
                      fontFamily: "'Righteous', cursive",
                      fontSize: 28,
                      color: calledTables.has(table.id)
                        ? "#dc2626"
                        : readyTables.has(table.id)
                          ? "#15803d"
                          : cfg.text,
                      lineHeight: 1,
                    }}
                  >
                    {isOpening ? "…" : table.number}
                  </p>
                  {table.name && (
                    <p
                      style={{
                        fontSize: 10,
                        color: cfg.text,
                        opacity: 0.7,
                        marginTop: 2,
                      }}
                    >
                      {table.name}
                    </p>
                  )}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: cfg.dot,
                      }}
                    />
                    <span
                      style={{ fontSize: 9, fontWeight: 600, color: cfg.text }}
                    >
                      {cfg.label}
                    </span>
                  </div>
                  {table.status !== "available" &&
                    table.profiles?.full_name && (
                      <p
                        style={{
                          fontSize: 9,
                          color: cfg.text,
                          opacity: 0.6,
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {table.profiles.full_name.split(" ")[0]}
                      </p>
                    )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
