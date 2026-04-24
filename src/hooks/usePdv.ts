import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface PDVTable {
  id: string;
  store_id: string;
  number: number;
  name: string | null;
  capacity: number;
  status: "available" | "occupied" | "waiting_payment" | "closed";
  waiter_id: string | null;
  opened_at: string | null;
  pin: string | null;
  profiles?: { full_name: string } | null;
}

export interface PDVOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  status: "pending" | "preparing" | "ready" | "served";
}

export interface PDVOrder {
  id: string;
  store_id: string;
  table_id: string;
  waiter_id: string | null;
  status: "open" | "closed" | "cancelled";
  total: number;
  notes: string | null;
  created_at: string;
  pdv_order_items?: PDVOrderItem[];
  pdv_tables?: PDVTable;
}

// ── Hook principal do garçom ──────────────────────────────────
export function useWaiter() {
  const { user, profile } = useAuth();
  const storeId = profile?.store_id ?? null;

  const [tables, setTables] = useState<PDVTable[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTables = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("pdv_tables")
      .select("*, profiles(full_name)")
      .eq("store_id", storeId)
      .order("number");
    setTables((data ?? []) as PDVTable[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchTables();
    if (!storeId) return;
    const channel = supabase
      .channel(`pdv-tables-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pdv_tables",
          filter: `store_id=eq.${storeId}`,
        },
        () => fetchTables(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTables, storeId]);

  async function openTable(tableId: string) {
    if (!user?.id || !storeId) return;
    const { data: order, error } = await supabase
      .from("pdv_orders")
      .insert({ store_id: storeId, table_id: tableId, waiter_id: user.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const pin = String(Math.floor(1000 + Math.random() * 9000));
    await supabase
      .from("pdv_tables")
      .update({
        status: "occupied",
        waiter_id: user.id,
        opened_at: new Date().toISOString(),
        pin,
        current_order_id: order.id,
      })
      .eq("id", tableId);
    return order;
  }

  async function requestBill(tableId: string) {
    await supabase
      .from("pdv_tables")
      .update({ status: "waiting_payment" })
      .eq("id", tableId);
    await fetchTables();
  }

  return { tables, loading, storeId, fetchTables, openTable, requestBill };
}

// ── Hook de comanda (pedido de uma mesa) ─────────────────────
export function usePDVOrder(tableId: string | null) {
  const { user } = useAuth();
  const [order, setOrder] = useState<PDVOrder | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    if (!tableId) return;
    const { data } = await supabase
      .from("pdv_orders")
      .select("*, pdv_order_items(*), pdv_tables(*)")
      .eq("table_id", tableId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setOrder(data as PDVOrder | null);
    setLoading(false);
  }, [tableId]);

  useEffect(() => {
    fetchOrder();
    if (!tableId) return;
    const channel = supabase
      .channel(`pdv-order-${tableId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pdv_order_items" },
        () => fetchOrder(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrder, tableId]);

  async function addItem(item: {
    product_id?: string;
    name: string;
    quantity: number;
    unit_price: number;
    notes?: string;
  }) {
    if (!order) throw new Error("Nenhuma comanda aberta");
    const total = item.quantity * item.unit_price;
    const { error } = await supabase.from("pdv_order_items").insert({
      order_id: order.id,
      product_id: item.product_id ?? null,
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: total,
      notes: item.notes ?? null,
    });
    if (error) throw new Error(error.message);
    // Atualiza total da comanda
    const newTotal = (order.total ?? 0) + total;
    await supabase
      .from("pdv_orders")
      .update({ total: newTotal })
      .eq("id", order.id);
    await fetchOrder();
  }

  async function removeItem(itemId: string) {
    if (!order) return;
    const item = order.pdv_order_items?.find((i) => i.id === itemId);
    if (!item) return;
    await supabase.from("pdv_order_items").delete().eq("id", itemId);
    const newTotal = Math.max(0, (order.total ?? 0) - item.total_price);
    await supabase
      .from("pdv_orders")
      .update({ total: newTotal })
      .eq("id", order.id);
    await fetchOrder();
  }

  async function updateItemQty(itemId: string, qty: number) {
    if (!order) return;
    const item = order.pdv_order_items?.find((i) => i.id === itemId);
    if (!item) return;
    if (qty <= 0) {
      await removeItem(itemId);
      return;
    }
    const newTotal = qty * item.unit_price;
    const diff = newTotal - item.total_price;
    await supabase
      .from("pdv_order_items")
      .update({ quantity: qty, total_price: newTotal })
      .eq("id", itemId);
    await supabase
      .from("pdv_orders")
      .update({ total: (order.total ?? 0) + diff })
      .eq("id", order.id);
    await fetchOrder();
  }

  return {
    order,
    loading,
    addItem,
    removeItem,
    updateItemQty,
    refetch: fetchOrder,
  };
}
