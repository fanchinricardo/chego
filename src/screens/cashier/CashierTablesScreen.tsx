import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Spinner } from "../../components/ui";
import { PDVTable } from "../../hooks/usePdv";
import { printReceipt, ReceiptData } from "../../components/ThermalReceipt";
import Swal from "sweetalert2";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: string;
}

interface PDVOrder {
  id: string;
  total: number;
  pdv_order_items: OrderItem[];
}

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
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

export default function CashierTablesScreen() {
  const navigate = useNavigate();

  const { store } = useStore();

  useEffect(() => {
    if (!store?.id) return;
    supabase
      .from("store_invoices")
      .select("id")
      .eq("store_id", store.id)
      .eq("status", "overdue")
      .then(({ data }) => {
        if ((data?.length ?? 0) > 0)
          navigate("/store/billing", { replace: true });
      });
  }, [store?.id]);
  const { signOut } = useAuth();
  const storeId = store?.id ?? null;

  const [tables, setTables] = useState<PDVTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PDVTable | null>(null);
  const [order, setOrder] = useState<PDVOrder | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [pulseBlink, setPulseBlink] = useState(false);
  const [waitingTables, setWaitingTables] = useState<Set<string>>(new Set());

  const fetchTables = useCallback(async () => {
    console.log("[Caixa] storeId:", storeId, "store:", store?.id, store?.name);
    if (!storeId) return;
    const { data, error } = await supabase
      .from("pdv_tables")
      .select("*")
      .eq("store_id", storeId)
      .order("number");
    console.log("[Caixa] mesas:", data?.length, "error:", error?.message);
    setTables((data ?? []) as PDVTable[]);
    setLoading(false);
    const waiting = new Set<string>(
      (data ?? [])
        .filter((t: any) => t.status === "waiting_payment")
        .map((t: any) => t.id),
    );
    setWaitingTables(waiting);
  }, [storeId]);

  useEffect(() => {
    fetchTables();
    const interval = setInterval(fetchTables, 5000);
    return () => clearInterval(interval);
  }, [fetchTables]);

  useEffect(() => {
    if (waitingTables.size === 0) {
      setPulseBlink(false);
      return;
    }
    const t = setInterval(() => setPulseBlink((b) => !b), 600);
    return () => clearInterval(t);
  }, [waitingTables.size]);

  async function selectTable(table: PDVTable) {
    setSelected(table);
    setOrder(null);
    if (table.status === "available") return;
    setLoadingOrder(true);
    const { data: orderData } = await supabase
      .from("pdv_orders")
      .select("id, total")
      .eq("table_id", table.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (orderData) {
      const { data: items } = await supabase
        .from("pdv_order_items")
        .select("*")
        .eq("order_id", orderData.id)
        .order("created_at", { ascending: true });
      setOrder({ ...orderData, pdv_order_items: items ?? [] } as PDVOrder);
    }
    setLoadingOrder(false);
  }

  async function handleClose(tipAccepted: boolean) {
    if (!selected || !order) return;

    const tip = tipAccepted ? Math.round(order.total * 0.1 * 100) / 100 : 0;
    const total = Math.round((order.total + tip) * 100) / 100;

    // Seleciona método de pagamento
    const { value: method, isConfirmed } = await Swal.fire({
      title: "Forma de pagamento",
      input: "select",
      inputOptions: {
        dinheiro: "💵 Dinheiro",
        credito: "💳 Cartão Crédito",
        debito: "💳 Cartão Débito",
        pix: "⚡ Pix",
      },
      inputPlaceholder: "Selecione",
      showCancelButton: true,
      confirmButtonText: "Confirmar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#22c55e",
    });
    if (!isConfirmed) return;

    let changeAmount = 0;
    let amountPaid = total;
    if (method === "dinheiro") {
      const totalStr = total.toFixed(2);
      const { value: received, isConfirmed: confirmedPay } = await Swal.fire({
        title: "Valor recebido em dinheiro",
        html: `
          <p style="margin-bottom:10px;color:#666">Total a pagar: <strong>R$ ${totalStr}</strong></p>
          <p style="font-size:12px;color:#aaa;margin-bottom:6px">Digite o valor entregue pelo cliente</p>
          <input id="swal-valor" type="number" step="0.01" min="${totalStr}" value="${totalStr}"
            class="swal2-input" style="font-size:18px;font-weight:700"/>
          <p id="swal-troco" style="margin-top:10px;font-size:14px;color:#15803d;font-weight:600"></p>
        `,
        confirmButtonText: "Confirmar",
        confirmButtonColor: "#22c55e",
        showCancelButton: true,
        cancelButtonText: "Cancelar",
        didOpen: () => {
          const input = document.getElementById(
            "swal-valor",
          ) as HTMLInputElement;
          const trocoEl = document.getElementById("swal-troco")!;
          input.addEventListener("input", () => {
            const v = Number(input.value);
            if (v > total) {
              trocoEl.textContent = "Troco: R$ " + (v - total).toFixed(2);
            } else {
              trocoEl.textContent = "";
            }
          });
        },
        preConfirm: () => {
          const val = (
            document.getElementById("swal-valor") as HTMLInputElement
          )?.value;
          if (!val || Number(val) < total) {
            Swal.showValidationMessage("Valor mínimo: R$ " + totalStr);
            return false;
          }
          return val;
        },
      });
      if (!confirmedPay) return;
      if (received) {
        amountPaid = Number(received);
        const diffCents =
          Math.round(amountPaid * 100) - Math.round(total * 100);
        changeAmount = diffCents > 0 ? diffCents / 100 : 0;
      }
    }

    // Salva split e pagamento
    const { data: split } = await supabase
      .from("pdv_splits")
      .insert({
        order_id: order.id,
        person_label: "Total",
        total,
        paid: true,
        paid_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (split) {
      await supabase.from("pdv_payments").insert({
        order_id: order.id,
        split_id: split.id,
        method,
        amount: method === "dinheiro" ? amountPaid : total,
        change_amount: changeAmount,
      });
    }

    // Marca todos itens não entregues como served
    await supabase
      .from("pdv_order_items")
      .update({ status: "served" })
      .eq("order_id", order.id)
      .in("status", ["pending", "preparing", "ready"]);

    await supabase
      .from("pdv_orders")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", order.id);
    await supabase
      .from("pdv_tables")
      .update({
        status: "available",
        waiter_id: null,
        opened_at: null,
        pin: null,
        current_order_id: null,
      })
      .eq("id", selected.id);

    // Imprime cupom
    const receiptData: ReceiptData = {
      store: {
        name: store?.name ?? "",
        address: store?.address ?? null,
        city: store?.city ?? null,
        state: store?.state ?? null,
        phone: store?.phone ?? null,
      },
      items: order.pdv_order_items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        unit_price: Number(i.unit_price),
        total: Number(i.total_price),
        notes: i.notes,
      })),
      subtotal: order.total,
      tip: tip || null,
      total,
      payments: [
        {
          method,
          amount: method === "dinheiro" ? amountPaid : total,
          change: changeAmount > 0 ? changeAmount : undefined,
        },
      ],
      table: selected.name ?? `Mesa ${selected.number}`,
      type: "pdv",
      printed_at: new Date().toISOString(),
    };

    const { isConfirmed: shouldPrint } = await Swal.fire({
      title: "✅ Conta fechada!",
      text: "Deseja imprimir o cupom?",
      icon: "success",
      showCancelButton: true,
      confirmButtonText: "🖨️ Imprimir",
      cancelButtonText: "Não",
      confirmButtonColor: "#22c55e",
    });

    if (shouldPrint) printReceipt(receiptData);

    setSelected(null);
    setOrder(null);
    await fetchTables();
  }

  const counts = {
    available: tables.filter((t) => t.status === "available").length,
    occupied: tables.filter((t) => t.status === "occupied").length,
    waiting_payment: tables.filter((t) => t.status === "waiting_payment")
      .length,
  };

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
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            padding: "14px 20px 16px",
          }}
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
                🖥️ Caixa
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.35)",
                  marginTop: 2,
                }}
              >
                Fechamento de mesas
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => navigate("/cashier/pdv")}
                style={{
                  background: colors.rosa,
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                🏪 Balcão
              </button>
              <button
                onClick={() => navigate("/store")}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: "8px 14px",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ← Painel
              </button>
              <button
                onClick={signOut}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  padding: "8px 14px",
                  color: "rgba(255,255,255,0.6)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Sair
              </button>
            </div>
          </div>

          {/* Resumo */}
          <div style={{ display: "flex", gap: 8 }}>
            {[
              { label: "Livres", value: counts.available, color: "#22c55e" },
              { label: "Ocupadas", value: counts.occupied, color: colors.rosa },
              {
                label: "Conta",
                value: counts.waiting_payment,
                color: "#f59e0b",
              },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "rgba(255,255,255,0.07)",
                  borderRadius: 10,
                  padding: "8px 16px",
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

      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          gap: 16,
        }}
      >
        {/* Grid de mesas */}
        <div style={{ flex: 1 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Spinner color={colors.rosa} />
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
                gap: 10,
              }}
            >
              {tables.map((table) => {
                const cfg =
                  STATUS_CONFIG[table.status] ?? STATUS_CONFIG.available;
                const isWait = waitingTables.has(table.id);
                const isSel = selected?.id === table.id;
                return (
                  <div
                    key={table.id}
                    onClick={() => selectTable(table)}
                    style={{
                      background: isWait && pulseBlink ? "#fff8e6" : cfg.bg,
                      border: `2px solid ${isSel ? colors.noite : isWait ? (pulseBlink ? "#f59e0b" : "#fcd34d") : cfg.border}`,
                      borderRadius: 14,
                      padding: "14px 10px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "border-color 0.3s, background 0.3s",
                      opacity: table.status === "closed" ? 0.5 : 1,
                      boxShadow: isSel ? `0 0 0 3px ${colors.noite}` : "none",
                    }}
                  >
                    {isWait && (
                      <div
                        style={{
                          background: "#f59e0b",
                          borderRadius: 5,
                          padding: "1px 5px",
                          marginBottom: 4,
                          display: "inline-block",
                        }}
                      >
                        <p
                          style={{
                            fontSize: 8,
                            fontWeight: 700,
                            color: "#fff",
                          }}
                        >
                          CONTA
                        </p>
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: "'Righteous', cursive",
                        fontSize: 24,
                        color: cfg.text,
                        lineHeight: 1,
                      }}
                    >
                      {table.number}
                    </p>
                    {table.name && (
                      <p
                        style={{
                          fontSize: 9,
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
                        gap: 3,
                        marginTop: 6,
                      }}
                    >
                      <div
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: "50%",
                          background: cfg.dot,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 600,
                          color: cfg.text,
                        }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Painel lateral — comanda selecionada */}
        {selected && (
          <div
            style={{
              width: 320,
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              alignSelf: "flex-start",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>
                {selected.name ?? `Mesa ${selected.number}`}
              </p>
              <button
                onClick={() => setSelected(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#aaa",
                  fontSize: 18,
                  cursor: "pointer",
                }}
              >
                ×
              </button>
            </div>

            {selected.status === "available" ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>🪑</p>
                <p style={{ fontSize: 13, color: "#aaa" }}>Mesa livre</p>
              </div>
            ) : loadingOrder ? (
              <div style={{ textAlign: "center", padding: 20 }}>
                <Spinner color={colors.rosa} />
              </div>
            ) : order ? (
              <>
                {/* Itens */}
                <div
                  style={{
                    border: `1px solid ${colors.bordaLilas}`,
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "8px 12px",
                      background: colors.fundo,
                      borderBottom: `1px solid ${colors.bordaLilas}`,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#aaa",
                        textTransform: "uppercase",
                      }}
                    >
                      Comanda
                    </p>
                  </div>
                  {order.pdv_order_items.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: "8px 12px",
                        borderBottom: `1px solid ${colors.fundo}`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <p
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: colors.noite,
                          }}
                        >
                          {item.quantity}× {item.name}
                        </p>
                        {item.notes && (
                          <p
                            style={{
                              fontSize: 10,
                              color: "#aaa",
                              fontStyle: "italic",
                            }}
                          >
                            {item.notes}
                          </p>
                        )}
                      </div>
                      <p
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: colors.noite,
                        }}
                      >
                        R$ {Number(item.total_price).toFixed(2)}
                      </p>
                    </div>
                  ))}
                  <div
                    style={{
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      Subtotal
                    </p>
                    <p
                      style={{
                        fontFamily: "'Righteous', cursive",
                        fontSize: 18,
                        color: colors.rosa,
                      }}
                    >
                      R$ {Number(order.total).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Botões */}
                <button
                  onClick={async () => {
                    // Refetch itens para garantir dados atualizados
                    const { data: freshItems } = await supabase
                      .from("pdv_order_items")
                      .select("*")
                      .eq("order_id", order.id);
                    console.log("[Caixa] freshItems:", freshItems);
                    const currentItems = freshItems ?? order.pdv_order_items;

                    console.log(
                      "[Caixa] currentItems:",
                      currentItems?.map((i: any) => ({
                        name: i.name,
                        status: i.status,
                      })),
                    );
                    // Verifica itens pendentes/preparando
                    const pendingItems = currentItems.filter((i: any) =>
                      ["pending", "preparing"].includes(i.status),
                    );
                    if (pendingItems.length > 0) {
                      await Swal.fire({
                        title: "⚠️ Itens em preparo",
                        html: `<p>Ainda há <strong>${pendingItems.length} item(s)</strong> sendo preparado(s) ou aguardando a cozinha.</p><p style="margin-top:8px;color:#888;font-size:13px">Aguarde a cozinha marcar como pronto e o garçom confirmar a entrega.</p>`,
                        icon: "warning",
                        confirmButtonText: "Entendido",
                        confirmButtonColor: "#f59e0b",
                      });
                      return;
                    }
                    // Verifica itens prontos mas não entregues
                    const readyItems = currentItems.filter(
                      (i: any) => i.status === "ready",
                    );
                    if (readyItems.length > 0) {
                      const { isConfirmed } = await Swal.fire({
                        title: "⚠️ Itens prontos não entregues",
                        html: `<p>Há <strong>${readyItems.length} item(s)</strong> prontos que ainda não foram entregues ao cliente.</p><p style="margin-top:8px;color:#888;font-size:13px">Deseja fechar assim mesmo?</p>`,
                        icon: "warning",
                        showCancelButton: true,
                        confirmButtonText: "Fechar mesmo assim",
                        cancelButtonText: "Cancelar",
                        confirmButtonColor: "#f59e0b",
                      });
                      if (!isConfirmed) return;
                    }
                    Swal.fire({
                      title: "Gorjeta de 10%?",
                      html: `<p>Subtotal: <b>R$ ${Number(order.total).toFixed(2)}</b></p><p>Com gorjeta: <b>R$ ${(Number(order.total) * 1.1).toFixed(2)}</b></p>`,
                      showDenyButton: true,
                      showCancelButton: false,
                      confirmButtonText: "✓ Com gorjeta",
                      denyButtonText: "Sem gorjeta",
                      confirmButtonColor: "#f59e0b",
                      denyButtonColor: colors.noite,
                    }).then((result) => handleClose(result.isConfirmed));
                  }}
                  style={{
                    width: "100%",
                    padding: "13px",
                    borderRadius: 11,
                    background: "#22c55e",
                    color: "#fff",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  💰 Fechar conta
                </button>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <p style={{ fontSize: 13, color: "#aaa" }}>
                  Nenhuma comanda aberta
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
