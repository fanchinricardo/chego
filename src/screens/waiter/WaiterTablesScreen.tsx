import { useState, useEffect, useCallback } from "react";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { useWaiter, PDVTable } from "../../hooks/usePdv";
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
  const [calls, setCalls] = useState<
    { id: string; table_id: string; created_at: string }[]
  >([]);
  const [calledTables, setCalledTables] = useState<Set<string>>(new Set());
  const [pulseBlink, setPulseBlink] = useState(false);

  // Busca chamadas de garçom não respondidas
  const fetchCalls = useCallback(async () => {
    if (!storeId) return;
    const tableIds =
      (
        await supabase.from("pdv_tables").select("id").eq("store_id", storeId)
      ).data?.map((t: any) => t.id) ?? [];
    const { data } = await supabase
      .from("pdv_table_calls")
      .select("id, table_id, created_at")
      .eq("answered", false)
      .in("table_id", tableIds)
      .order("created_at", { ascending: true });
    setCalls((data ?? []) as any[]);
    setCalledTables(new Set((data ?? []).map((c: any) => c.table_id)));
  }, [storeId]);

  // Busca mesas com itens prontos na cozinha
  const [readyByMap, setReadyByMap] = useState<Record<string, string>>({});

  const fetchReadyTables = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("pdv_order_items")
      .select(
        "order_id, ready_by, pdv_orders!pdv_order_items_order_id_fkey(table_id), profiles:ready_by(full_name)",
      )
      .eq("status", "ready");
    const tableIds = new Set<string>();
    const byMap: Record<string, string> = {};
    (data ?? []).forEach((d: any) => {
      const tableId = d.pdv_orders?.table_id;
      if (tableId) {
        tableIds.add(tableId);
        if (d.profiles?.full_name) byMap[tableId] = d.profiles.full_name;
      }
    });
    setReadyTables(tableIds);
    setReadyByMap(byMap);
  }, [storeId]);

  useEffect(() => {
    fetchReadyTables();
    fetchCalls();
    // Polling a cada 5s para garantir atualização em tempo real
    const interval = setInterval(() => {
      fetchReadyTables();
      fetchCalls();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchReadyTables, fetchCalls]);

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

  async function dismissCall(e: React.MouseEvent, tableId: string) {
    e.stopPropagation();
    await supabase
      .from("pdv_table_calls")
      .update({ answered: true })
      .eq("table_id", tableId)
      .eq("answered", false);
    setCalledTables((prev) => {
      const n = new Set(prev);
      n.delete(tableId);
      return n;
    });
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

      {/* Painel de chamadas */}
      {calls.length > 0 && (
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "12px 16px 0" }}
        >
          <div
            style={{
              background: "#fff0f0",
              border: "2px solid #ef4444",
              borderRadius: 14,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "8px 14px",
                background: "#ef4444",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                🛎️ Chamadas pendentes — {calls.length}
              </p>
            </div>
            {calls.map((call, idx) => {
              const table = tables.find((t) => t.id === call.table_id);
              if (!table) return null;
              const diff = Math.floor(
                (Date.now() - new Date(call.created_at).getTime()) / 1000,
              );
              const ago =
                diff < 60 ? `${diff}s` : `${Math.floor(diff / 60)}min`;
              return (
                <div
                  key={call.id}
                  style={{
                    padding: "8px 14px",
                    borderBottom:
                      idx < calls.length - 1 ? "1px solid #fecaca" : "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#ef4444",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>
                      {idx + 1}
                    </p>
                  </div>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#dc2626",
                      }}
                    >
                      {table.name ?? `Mesa ${table.number}`}
                    </p>
                    <p style={{ fontSize: 10, color: "#aaa" }}>há {ago}</p>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      onClick={() => navigate(`/waiter/table/${table.id}`)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#ef4444",
                        border: "none",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      Ir →
                    </button>
                    <button
                      onClick={(e) => dismissCall(e, table.id)}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 8,
                        background: "#fff",
                        border: "1px solid #ef4444",
                        color: "#ef4444",
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      ✓ OK
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
                        marginBottom: 4,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <div
                        style={{
                          background: pulseBlink ? "#ef4444" : "#dc2626",
                          borderRadius: 6,
                          padding: "2px 8px",
                          transition: "background 0.3s",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          🛎️ CHAMANDO!
                        </p>
                      </div>
                      <button
                        onClick={(e) => dismissCall(e, table.id)}
                        style={{
                          background: "#fff",
                          border: "1px solid #ef4444",
                          borderRadius: 6,
                          padding: "2px 8px",
                          color: "#ef4444",
                          fontSize: 8,
                          fontWeight: 700,
                          cursor: "pointer",
                          fontFamily: "'Space Grotesk', sans-serif",
                        }}
                      >
                        ✓ OK
                      </button>
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
                        {readyByMap[table.id]
                          ? ` · ${readyByMap[table.id].split(" ")[0]}`
                          : ""}
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
