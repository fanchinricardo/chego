import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

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
  custom_name: string | null;
  products: { name: string; image_url: string | null };
}

export interface Order {
  id: string;
  store_id: string;
  customer_id: string;
  status: OrderStatus;
  payment_status: "pending" | "paid" | "failed" | "refunded";
  payment_method: string | null;
  delivery_type: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  delivery_address: string | null;
  delivery_lat: number | null;
  delivery_lng: number | null;
  notes: string | null;
  change_for: number | null;
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

    // Início do dia no horário LOCAL, convertido para UTC corretamente.
    // Usar setHours(0,0,0,0) em UTC causaria perda de pedidos no Brasil
    // (UTC-3): meia-noite local = 03:00 UTC, pedidos de 00h–02h59 sumiam.
    const now = new Date();
    const todayLocal = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      0,
      0,
      0,
      0,
    );

    const { data, error: err } = await supabase
      .from("orders")
      .select(
        `
        *,
        profiles ( full_name, phone ),
        order_items (
          id, product_id, quantity, unit_price, total_price, notes, custom_name,
          products ( name, image_url )
        )
      `,
      )
      .eq("store_id", storeId)
      .gte("created_at", todayLocal.toISOString())
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Order[];
    setOrders(list);

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
        () => fetchOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchOrders]);

  return { orders, stats, loading, error, updateStatus, refetch: fetchOrders };
}

// Hook específico para pedidos prontos (sem filtro de data — para criar rotas)
export function useReadyOrders(storeId: string | null) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("orders")
      .select(
        `
        *,
        profiles ( full_name, phone ),
        order_items ( id, product_id, quantity, unit_price, total_price, notes, custom_name,
          products ( name, image_url )
        )
      `,
      )
      .eq("store_id", storeId)
      .eq("status", "ready")
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        setOrders((data ?? []) as Order[]);
        setLoading(false);
      });
  }, [storeId]);

  return { orders, loading };
}
