import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { DeliveryRoute, RouteStop } from "./useRoutes";

export interface MotoboyProfile {
  id: string;
  vehicle_plate: string | null;
  active: boolean;
  store_id: string | null;
  profiles: { full_name: string; phone: string | null };
}

export interface DeliveryHistory {
  id: string;
  order_id: string;
  stop_number: number;
  delivered_at: string | null;
  route_id: string;
  order: {
    total: number;
    delivery_address: string | null;
    profiles: { full_name: string };
  };
}

export function useMotoboyData() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<MotoboyProfile | null>(null);
  const [activeRoute, setActiveRoute] = useState<DeliveryRoute | null>(null);
  const [stops, setStops] = useState<RouteStop[]>([]);
  const [history, setHistory] = useState<DeliveryHistory[]>([]);
  const [stats, setStats] = useState({ total: 0, delivered: 0, earnings: 0 });
  const [loading, setLoading] = useState(true);

  // Carrega perfil do motoboy
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("motoboys")
      .select("*, profiles(full_name, phone)")
      .eq("id", user.id)
      .single();
    if (data) setProfile(data as MotoboyProfile);
  }, [user]);

  // Carrega rota ativa
  const fetchActiveRoute = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("delivery_routes")
      .select("*, motoboys(id, vehicle_plate, profiles(full_name, phone))")
      .eq("motoboy_id", user.id)
      .in("status", ["pending", "in_progress"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setActiveRoute(data as DeliveryRoute);
      setStops((data.route_json ?? []) as RouteStop[]);
    } else {
      setActiveRoute(null);
      setStops([]);
    }
  }, [user]);

  // Carrega histórico e stats do dia
  const fetchHistory = useCallback(async () => {
    if (!user) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("deliveries")
      .select(
        `
        *,
        order:orders (
          total,
          delivery_address,
          profiles ( full_name )
        )
      `,
      )
      .eq(
        "route_id",
        supabase
          .from("delivery_routes")
          .select("id")
          .eq("motoboy_id", user.id)
          .gte("created_at", today.toISOString()),
      )
      .not("delivered_at", "is", null)
      .order("delivered_at", { ascending: false })
      .limit(20);

    const list = (data ?? []) as DeliveryHistory[];
    setHistory(list);

    // Calcula stats
    const delivered = list.filter((d) => d.delivered_at).length;
    const earnings = list.reduce(
      (s, d) => s + Number((d.order as any)?.total ?? 0) * 0.05,
      0,
    );
    setStats({
      total: delivered,
      delivered,
      earnings: Math.round(earnings * 100) / 100,
    });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchProfile(), fetchActiveRoute(), fetchHistory()]).finally(
      () => setLoading(false),
    );

    // Realtime: escuta mudanças na rota
    const channel = supabase
      .channel(`motoboy-route-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_routes",
          filter: `motoboy_id=eq.${user.id}`,
        },
        () => fetchActiveRoute(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
        },
        () => {
          fetchActiveRoute();
          fetchHistory();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchProfile, fetchActiveRoute, fetchHistory]);

  // Aceita a rota (muda status para in_progress)
  async function acceptRoute(routeId: string) {
    await supabase
      .from("delivery_routes")
      .update({ status: "in_progress", started_at: new Date().toISOString() })
      .eq("id", routeId);

    // Atualiza status dos pedidos para in_delivery
    const routeStops = stops;
    await supabase
      .from("orders")
      .update({ status: "in_delivery" })
      .in(
        "id",
        routeStops.map((s) => s.order_id),
      );

    await fetchActiveRoute();
  }

  // Confirma entrega de uma parada
  async function confirmDelivery(
    orderId: string,
    notes?: string,
    signatureUrl?: string,
  ) {
    const now = new Date().toISOString();

    // Atualiza a entrega
    await supabase
      .from("deliveries")
      .update({
        delivered_at: now,
        notes: notes ?? null,
        signature_url: signatureUrl ?? null,
      })
      .eq("order_id", orderId);

    // Atualiza status do pedido
    await supabase
      .from("orders")
      .update({ status: "delivered" })
      .eq("id", orderId);

    // Atualiza stop local
    setStops((prev) =>
      prev.map((s) =>
        s.order_id === orderId ? { ...s, delivered_at: now } : s,
      ),
    );

    // Verifica se todas as paradas foram entregues
    const updatedStops = stops.map((s) =>
      s.order_id === orderId ? { ...s, delivered_at: now } : s,
    );
    const allDone = updatedStops.every((s) => s.delivered_at);

    if (allDone && activeRoute) {
      await supabase
        .from("delivery_routes")
        .update({ status: "completed", completed_at: now })
        .eq("id", activeRoute.id);

      await fetchActiveRoute();
    }
  }

  return {
    profile,
    activeRoute,
    stops,
    history,
    stats,
    loading,
    acceptRoute,
    confirmDelivery,
    refetch: () =>
      Promise.all([fetchProfile(), fetchActiveRoute(), fetchHistory()]),
  };
}
