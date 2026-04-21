import { useState } from "react";
import Swal from "sweetalert2";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { usePDVOrder } from "../../hooks/usePdv";
import { colors, Spinner, Toast } from "../../components/ui";

interface Payment {
  method: string;
  amount: number;
  change_amount: number;
}

interface Split {
  label: string;
  items: string[];
  total: number;
  paid: boolean;
  payments: Payment[];
}

const METHODS = [
  { key: "dinheiro", label: "💵 Dinheiro" },
  { key: "credito", label: "💳 Crédito" },
  { key: "debito", label: "💳 Débito" },
  { key: "pix", label: "⚡ Pix" },
];

export default function WaiterBillScreen() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { order, loading } = usePDVOrder(tableId ?? null);

  const [mode, setMode] = useState<"view" | "split_items" | "payment">("view");
  const [splitItemsStep, setSplitItemsStep] = useState<"select" | "pay">(
    "select",
  );
  const [splits, setSplits] = useState<Split[]>([]);
  const [activeSplit, setActiveSplit] = useState(0);
  const [nPeople, setNPeople] = useState(2);
  const [payMethod, setPayMethod] = useState("dinheiro");
  const [payAmount, setPayAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const [tipAccepted, setTipAccepted] = useState(false);
  const [pendingAction, setPendingAction] = useState("");
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  const items = order?.pdv_order_items ?? [];
  const baseTotal = order?.total ?? 0;
  const tipAmount = Math.round(baseTotal * 0.1 * 100) / 100;
  const total = tipAccepted
    ? Math.round((baseTotal + tipAmount) * 100) / 100
    : baseTotal;

  function getSplitPaid(s: Split) {
    return s.payments.reduce((sum, p) => sum + p.amount, 0);
  }
  function getSplitRemaining(s: Split) {
    return Math.max(0, s.total - getSplitPaid(s));
  }
  function isSplitDone(s: Split) {
    return getSplitPaid(s) >= s.total - 0.009;
  }
  function allPaid() {
    return splits.length > 0 && splits.every(isSplitDone);
  }
  function isLastUnpaid() {
    return (
      splits.filter((s, i) => i !== activeSplit && !isSplitDone(s)).length === 0
    );
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(",", ".");
    // Aceita apenas números e ponto decimal com até 2 casas
    if (raw !== "" && !/^\d*\.?\d{0,2}$/.test(raw)) return;
    setPayAmount(raw);
  }

  function handleNoSplit() {
    setShowTip(true);
    setPendingAction("nosplit");
  }

  function proceedWithAction(action: string, finalTotal: number) {
    if (action === "nosplit") {
      setSplits([
        {
          label: "Total",
          items: [],
          total: finalTotal,
          paid: false,
          payments: [],
        },
      ]);
      setActiveSplit(0);
      setPayAmount(finalTotal.toFixed(2));
      setMode("payment");
    } else if (action === "equal") {
      const perPerson = Math.floor((finalTotal / nPeople) * 100) / 100;
      const lastTotal =
        Math.round((finalTotal - perPerson * (nPeople - 1)) * 100) / 100;
      const newSplits = Array.from({ length: nPeople }, (_, i) => ({
        label: `Pessoa ${i + 1}`,
        items: [],
        total: i === nPeople - 1 ? lastTotal : perPerson,
        paid: false,
        payments: [],
      }));
      setSplits(newSplits);
      setActiveSplit(0);
      setPayAmount(perPerson.toFixed(2));
      setMode("payment");
    } else if (action === "items") {
      setSplits(
        Array.from({ length: nPeople }, (_, i) => ({
          label: `Pessoa ${i + 1}`,
          items: [],
          total: 0,
          paid: false,
          payments: [],
        })),
      );
      setActiveSplit(0);
      setMode("split_items");
    }
  }

  function handleSplitEqual() {
    setShowTip(true);
    setPendingAction("equal");
  }

  function initSplitItems() {
    setShowTip(true);
    setPendingAction("items");
  }

  function toggleItem(itemId: string) {
    setSplits((prev) =>
      prev.map((s, i) => {
        if (i !== activeSplit) return s;
        const has = s.items.includes(itemId);
        const newItems = has
          ? s.items.filter((x) => x !== itemId)
          : [...s.items, itemId];
        const newTotal = newItems.reduce((sum, id) => {
          const it = items.find((x) => x.id === id);
          return sum + (it ? Number(it.total_price) : 0);
        }, 0);
        return { ...s, items: newItems, total: newTotal };
      }),
    );
  }

  function getItemOwner(itemId: string) {
    const idx = splits.findIndex((s) => s.items.includes(itemId));
    return idx >= 0 ? splits[idx].label : null;
  }

  function confirmPayment(changeAmt = 0, abaterSaldo = false) {
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) {
      showToast("Digite um valor válido", "error");
      return;
    }

    setSplits((prev) => {
      const rem = getSplitRemaining(prev[activeSplit]);
      const diff = amount - rem;

      let updated = prev.map((s, i) => {
        if (i !== activeSplit) return s;
        return {
          ...s,
          payments: [
            ...s.payments,
            { method: payMethod, amount, change_amount: changeAmt },
          ],
        };
      });

      if (diff < -0.009 && !abaterSaldo) {
        const others = updated.filter(
          (s, i) => i !== activeSplit && !isSplitDone(s),
        );
        if (others.length > 0) {
          const extra =
            Math.round((Math.abs(diff) / others.length) * 100) / 100;
          let rem2 = Math.abs(diff);
          updated = updated.map((s, i) => {
            if (i === activeSplit || isSplitDone(s)) return s;
            const add =
              others.indexOf(s) === others.length - 1
                ? Math.round(rem2 * 100) / 100
                : extra;
            rem2 -= extra;
            return { ...s, total: Math.round((s.total + add) * 100) / 100 };
          });
        }
      }

      if (diff > 0.009 && abaterSaldo) {
        const others = updated.filter(
          (s, i) => i !== activeSplit && !isSplitDone(s),
        );
        if (others.length > 0) {
          const discount = Math.round((diff / others.length) * 100) / 100;
          let rem2 = diff;
          updated = updated.map((s, i) => {
            if (i === activeSplit || isSplitDone(s)) return s;
            const d =
              others.indexOf(s) === others.length - 1
                ? Math.round(rem2 * 100) / 100
                : discount;
            rem2 -= discount;
            return {
              ...s,
              total: Math.max(0, Math.round((s.total - d) * 100) / 100),
            };
          });
        }
      }

      const next = updated.findIndex(
        (s, i) => i !== activeSplit && !isSplitDone(s),
      );
      if (next >= 0) {
        setActiveSplit(next);
        setPayAmount(getSplitRemaining(updated[next]).toFixed(2));
      } else {
        setPayAmount("");
      }
      return updated;
    });

    if (changeAmt > 0) showToast(`Troco: R$ ${changeAmt.toFixed(2)}`);
    else if (abaterSaldo) showToast(`Saldo abatido entre os demais`);
    else showToast("Pagamento confirmado!");
  }

  async function handleClose() {
    if (!order || !tableId) return;
    const { isConfirmed } = await Swal.fire({
      title: "Fechar a conta?",
      text: "A mesa será liberada após o fechamento.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Sim, fechar",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#22c55e",
    });
    if (!isConfirmed) return;

    setSaving(true);
    try {
      for (const split of splits) {
        const { data: saved } = await supabase
          .from("pdv_splits")
          .insert({
            order_id: order.id,
            person_label: split.label,
            total: split.total,
            paid: true,
            paid_at: new Date().toISOString(),
          })
          .select()
          .single();
        if (saved) {
          for (const pay of split.payments) {
            await supabase.from("pdv_payments").insert({
              order_id: order.id,
              split_id: saved.id,
              method: pay.method,
              amount: pay.amount,
              change_amount: pay.change_amount,
            });
          }
        }
      }
      await supabase
        .from("pdv_orders")
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", order.id);
      await supabase
        .from("pdv_tables")
        .update({ status: "available", waiter_id: null, opened_at: null })
        .eq("id", tableId);

      await Swal.fire({
        title: "🎉 Pagamento concluído!",
        text: "A mesa foi liberada com sucesso.",
        icon: "success",
        confirmButtonText: "Ok",
        confirmButtonColor: "#22c55e",
      });
      navigate("/waiter");
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function renderPaymentForm() {
    if (!splits[activeSplit] || isSplitDone(splits[activeSplit])) return null;
    const rem = getSplitRemaining(splits[activeSplit]);
    const amt = parseFloat(payAmount) || 0;
    const diff = amt - rem;
    const last = isLastUnpaid();

    return (
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
            fontSize: 12,
            fontWeight: 700,
            color: "#aaa",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginBottom: 10,
          }}
        >
          Forma de pagamento
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 6,
            marginBottom: 12,
          }}
        >
          {METHODS.map((m) => (
            <button
              key={m.key}
              onClick={() => {
                setPayMethod(m.key);
                if (last && m.key !== "dinheiro") setPayAmount(rem.toFixed(2));
              }}
              style={{
                padding: "10px",
                borderRadius: 10,
                background:
                  payMethod === m.key ? colors.noite : colors.lilasClaro,
                color: payMethod === m.key ? "#fff" : "#7e22ce",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {last && payMethod !== "dinheiro" && (
          <div
            style={{
              background: colors.lilasClaro,
              borderRadius: 10,
              padding: "10px 14px",
              marginBottom: 8,
            }}
          >
            <p style={{ fontSize: 12, color: "#7e22ce" }}>
              💡 Valor fixado em R$ {rem.toFixed(2)}
            </p>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background:
              last && payMethod !== "dinheiro"
                ? colors.lilasClaro
                : colors.fundo,
            borderRadius: 10,
            padding: "12px 14px",
            border: `1px solid ${colors.bordaLilas}`,
            marginBottom: 12,
          }}
        >
          <span style={{ fontSize: 14, color: "#888" }}>R$</span>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            value={payAmount}
            readOnly={last && payMethod !== "dinheiro"}
            onChange={handleInputChange}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              fontSize: 16,
              fontWeight: 700,
              color: last && payMethod !== "dinheiro" ? "#aaa" : colors.noite,
              background: "none",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          />
          {!(last && payMethod !== "dinheiro") && (
            <button
              onClick={() => setPayAmount(rem.toFixed(2))}
              style={{
                background: colors.lilasClaro,
                border: "none",
                borderRadius: 8,
                padding: "4px 10px",
                color: "#7e22ce",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Valor exato
            </button>
          )}
        </div>
        {amt > 0 && diff > 0.009 && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                background: "#fff8e6",
                border: "1px solid #fcd34d",
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 8,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <p style={{ fontSize: 13, color: "#92400e" }}>Diferença</p>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#b45309" }}>
                R$ {diff.toFixed(2)}
              </p>
            </div>
            {payMethod === "dinheiro" ? (
              last ? (
                <button
                  onClick={() => confirmPayment(diff)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 11,
                    background: "#fff8e6",
                    border: "1px solid #fcd34d",
                    color: "#b45309",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  💵 Dar troco: R$ {diff.toFixed(2)}
                </button>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => confirmPayment(diff)}
                    style={{
                      padding: "10px",
                      borderRadius: 11,
                      background: "#fff8e6",
                      border: "1px solid #fcd34d",
                      color: "#b45309",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    💵 Dar troco
                    <br />
                    R$ {diff.toFixed(2)}
                  </button>
                  <button
                    onClick={() => confirmPayment(0, true)}
                    style={{
                      padding: "10px",
                      borderRadius: 11,
                      background: "#f0fdf4",
                      border: "1px solid #86efac",
                      color: "#15803d",
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    ✓ Abater no saldo
                    <br />
                    R$ {diff.toFixed(2)}
                  </button>
                </div>
              )
            ) : (
              <button
                onClick={() => confirmPayment(0, true)}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 11,
                  background: "#f0fdf4",
                  border: "1px solid #86efac",
                  color: "#15803d",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ✓ Confirmar e abater R$ {diff.toFixed(2)} no saldo
              </button>
            )}
          </div>
        )}
        {amt > 0 &&
          diff < -0.009 &&
          (last ? (
            <div>
              <div
                style={{
                  background: "#fff0f8",
                  border: `1px solid ${colors.rosa}`,
                  borderRadius: 10,
                  padding: "12px 14px",
                  marginBottom: 10,
                }}
              >
                <p
                  style={{ fontSize: 13, color: colors.rosa, fontWeight: 600 }}
                >
                  ⚠️ Valor insuficiente
                </p>
                <p style={{ fontSize: 12, color: colors.rosa, marginTop: 4 }}>
                  Última pessoa — mínimo R$ {rem.toFixed(2)}.
                </p>
              </div>
              <button
                onClick={() => setPayAmount(rem.toFixed(2))}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: 11,
                  background: colors.lilasClaro,
                  color: "#7e22ce",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Preencher valor mínimo (R$ {rem.toFixed(2)})
              </button>
            </div>
          ) : (
            <div>
              <div
                style={{
                  background: "#fff0f8",
                  border: `1px solid ${colors.rosa}`,
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 10,
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <p style={{ fontSize: 13, color: colors.rosa }}>
                  Ficará pendente
                </p>
                <p
                  style={{ fontSize: 15, fontWeight: 700, color: colors.rosa }}
                >
                  R$ {Math.abs(diff).toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => confirmPayment(0, false)}
                style={{
                  width: "100%",
                  padding: "14px",
                  borderRadius: 12,
                  background: colors.rosa,
                  color: "#fff",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ✓ Confirmar e dividir R$ {Math.abs(diff).toFixed(2)} entre os
                demais
              </button>
            </div>
          ))}
        {amt > 0 && Math.abs(diff) <= 0.009 && (
          <button
            onClick={() => confirmPayment(0)}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              background: colors.rosa,
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ✓ Confirmar pagamento
          </button>
        )}
      </div>
    );
  }

  if (loading)
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.fundo,
        }}
      >
        <Spinner color={colors.rosa} />
      </div>
    );

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 32,
      }}
    >
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "14px 20px 16px" }}
        >
          <button
            onClick={() =>
              mode === "view"
                ? navigate(`/waiter/table/${tableId}`)
                : setMode("view")
            }
            style={{
              background: "none",
              border: "none",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              cursor: "pointer",
              marginBottom: 8,
              padding: 0,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Voltar
          </button>
          <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
            Fechar conta
          </p>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 26,
              color: colors.rosa,
              marginTop: 4,
            }}
          >
            R$ {total.toFixed(2)}
          </p>
          {tipAccepted && (
            <p style={{ fontSize: 11, color: "#f59e0b", marginTop: 2 }}>
              Inclui gorjeta de 10% (R$ {tipAmount.toFixed(2)})
            </p>
          )}
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {mode === "view" && (
          <>
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
                  padding: "10px 14px",
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
                  Itens consumidos
                </p>
              </div>
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: "10px 14px",
                    borderBottom: `1px solid ${colors.fundo}`,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <p style={{ fontSize: 13, color: colors.noite }}>
                    {item.quantity}× {item.name}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
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
                  padding: "10px 14px",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                <p
                  style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}
                >
                  Total
                </p>
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 18,
                    color: colors.rosa,
                  }}
                >
                  R$ {total.toFixed(2)}
                </p>
              </div>
            </div>

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
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 12,
                }}
              >
                Como deseja pagar?
              </p>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 14,
                }}
              >
                <p style={{ fontSize: 13, color: colors.noite, flex: 1 }}>
                  Número de pessoas
                </p>
                <button
                  onClick={() => setNPeople((n) => Math.max(1, n - 1))}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: colors.lilasClaro,
                    border: "none",
                    color: colors.noite,
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  −
                </button>
                <span
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: colors.noite,
                    minWidth: 24,
                    textAlign: "center",
                  }}
                >
                  {nPeople}
                </span>
                <button
                  onClick={() => setNPeople((n) => n + 1)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: colors.rosa,
                    border: "none",
                    color: "#fff",
                    fontSize: 18,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  +
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  onClick={handleNoSplit}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: 11,
                    background: colors.noite,
                    color: "#fff",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  💰 Pagar tudo junto
                </button>
                {nPeople > 1 && (
                  <>
                    <button
                      onClick={handleSplitEqual}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 11,
                        background: colors.rosa,
                        color: "#fff",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      ÷ Dividir igualmente ({nPeople}× R${" "}
                      {(total / nPeople).toFixed(2)})
                    </button>
                    <button
                      onClick={initSplitItems}
                      style={{
                        width: "100%",
                        padding: "12px",
                        borderRadius: 11,
                        background: colors.lilasClaro,
                        color: "#7e22ce",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      🧾 Cada um paga o que consumiu
                    </button>
                  </>
                )}
              </div>
            </div>
          </>
        )}

        {mode === "split_items" && splitItemsStep === "select" && (
          <>
            {/* Seletor de pessoas */}
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {splits.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setActiveSplit(i)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 20,
                    background:
                      activeSplit === i
                        ? colors.rosa
                        : s.items.length > 0
                          ? "#f0fdf4"
                          : colors.lilasClaro,
                    color:
                      activeSplit === i
                        ? "#fff"
                        : s.items.length > 0
                          ? "#15803d"
                          : "#7e22ce",
                    border:
                      s.items.length > 0 && activeSplit !== i
                        ? "1px solid #86efac"
                        : "none",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {s.items.length > 0 ? "✓ " : ""}
                  {s.label} {s.total > 0 ? `· R$ ${s.total.toFixed(2)}` : ""}
                </button>
              ))}
            </div>

            {/* Lista de itens */}
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
                  padding: "10px 14px",
                  borderBottom: `1px solid ${colors.bordaLilas}`,
                }}
              >
                <p style={{ fontSize: 12, color: "#888" }}>
                  Selecione os itens de{" "}
                  <strong style={{ color: colors.noite }}>
                    {splits[activeSplit]?.label}
                  </strong>
                </p>
              </div>
              {items.map((item) => {
                const owner = getItemOwner(item.id);
                const isMine = splits[activeSplit]?.items.includes(item.id);
                const taken = owner && !isMine;
                return (
                  <div
                    key={item.id}
                    onClick={() => !taken && toggleItem(item.id)}
                    style={{
                      padding: "10px 14px",
                      borderBottom: `1px solid ${colors.fundo}`,
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      cursor: taken ? "default" : "pointer",
                      opacity: taken ? 0.4 : 1,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        border: `2px solid ${isMine ? colors.rosa : colors.bordaLilas}`,
                        background: isMine ? colors.rosa : "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isMine && (
                        <span style={{ color: "#fff", fontSize: 12 }}>✓</span>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: colors.noite }}>
                        {item.quantity}× {item.name}
                      </p>
                      {taken && (
                        <p style={{ fontSize: 10, color: "#aaa" }}>{owner}</p>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: colors.noite,
                      }}
                    >
                      R$ {Number(item.total_price).toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Aviso se não selecionou nada */}
            {splits[activeSplit]?.items.length === 0 && (
              <div
                style={{
                  background: "#fff8e6",
                  border: "1px solid #fcd34d",
                  borderRadius: 10,
                  padding: "10px 14px",
                }}
              >
                <p style={{ fontSize: 12, color: "#92400e" }}>
                  ⚠️ Selecione ao menos um item para{" "}
                  {splits[activeSplit]?.label}
                </p>
              </div>
            )}

            {/* Botões de navegação */}
            <div style={{ display: "flex", gap: 8 }}>
              {activeSplit > 0 && (
                <button
                  onClick={() => setActiveSplit(activeSplit - 1)}
                  style={{
                    flex: 1,
                    padding: "14px",
                    borderRadius: 13,
                    background: colors.lilasClaro,
                    color: "#7e22ce",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  ← Anterior
                </button>
              )}
              {activeSplit < splits.length - 1 ? (
                <button
                  onClick={() => {
                    if (splits[activeSplit].items.length === 0) {
                      showToast(
                        `Selecione os itens de ${splits[activeSplit].label}`,
                        "error",
                      );
                      return;
                    }
                    setActiveSplit(activeSplit + 1);
                  }}
                  style={{
                    flex: 2,
                    padding: "14px",
                    borderRadius: 13,
                    background:
                      splits[activeSplit]?.items.length === 0
                        ? "#ccc"
                        : colors.rosa,
                    color: "#fff",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      splits[activeSplit]?.items.length === 0
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Próxima pessoa →
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (splits[activeSplit].items.length === 0) {
                      showToast(
                        `Selecione os itens de ${splits[activeSplit].label}`,
                        "error",
                      );
                      return;
                    }
                    // Verifica itens não atribuídos
                    const unassigned = items.filter(
                      (it) => !getItemOwner(it.id),
                    );
                    if (unassigned.length > 0) {
                      showToast(
                        `${unassigned.length} item(ns) sem responsável`,
                        "error",
                      );
                      return;
                    }
                    setSplitItemsStep("pay");
                    setActiveSplit(0);
                    setPayAmount(getSplitRemaining(splits[0]).toFixed(2));
                  }}
                  style={{
                    flex: 2,
                    padding: "14px",
                    borderRadius: 13,
                    background:
                      splits[activeSplit]?.items.length === 0
                        ? "#ccc"
                        : "#22c55e",
                    color: "#fff",
                    border: "none",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor:
                      splits[activeSplit]?.items.length === 0
                        ? "not-allowed"
                        : "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Ir para pagamento →
                </button>
              )}
            </div>
          </>
        )}

        {mode === "split_items" && splitItemsStep === "pay" && (
          <>
            {/* Seletor de pessoas */}
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {splits.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveSplit(i);
                    setPayAmount(getSplitRemaining(s).toFixed(2));
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: isSplitDone(s) ? "1px solid #86efac" : "none",
                    background: isSplitDone(s)
                      ? "#f0fdf4"
                      : activeSplit === i
                        ? colors.rosa
                        : colors.lilasClaro,
                    color: isSplitDone(s)
                      ? "#15803d"
                      : activeSplit === i
                        ? "#fff"
                        : "#7e22ce",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {isSplitDone(s) ? "✓ " : ""}
                  {s.label} · R$ {s.total.toFixed(2)}
                </button>
              ))}
            </div>

            {/* Resumo */}
            {splits[activeSplit] && (
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 8,
                  }}
                >
                  {splits[activeSplit].label}
                </p>
                {splits[activeSplit].items.map((id) => {
                  const it = items.find((x) => x.id === id);
                  return it ? (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <p style={{ fontSize: 12, color: "#888" }}>
                        {it.quantity}× {it.name}
                      </p>
                      <p style={{ fontSize: 12, color: colors.noite }}>
                        R$ {Number(it.total_price).toFixed(2)}
                      </p>
                    </div>
                  ) : null;
                })}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: `1px solid ${colors.fundo}`,
                    marginTop: 4,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    Restante
                  </p>
                  <p
                    style={{
                      fontFamily: "'Righteous', cursive",
                      fontSize: 20,
                      color:
                        getSplitRemaining(splits[activeSplit]) > 0
                          ? colors.rosa
                          : "#22c55e",
                    }}
                  >
                    R$ {getSplitRemaining(splits[activeSplit]).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {/* Pagamento desta pessoa */}
            {splits[activeSplit] &&
              !isSplitDone(splits[activeSplit]) &&
              renderPaymentForm()}

            {allPaid() && (
              <button
                onClick={handleClose}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "15px",
                  borderRadius: 13,
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {saving ? "Fechando..." : "🎉 Confirmar e liberar mesa"}
              </button>
            )}
          </>
        )}

        {mode === "payment" && (
          <>
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {splits.map((s, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setActiveSplit(i);
                    setPayAmount(getSplitRemaining(s).toFixed(2));
                  }}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 20,
                    border: isSplitDone(s) ? "1px solid #86efac" : "none",
                    background: isSplitDone(s)
                      ? "#f0fdf4"
                      : activeSplit === i
                        ? colors.rosa
                        : colors.lilasClaro,
                    color: isSplitDone(s)
                      ? "#15803d"
                      : activeSplit === i
                        ? "#fff"
                        : "#7e22ce",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {isSplitDone(s) ? "✓ " : ""}
                  {s.label}
                </button>
              ))}
            </div>

            {splits[activeSplit] && (
              <div
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "14px 16px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 8,
                  }}
                >
                  <p style={{ fontSize: 13, color: "#888" }}>Total</p>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    R$ {splits[activeSplit].total.toFixed(2)}
                  </p>
                </div>
                {splits[activeSplit].payments.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 6,
                    }}
                  >
                    <p style={{ fontSize: 12, color: "#888" }}>
                      {METHODS.find((m) => m.key === p.method)?.label}
                    </p>
                    <p style={{ fontSize: 12, color: colors.noite }}>
                      R$ {p.amount.toFixed(2)}
                      {p.change_amount > 0 && (
                        <span style={{ color: "#f59e0b" }}>
                          {" "}
                          (troco R$ {p.change_amount.toFixed(2)})
                        </span>
                      )}
                    </p>
                  </div>
                ))}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: 8,
                    borderTop: `1px solid ${colors.fundo}`,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    Restante
                  </p>
                  <p
                    style={{
                      fontFamily: "'Righteous', cursive",
                      fontSize: 20,
                      color:
                        getSplitRemaining(splits[activeSplit]) > 0
                          ? colors.rosa
                          : "#22c55e",
                    }}
                  >
                    R$ {getSplitRemaining(splits[activeSplit]).toFixed(2)}
                  </p>
                </div>
              </div>
            )}

            {splits[activeSplit] && !isSplitDone(splits[activeSplit]) && (
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
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                  }}
                >
                  Forma de pagamento
                </p>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  {METHODS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => {
                        setPayMethod(m.key);
                        // Se é última pessoa e método não é dinheiro, força valor exato
                        if (
                          isLastUnpaid() &&
                          m.key !== "dinheiro" &&
                          splits[activeSplit]
                        ) {
                          setPayAmount(
                            getSplitRemaining(splits[activeSplit]).toFixed(2),
                          );
                        }
                      }}
                      style={{
                        padding: "10px",
                        borderRadius: 10,
                        background:
                          payMethod === m.key
                            ? colors.noite
                            : colors.lilasClaro,
                        color: payMethod === m.key ? "#fff" : "#7e22ce",
                        border: "none",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

                {isLastUnpaid() && payMethod !== "dinheiro" && (
                  <div
                    style={{
                      background: colors.lilasClaro,
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 8,
                    }}
                  >
                    <p style={{ fontSize: 12, color: "#7e22ce" }}>
                      💡 Valor fixado em R${" "}
                      {getSplitRemaining(splits[activeSplit]).toFixed(2)} — só é
                      editável com pagamento em dinheiro.
                    </p>
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background:
                      isLastUnpaid() && payMethod !== "dinheiro"
                        ? colors.lilasClaro
                        : colors.fundo,
                    borderRadius: 10,
                    padding: "12px 14px",
                    border: `1px solid ${colors.bordaLilas}`,
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontSize: 14, color: "#888" }}>R$</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={payAmount}
                    readOnly={isLastUnpaid() && payMethod !== "dinheiro"}
                    onChange={handleInputChange}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontSize: 16,
                      fontWeight: 700,
                      color:
                        isLastUnpaid() && payMethod !== "dinheiro"
                          ? "#aaa"
                          : colors.noite,
                      background: "none",
                      fontFamily: "'Space Grotesk', sans-serif",
                      cursor:
                        isLastUnpaid() && payMethod !== "dinheiro"
                          ? "default"
                          : "text",
                    }}
                  />
                  {!(isLastUnpaid() && payMethod !== "dinheiro") && (
                    <button
                      onClick={() =>
                        setPayAmount(
                          getSplitRemaining(splits[activeSplit]).toFixed(2),
                        )
                      }
                      style={{
                        background: colors.lilasClaro,
                        border: "none",
                        borderRadius: 8,
                        padding: "4px 10px",
                        color: "#7e22ce",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Valor exato
                    </button>
                  )}
                </div>

                {(() => {
                  const amt = parseFloat(payAmount) || 0;
                  const rem = getSplitRemaining(splits[activeSplit]);
                  const diff = amt - rem;
                  const last = isLastUnpaid();

                  if (amt <= 0) return null;

                  if (diff > 0.009)
                    return (
                      <div>
                        <div
                          style={{
                            background: "#fff8e6",
                            border: "1px solid #fcd34d",
                            borderRadius: 10,
                            padding: "10px 14px",
                            marginBottom: 10,
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <p style={{ fontSize: 13, color: "#92400e" }}>
                            Diferença
                          </p>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: "#b45309",
                            }}
                          >
                            R$ {diff.toFixed(2)}
                          </p>
                        </div>
                        {payMethod === "dinheiro" ? (
                          last ? (
                            // Última pessoa + dinheiro — só troco
                            <button
                              onClick={() => confirmPayment(diff)}
                              style={{
                                width: "100%",
                                padding: "12px",
                                borderRadius: 11,
                                background: "#fff8e6",
                                border: "1px solid #fcd34d",
                                color: "#b45309",
                                fontSize: 13,
                                fontWeight: 700,
                                cursor: "pointer",
                                fontFamily: "'Space Grotesk', sans-serif",
                              }}
                            >
                              💵 Dar troco: R$ {diff.toFixed(2)}
                            </button>
                          ) : (
                            // Outras pessoas + dinheiro — troco ou abater
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                              }}
                            >
                              <button
                                onClick={() => confirmPayment(diff)}
                                style={{
                                  padding: "10px",
                                  borderRadius: 11,
                                  background: "#fff8e6",
                                  border: "1px solid #fcd34d",
                                  color: "#b45309",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                }}
                              >
                                💵 Dar troco
                                <br />
                                R$ {diff.toFixed(2)}
                              </button>
                              <button
                                onClick={() => confirmPayment(0, true)}
                                style={{
                                  padding: "10px",
                                  borderRadius: 11,
                                  background: "#f0fdf4",
                                  border: "1px solid #86efac",
                                  color: "#15803d",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  fontFamily: "'Space Grotesk', sans-serif",
                                }}
                              >
                                ✓ Abater no saldo
                                <br />
                                R$ {diff.toFixed(2)}
                              </button>
                            </div>
                          )
                        ) : (
                          // Outros métodos — abate automaticamente no saldo restante
                          <button
                            onClick={() => confirmPayment(0, true)}
                            style={{
                              width: "100%",
                              padding: "12px",
                              borderRadius: 11,
                              background: "#f0fdf4",
                              border: "1px solid #86efac",
                              color: "#15803d",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: "pointer",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            ✓ Confirmar e abater R$ {diff.toFixed(2)} no saldo
                          </button>
                        )}
                      </div>
                    );

                  if (diff < -0.009)
                    return last ? (
                      <div>
                        <div
                          style={{
                            background: "#fff0f8",
                            border: `1px solid ${colors.rosa}`,
                            borderRadius: 10,
                            padding: "12px 14px",
                            marginBottom: 10,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 13,
                              color: colors.rosa,
                              fontWeight: 600,
                            }}
                          >
                            ⚠️ Valor insuficiente
                          </p>
                          <p
                            style={{
                              fontSize: 12,
                              color: colors.rosa,
                              marginTop: 4,
                            }}
                          >
                            Última pessoa — mínimo R$ {rem.toFixed(2)}.
                          </p>
                        </div>
                        <button
                          onClick={() => setPayAmount(rem.toFixed(2))}
                          style={{
                            width: "100%",
                            padding: "12px",
                            borderRadius: 11,
                            background: colors.lilasClaro,
                            color: "#7e22ce",
                            border: "none",
                            fontSize: 13,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          Preencher valor mínimo (R$ {rem.toFixed(2)})
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div
                          style={{
                            background: "#fff0f8",
                            border: `1px solid ${colors.rosa}`,
                            borderRadius: 10,
                            padding: "10px 14px",
                            marginBottom: 10,
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <p style={{ fontSize: 13, color: colors.rosa }}>
                            Ficará pendente
                          </p>
                          <p
                            style={{
                              fontSize: 15,
                              fontWeight: 700,
                              color: colors.rosa,
                            }}
                          >
                            R$ {Math.abs(diff).toFixed(2)}
                          </p>
                        </div>
                        <button
                          onClick={() => confirmPayment(0, false)}
                          style={{
                            width: "100%",
                            padding: "14px",
                            borderRadius: 12,
                            background: colors.rosa,
                            color: "#fff",
                            border: "none",
                            fontSize: 15,
                            fontWeight: 700,
                            cursor: "pointer",
                            fontFamily: "'Space Grotesk', sans-serif",
                          }}
                        >
                          ✓ Confirmar e dividir R$ {Math.abs(diff).toFixed(2)}{" "}
                          entre os demais
                        </button>
                      </div>
                    );

                  return (
                    <button
                      onClick={() => confirmPayment(0)}
                      style={{
                        width: "100%",
                        padding: "14px",
                        borderRadius: 12,
                        background: colors.rosa,
                        color: "#fff",
                        border: "none",
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: "pointer",
                        fontFamily: "'Space Grotesk', sans-serif",
                      }}
                    >
                      ✓ Confirmar pagamento
                    </button>
                  );
                })()}
              </div>
            )}

            {allPaid() && (
              <button
                onClick={handleClose}
                disabled={saving}
                style={{
                  width: "100%",
                  padding: "15px",
                  borderRadius: 13,
                  background: "#22c55e",
                  color: "#fff",
                  border: "none",
                  fontSize: 15,
                  fontWeight: 700,
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {saving ? "Fechando..." : "🎉 Confirmar e liberar mesa"}
              </button>
            )}
          </>
        )}
      </div>

      {showTip && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 300,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              padding: "24px 20px 32px",
            }}
          >
            <p
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 4,
              }}
            >
              Gorjeta de 10%?
            </p>
            <p style={{ fontSize: 13, color: "#888", marginBottom: 20 }}>
              Deseja adicionar 10% de gorjeta ao total?
            </p>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 20,
                background: colors.fundo,
                borderRadius: 12,
                padding: "12px 16px",
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>
                  Subtotal
                </p>
                <p
                  style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}
                >
                  R$ {baseTotal.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>
                  Gorjeta (10%)
                </p>
                <p style={{ fontSize: 16, fontWeight: 700, color: "#f59e0b" }}>
                  R$ {tipAmount.toFixed(2)}
                </p>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 11, color: "#aaa", marginBottom: 2 }}>
                  Total c/ gorjeta
                </p>
                <p
                  style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}
                >
                  R${" "}
                  {Math.round((baseTotal + tipAmount) * 100) / (100).toFixed(2)}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  setTipAccepted(false);
                  setShowTip(false);
                  proceedWithAction(pendingAction, baseTotal);
                }}
                style={{
                  flex: 1,
                  padding: "13px",
                  borderRadius: 11,
                  background: colors.lilasClaro,
                  color: "#7e22ce",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Não, obrigado
              </button>
              <button
                onClick={() => {
                  setTipAccepted(true);
                  setShowTip(false);
                  proceedWithAction(
                    pendingAction,
                    Math.round((baseTotal + tipAmount) * 100) / 100,
                  );
                }}
                style={{
                  flex: 1,
                  padding: "13px",
                  borderRadius: 11,
                  background: "#f59e0b",
                  color: "#fff",
                  border: "none",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                ✓ Sim, adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
