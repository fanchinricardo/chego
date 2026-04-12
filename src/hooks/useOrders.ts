import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "in_delivery"
  | "delivered"
  | "cancelled";

export interface OrderItem {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  products: { name: string; image_url: string | null };
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string; phone: string | null };
  order_items: OrderItem[];
}

export interface OrderStats {
  total: number;
  revenue: number;
  pending: number;
  preparing: number;
  ready: number;
}

export function useOrders(storeId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [stats, setStats] = useState<OrderStats>({
    total: 0,
    revenue: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    setError(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data, error: err } = await supabase
      .from("orders")
      .select(
        `
        *,
        profiles ( full_name, phone ),
        order_items (
          id, product_id, quantity, unit_price, total_price, notes,
          products ( name, image_url )
        )
      `,
      )
      .eq("store_id", storeId)
      .gte("created_at", today.toISOString())
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Order[];
    setOrders(list);

    // Calcula stats do dia
    const active = list.filter((o) => o.status !== "cancelled");
    setStats({
      total: active.length,
      revenue: active
        .filter((o) => o.payment_status === "paid")
        .reduce((s, o) => s + Number(o.total), 0),
      pending: list.filter((o) => ["pending", "confirmed"].includes(o.status))
        .length,
      preparing: list.filter((o) => o.status === "preparing").length,
      ready: list.filter((o) => ["ready", "in_delivery"].includes(o.status))
        .length,
    });

    setLoading(false);
  }, [storeId]);

  // Atualiza status de um pedido
  const updateStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);

      if (error) throw new Error(error.message);

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o)),
      );
    },
    [],
  );

  // Realtime: escuta novos pedidos e mudanças de status
  useEffect(() => {
    if (!storeId) return;
    fetchOrders();

    const channel = supabase
      .channel(`store-orders-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => fetchOrders(), // Re-busca quando qualquer mudança ocorrer
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchOrders]);

  return { orders, stats, loading, error, updateStatus, refetch: fetchOrders };
}
