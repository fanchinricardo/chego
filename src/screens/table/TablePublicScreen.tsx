import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { colors, Spinner } from "../../components/ui";

// Client público sem sessão
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

  const [tableName, setTableName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionInvalid, setSessionInvalid] = useState(false);
  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);
  const [tableId, setTableId] = useState("");

  useEffect(() => {
    if (token) load();
  }, [token]);

  async function load() {
    setLoading(true);

    // 1. Busca mesa
    const { data: table, error: e1 } = await pub
      .from("pdv_tables")
      .select("id, number, name, status, opened_at, stores(name)")
      .eq("qr_token", token)
      .maybeSingle();

    if (e1 || !table) {
      setError("Mesa não encontrada");
      setLoading(false);
      return;
    }

    // 2. Verifica se mesa está ocupada
    if (table.status === "available" || table.status === "closed") {
      setSessionInvalid(true);
      setLoading(false);
      return;
    }

    // 3. Valida sessão
    const sessionKey = `mesa_${table.id}_${table.opened_at}`;
    const stored = localStorage.getItem(`mesa_session_${table.id}`);
    if (stored && stored !== sessionKey) {
      setSessionInvalid(true);
      setLoading(false);
      return;
    }
    localStorage.setItem(`mesa_session_${table.id}`, sessionKey);

    setTableId(table.id);
    setTableName(table.name ?? `Mesa ${table.number}`);
    setStoreName((table as any).stores?.name ?? "");

    // 4. Busca pedidos abertos
    const { data: orders } = await pub
      .from("pdv_orders")
      .select("id")
      .eq("table_id", table.id)
      .eq("status", "open");

    if (!orders || orders.length === 0) {
      setLoading(false);
      return;
    }

    const orderIds = orders.map((o: any) => o.id);

    // 5. Busca itens
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

  if (sessionInvalid)
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.fundo,
          padding: 20,
        }}
      >
        <div style={{ textAlign: "center", maxWidth: 300 }}>
          <p style={{ fontSize: 48, marginBottom: 16 }}>🔒</p>
          <p
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.noite,
              marginBottom: 8,
            }}
          >
            Sessão expirada
          </p>
          <p style={{ fontSize: 13, color: "#888", lineHeight: 1.6 }}>
            Esta mesa foi reaberta. Escaneie o QR Code novamente para iniciar
            uma nova sessão.
          </p>
        </div>
      </div>
    );

  if (error)
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.fundo,
          padding: 20,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>❌</p>
          <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>
            {error}
          </p>
        </div>
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
      {/* Header */}
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
        {/* Consumo */}
        {items.length === 0 ? (
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

        {/* Botão chamar garçom */}
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
