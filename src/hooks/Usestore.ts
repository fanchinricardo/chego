import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export interface Store {
  id: string;
  owner_id: string;
  group_id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  phone: string | null;
  whatsapp: string | null;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  lat: number | null;
  lng: number | null;
  active: boolean;
  open_now: boolean;
  min_order_value: number;
  delivery_fee: number;
  estimated_time: number | null;
  signup_paid: boolean;
  store_groups: { name: string; icon: string | null };
}

export function useStore() {
  const { user } = useAuth();
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStore = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .from("stores")
      .select("*, store_groups(name, icon)")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setStore(data as Store);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchStore();
  }, [fetchStore]);

  // ── Toggle aberto/fechado ─────────────────────────────────
  async function toggleOpen(open: boolean) {
    if (!store) return;
    await supabase.from("stores").update({ open_now: open }).eq("id", store.id);
    setStore((prev) => (prev ? { ...prev, open_now: open } : prev));
  }

  // ── Atualizar dados da loja ───────────────────────────────
  async function updateStore(payload: Partial<Store>) {
    if (!store) return;
    const { error } = await supabase
      .from("stores")
      .update(payload)
      .eq("id", store.id);

    if (error) throw new Error(error.message);
    setStore((prev) => (prev ? { ...prev, ...payload } : prev));
  }

  return {
    store,
    loading,
    error,
    toggleOpen,
    updateStore,
    refetch: fetchStore,
  };
}
