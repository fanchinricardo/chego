import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface GpsState {
  lat: number | null;
  lng: number | null;
  accuracy: number | null;
  error: string | null;
  active: boolean;
}

// Envia GPS a cada 1 minuto enquanto a rota estiver ativa
export function useGpsSender(routeId: string | null, motoboyId: string | null) {
  const [gps, setGps] = useState<GpsState>({
    lat: null,
    lng: null,
    accuracy: null,
    error: null,
    active: false,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastPositionRef = useRef<GeolocationPosition | null>(null);

  const sendPosition = useCallback(
    async (position: GeolocationPosition) => {
      if (!routeId || !motoboyId) return;

      const { latitude, longitude, accuracy } = position.coords;

      setGps((prev) => ({
        ...prev,
        lat: latitude,
        lng: longitude,
        accuracy,
        active: true,
      }));
      console.log("📡 Enviando GPS:", latitude, longitude, "route:", routeId);

      try {
        const { error } = await supabase.from("gps_locations").insert({
          route_id: routeId,
          motoboy_id: motoboyId,
          lat: latitude,
          lng: longitude,
          accuracy: accuracy ?? null,
          recorded_at: new Date().toISOString(),
        });
        if (error) console.error("GPS insert erro:", error.message);
        else console.log("✅ GPS salvo");
      } catch (err) {
        console.error("Erro ao enviar GPS:", err);
      }
    },
    [routeId, motoboyId],
  );

  function handleError(err: GeolocationPositionError) {
    setGps((prev) => ({ ...prev, error: err.message, active: false }));
    console.error("GPS error:", err.message);
  }

  useEffect(() => {
    if (!routeId || !motoboyId) return;

    if (!navigator.geolocation) {
      setGps((prev) => ({
        ...prev,
        error: "GPS não suportado neste dispositivo",
      }));
      return;
    }

    // Escuta posição contínua para ter sempre a última disponível
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        lastPositionRef.current = pos;
      },
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );

    // Envia imediatamente ao iniciar
    navigator.geolocation.getCurrentPosition(sendPosition, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
    });

    // Envia a cada 10 segundos (era 60s)
    intervalRef.current = setInterval(() => {
      if (lastPositionRef.current) {
        sendPosition(lastPositionRef.current);
      } else {
        navigator.geolocation.getCurrentPosition(sendPosition, handleError, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      }
    }, 10_000);

    setGps((prev) => ({ ...prev, active: true, error: null }));

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (watchRef.current !== null)
        navigator.geolocation.clearWatch(watchRef.current);
      setGps((prev) => ({ ...prev, active: false }));
    };
  }, [routeId, motoboyId, sendPosition]);

  return gps;
}
