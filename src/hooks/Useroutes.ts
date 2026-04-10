import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export type RouteStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface RouteStop {
  order_id: string;
  stop_number: number;
  customer_name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  total: number;
  delivered_at: string | null;
}

export interface DeliveryRoute {
  id: string;
  store_id: string;
  motoboy_id: string;
  status: RouteStatus;
  started_at: string | null;
  completed_at: string | null;
  total_stops: number;
  route_json: RouteStop[] | null;
  created_at: string;
  motoboys: {
    id: string;
    vehicle_plate: string | null;
    profiles: { full_name: string; phone: string | null };
  };
}

export interface GpsLocation {
  lat: number;
  lng: number;
  recorded_at: string;
}

export function useRoutes(storeId: string | null) {
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);

    const { data, error: err } = await supabase
      .from("delivery_routes")
      .select(
        `
        *,
        motoboys (
          id, vehicle_plate,
          profiles ( full_name, phone )
        )
      `,
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setRoutes((data ?? []) as DeliveryRoute[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchRoutes();

    if (!storeId) return;
    const channel = supabase
      .channel(`routes-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_routes",
          filter: `store_id=eq.${storeId}`,
        },
        () => fetchRoutes(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [storeId, fetchRoutes]);

  // Cria uma nova rota
  async function createRoute(
    motoboyId: string,
    stops: RouteStop[],
  ): Promise<DeliveryRoute> {
    if (!storeId) throw new Error("Store não identificada");

    // 1. Cria a rota
    const { data: route, error: routeErr } = await supabase
      .from("delivery_routes")
      .insert({
        store_id: storeId,
        motoboy_id: motoboyId,
        status: "pending",
        total_stops: stops.length,
        route_json: stops,
      })
      .select("*")
      .single();

    if (routeErr)
      throw new Error(
        `Erro ao criar rota: ${routeErr.message} (${routeErr.code})`,
      );

    // 2. Cria os registros em deliveries
    const deliveries = stops.map((s) => ({
      order_id: s.order_id,
      route_id: route.id,
      stop_number: s.stop_number,
    }));

    const { error: delErr } = await supabase
      .from("deliveries")
      .insert(deliveries);

    if (delErr)
      throw new Error(
        `Erro ao criar deliveries: ${delErr.message} (${delErr.code})`,
      );

    // 3. Atualiza status dos pedidos para in_delivery
    await supabase
      .from("orders")
      .update({ status: "in_delivery" })
      .in(
        "id",
        stops.map((s) => s.order_id),
      );

    setRoutes((prev) => [route as DeliveryRoute, ...prev]);
    return route as DeliveryRoute;
  }

  // Cancela uma rota
  async function cancelRoute(routeId: string): Promise<void> {
    const { error } = await supabase
      .from("delivery_routes")
      .update({ status: "cancelled" })
      .eq("id", routeId);

    if (error) throw new Error(error.message);
    setRoutes((prev) =>
      prev.map((r) => (r.id === routeId ? { ...r, status: "cancelled" } : r)),
    );
  }

  return {
    routes,
    loading,
    error,
    createRoute,
    cancelRoute,
    refetch: fetchRoutes,
  };
}

// ── Hook de GPS realtime para uma rota específica ─────────
export function useRouteGps(routeId: string | null) {
  const [location, setLocation] = useState<GpsLocation | null>(null);

  useEffect(() => {
    if (!routeId) return;

    console.log("👀 useRouteGps: buscando GPS para route:", routeId);

    // Busca última posição
    supabase
      .from("gps_locations")
      .select("lat, lng, recorded_at")
      .eq("route_id", routeId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        console.log("📍 GPS inicial:", data, "erro:", error);
        if (data) setLocation(data as GpsLocation);
      });

    // Escuta novas posições em realtime
    const channel = supabase
      .channel(`gps-${routeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "gps_locations",
          filter: `route_id=eq.${routeId}`,
        },
        (payload) => {
          const row = payload.new as any;
          setLocation({
            lat: row.lat,
            lng: row.lng,
            recorded_at: row.recorded_at,
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [routeId]);

  return location;
}

// ── Hook de motoboys disponíveis ──────────────────────────
export function useMotoboys(storeId: string | null) {
  const [motoboys, setMotoboys] = useState<
    Array<{
      id: string;
      vehicle_plate: string | null;
      active: boolean;
      in_route: boolean;
      profiles: { full_name: string; phone: string | null };
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!storeId) return;
    setLoading(true);

    async function fetchMotoboys() {
      if (!storeId) return;
      setLoading(true);

      // Busca motoboys
      const { data: motoboysData } = await supabase
        .from("motoboys")
        .select("id, vehicle_plate, active, store_id")
        .eq("store_id", storeId)
        .eq("active", true);

      if (!motoboysData || motoboysData.length === 0) {
        setLoading(false);
        return;
      }

      // Busca profiles separadamente
      const ids = motoboysData.map((m: any) => m.id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", ids);

      const profileMap = new Map(
        (profilesData ?? []).map((p: any) => [p.id, p]),
      );

      // Verifica quais estão em rota ativa
      const { data: activeRoutes } = await supabase
        .from("delivery_routes")
        .select("motoboy_id")
        .eq("store_id", storeId)
        .eq("status", "in_progress");

      const busyIds = new Set(
        (activeRoutes ?? []).map((r: any) => r.motoboy_id),
      );

      setMotoboys(
        motoboysData.map((m: any) => ({
          id: m.id,
          vehicle_plate: m.vehicle_plate,
          active: m.active,
          in_route: busyIds.has(m.id),
          profiles: profileMap.get(m.id) ?? {
            full_name: "Motoboy",
            phone: null,
          },
        })),
      );
      setLoading(false);
    }

    fetchMotoboys();
  }, [storeId]);

  return { motoboys, loading };
}
