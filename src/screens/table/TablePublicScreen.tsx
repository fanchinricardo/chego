import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { colors, Spinner } from "../../components/ui";

const pub = createClient(
  import.meta.env.VITE_SUPABASE_URL as string,
  import.meta.env.VITE_SUPABASE_ANON_KEY as string,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "⏳ Aguardando",
  preparing: "👨‍🍳 Preparando",
  ready: "✅ Pronto",
  served: "✓ Entregue",
};

export default function TablePublicScreen() {
  const { token } = useParams<{ token: string }>();

  const [step, setStep] = useState<"pin" | "view">("pin");
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");
  const [checking, setChecking] = useState(false);

  const [tableName, setTableName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [tableId, setTableId] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);

  async function checkPin() {
    if (pinInput.length !== 4) {
      setPinError("Digite 4 dígitos");
      return;
    }
    setChecking(true);
    setPinError("");

    const { data: table } = await pub
      .from("pdv_tables")
      .select("id, number, name, status, pin, current_order_id, stores(name)")
      .eq("qr_token", token)
      .maybeSingle();

    if (!table) {
      setPinError("Mesa não encontrada");
      setChecking(false);
      return;
    }

    if (table.status === "available" || table.status === "closed") {
      setPinError("Esta mesa está fechada no momento");
      setChecking(false);
      return;
    }

    if (!table.pin || table.pin !== pinInput) {
      setPinError("PIN incorreto. Solicite ao garçom.");
      setChecking(false);
      return;
    }

    // PIN correto — salva order_id e carrega dados
    setTableId(table.id);
    setTableName(table.name ?? `Mesa ${table.number}`);
    setStoreName((table as any).stores?.name ?? "");
    await loadItems(table.id, table.current_order_id);
    setStep("view");
    setChecking(false);
  }

  async function loadItems(tid: string, orderId?: string) {
    setLoading(true);

    let orderIds: string[] = [];

    if (orderId) {
      // Usa o order_id vinculado ao PIN
      orderIds = [orderId];
    } else {
      // Fallback — busca pedido aberto da mesa
      const { data: orders } = await pub
        .from("pdv_orders")
        .select("id")
        .eq("table_id", tid)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1);
      orderIds = (orders ?? []).map((o: any) => o.id);
    }

    if (orderIds.length === 0) {
      setLoading(false);
      return;
    }

    const { data: orderItems } = await pub
      .from("pdv_order_items")
      .select("id, name, quantity, unit_price, total_price, notes, status")
      .in("order_id", orderIds)
      .order("created_at", { ascending: true });

    setItems((orderItems ?? []) as OrderItem[]);
    setLoading(false);
  }

  async function callWaiter() {
    if (!tableId || calling || called) return;
    setCalling(true);
    await pub
      .from("pdv_table_calls")
      .insert({ table_id: tableId, type: "waiter", answered: false });
    setCalled(true);
    setCalling(false);
    setTimeout(() => setCalled(false), 5000);
  }

  const total = items.reduce((s, i) => s + Number(i.total_price), 0);

  // ── Tela de PIN ──────────────────────────────────────
  if (step === "pin")
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.fundo,
          padding: 20,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔐</p>
          <p
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: colors.noite,
              marginBottom: 6,
            }}
          >
            Acesso à mesa
          </p>
          <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>
            Digite o PIN de 4 dígitos fornecido pelo garçom
          </p>

          {/* Input PIN */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 10,
              marginBottom: 20,
            }}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  width: 52,
                  height: 64,
                  borderRadius: 12,
                  border: `2px solid ${pinInput.length > i ? colors.rosa : colors.bordaLilas}`,
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 28,
                    color: colors.noite,
                  }}
                >
                  {pinInput[i] ? "●" : ""}
                </p>
              </div>
            ))}
          </div>

          {/* Teclado numérico */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
              marginBottom: 16,
            }}
          >
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(
              (k) => (
                <button
                  key={k}
                  disabled={!k}
                  onClick={() => {
                    if (k === "⌫") {
                      setPinInput((p) => p.slice(0, -1));
                      setPinError("");
                    } else if (k && pinInput.length < 4) {
                      setPinInput((p) => p + k);
                      setPinError("");
                    }
                  }}
                  style={{
                    padding: "16px",
                    borderRadius: 12,
                    background:
                      k === "⌫"
                        ? colors.lilasClaro
                        : k
                          ? "#fff"
                          : "transparent",
                    border:
                      k && k !== "⌫"
                        ? `1px solid ${colors.bordaLilas}`
                        : "none",
                    fontSize: k === "⌫" ? 20 : 22,
                    fontWeight: 700,
                    color: colors.noite,
                    cursor: k ? "pointer" : "default",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  {k}
                </button>
              ),
            )}
          </div>

          {pinError && (
            <p style={{ fontSize: 12, color: colors.rosa, marginBottom: 12 }}>
              {pinError}
            </p>
          )}

          <button
            onClick={checkPin}
            disabled={checking || pinInput.length !== 4}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 12,
              background: pinInput.length === 4 ? colors.rosa : "#ccc",
              color: "#fff",
              border: "none",
              fontSize: 15,
              fontWeight: 700,
              cursor: pinInput.length === 4 ? "pointer" : "default",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {checking ? "Verificando..." : "Entrar"}
          </button>
        </div>
      </div>
    );

  // ── Tela de consumo ──────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 32,
      }}
    >
      <div style={{ background: colors.noite, padding: "20px 20px 24px" }}>
        <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center" }}>
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 22,
              color: "#fff",
            }}
          >
            {storeName}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
            }}
          >
            {tableName}
          </p>
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
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "32px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>🍽️</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhum item ainda
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
              Seus pedidos aparecerão aqui
            </p>
          </div>
        ) : (
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
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Sua comanda
              </p>
            </div>
            {items.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 14px",
                  borderBottom: `1px solid ${colors.fundo}`,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: colors.noite,
                    }}
                  >
                    {item.quantity}× {item.name}
                  </p>
                  {item.notes && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "#aaa",
                        fontStyle: "italic",
                      }}
                    >
                      {item.notes}
                    </p>
                  )}
                  <p style={{ fontSize: 10, color: "#aaa", marginTop: 2 }}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </p>
                </div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.noite,
                    flexShrink: 0,
                  }}
                >
                  R$ {Number(item.total_price).toFixed(2)}
                </p>
              </div>
            ))}
            <div
              style={{
                padding: "12px 14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
                Total até agora
              </p>
              <p
                style={{
                  fontFamily: "'Righteous', cursive",
                  fontSize: 22,
                  color: colors.rosa,
                }}
              >
                R$ {total.toFixed(2)}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={callWaiter}
          disabled={calling || called}
          style={{
            width: "100%",
            padding: "16px",
            borderRadius: 14,
            background: called ? "#22c55e" : calling ? "#ccc" : colors.noite,
            color: "#fff",
            border: "none",
            fontSize: 16,
            fontWeight: 700,
            cursor: calling || called ? "default" : "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
            transition: "background 0.3s",
          }}
        >
          {called
            ? "✓ Garçom chamado!"
            : calling
              ? "Chamando..."
              : "🛎️ Chamar garçom"}
        </button>

        <p style={{ fontSize: 11, color: "#aaa", textAlign: "center" }}>
          Toque para chamar o garçom. Ele será notificado imediatamente.
        </p>
      </div>
    </div>
  );
}
