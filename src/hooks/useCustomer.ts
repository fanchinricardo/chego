import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface StoreGroup {
  id: string;
  name: string;
  icon: string | null;
}

export interface StorePublic {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  open_now: boolean;
  min_order_value: number;
  delivery_fee: number;
  estimated_time: number | null;
  address: string;
  city: string;
  store_groups: { name: string; icon: string | null };
}

export interface ProductPublic {
  id: string;
  store_id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
}

// Hook: lista de comércios com filtro por grupo e busca
export function useCustomerStores(groupId?: string, search?: string) {
  const [stores, setStores] = useState<StorePublic[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStores = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from("stores")
      .select("*, store_groups(name, icon)")
      .eq("active", true)
      .order("open_now", { ascending: false })
      .order("name");

    if (groupId) query = query.eq("group_id", groupId);

    if (search?.trim()) {
      query = query.ilike("name", `%${search.trim()}%`);
    }

    const { data } = await query;
    setStores((data ?? []) as StorePublic[]);
    setLoading(false);
  }, [groupId, search]);

  useEffect(() => {
    fetchStores();
  }, [fetchStores]);

  return { stores, loading, refetch: fetchStores };
}

// Hook: grupos de comércio
export function useStoreGroups() {
  const [groups, setGroups] = useState<StoreGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("store_groups")
      .select("id, name, icon")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => {
        setGroups((data ?? []) as StoreGroup[]);
        setLoading(false);
      });
  }, []);

  return { groups, loading };
}

// Hook: produtos de um comércio
export function useStoreProducts(storeId: string | null) {
  const [products, setProducts] = useState<ProductPublic[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("category")
      .order("sort_order")
      .then(({ data }) => {
        const list = (data ?? []) as ProductPublic[];
        setProducts(list);
        setCategories([...new Set(list.map((p) => p.category))].sort());
        setLoading(false);
      });
  }, [storeId]);

  return { products, categories, loading };
}

// Hook: dados de um comércio específico
export function useStoreDetail(storeId: string | null) {
  const [store, setStore] = useState<StorePublic | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    supabase
      .from("stores")
      .select("*, store_groups(name, icon)")
      .eq("id", storeId)
      .single()
      .then(({ data }) => {
        setStore(data as StorePublic);
        setLoading(false);
      });
  }, [storeId]);

  return { store, loading };
}

// Hook: pedidos do cliente com realtime
export function useCustomerOrders(customerId: string | null) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!customerId) return;
    const { data } = await supabase
      .from("orders")
      .select(
        `
        *,
        stores ( name, logo_url ),
        order_items ( quantity, unit_price, products(name) )
      `,
      )
      .eq("customer_id", customerId)
      .order("created_at", { ascending: false })
      .limit(20);

    setOrders(data ?? []);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchOrders();
    if (!customerId) return;

    const channel = supabase
      .channel(`customer-orders-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `customer_id=eq.${customerId}`,
        },
        () => fetchOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, fetchOrders]);

  return { orders, loading, refetch: fetchOrders };
}

// Hook: endereços do cliente
export function useCustomerAddresses(customerId: string | null) {
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAddresses = useCallback(async () => {
    if (!customerId) return;
    const { data } = await supabase
      .from("customer_addresses")
      .select("*")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false });

    setAddresses(data ?? []);
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchAddresses();
  }, [fetchAddresses]);

  async function addAddress(payload: {
    label: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    complement?: string;
    lat?: number;
    lng?: number;
    is_default?: boolean;
  }) {
    if (!customerId) return;
    await supabase.from("customer_addresses").insert({
      ...payload,
      customer_id: customerId,
    });
    fetchAddresses();
  }

  async function setDefault(id: string) {
    if (!customerId) return;
    await supabase
      .from("customer_addresses")
      .update({ is_default: false })
      .eq("customer_id", customerId);
    await supabase
      .from("customer_addresses")
      .update({ is_default: true })
      .eq("id", id);
    fetchAddresses();
  }

  return {
    addresses,
    loading,
    addAddress,
    setDefault,
    refetch: fetchAddresses,
  };
}
