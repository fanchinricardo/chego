import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { colors, Spinner } from "../../components/ui";

interface TableInfo {
  id: string;
  number: number;
  name: string | null;
  store_id: string;
  status: string;
  stores: { name: string; logo_url: string | null };
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: string;
}

export default function TablePublicScreen() {
  const { token } = useParams<{ token: string }>();

  const [table, setTable] = useState<TableInfo | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [called, setCalled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    loadTable();
  }, [token]);

  async function loadTable() {
    setLoading(true);
    // Busca mesa pelo qr_token
    const { data: t, error: e } = await supabase
      .from("pdv_tables")
      .select("id, number, name, store_id, status, stores(name, logo_url)")
      .eq("qr_token", token)
      .maybeSingle();

    if (e || !t) {
      setError("Mesa não encontrada");
      setLoading(false);
      return;
    }
    setTable(t as any);

    // Busca pedido aberto da mesa
    const { data: order } = await supabase
      .from("pdv_orders")
      .select("id")
      .eq("table_id", t.id)
      .eq("status", "open")
      .maybeSingle();

    if (order) {
      const { data: orderItems } = await supabase
        .from("pdv_order_items")
        .select("id, name, quantity, unit_price, total_price, notes, status")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true });
      setItems((orderItems ?? []) as OrderItem[]);
    }
    setLoading(false);
  }

  async function callWaiter() {
    if (!table || calling) return;
    setCalling(true);
    await supabase.from("pdv_table_calls").insert({
      table_id: table.id,
      type: "waiter",
      answered: false,
    });
    setCalled(true);
    setCalling(false);
    setTimeout(() => setCalled(false), 5000);
  }

  const total = items.reduce((s, i) => s + Number(i.total_price), 0);

  const STATUS_LABEL: Record<string, string> = {
    pending: "⏳ Aguardando",
    preparing: "👨‍🍳 Preparando",
    ready: "✅ Pronto",
    served: "✓ Entregue",
  };

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
          {(table as any)?.stores?.logo_url && (
            <img
              src={(table as any).stores.logo_url}
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                objectFit: "cover",
                marginBottom: 10,
              }}
            />
          )}
          <p
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 22,
              color: "#fff",
            }}
          >
            {(table as any)?.stores?.name ?? "Chegô"}
          </p>
          <p
            style={{
              fontSize: 13,
              color: "rgba(255,255,255,0.5)",
              marginTop: 4,
            }}
          >
            {table?.name ?? `Mesa ${table?.number}`}
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
