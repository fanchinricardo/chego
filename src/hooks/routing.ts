// Serviço de otimização de rota
// Usa OSRM (Open Source Routing Machine) — gratuito e sem chave de API

export interface Waypoint {
  order_id: string;
  customer_name: string;
  address: string;
  lat: number;
  lng: number;
  total: number;
}

export interface OptimizedStop {
  order_id: string;
  stop_number: number;
  customer_name: string;
  address: string;
  lat: number;
  lng: number;
  total: number;
  distance_km: number;
  duration_min: number;
  delivered_at: null;
}

export interface OptimizationResult {
  stops: OptimizedStop[];
  total_distance_km: number;
  total_duration_min: number;
}

const OSRM_BASE = "https://router.project-osrm.org";

// Geocodificação via ViaCEP + Nominatim (ambos permitem CORS do browser)
export async function geocodeAddress(input: {
  address: string;
  city: string;
  state: string;
  zip_code: string;
}): Promise<{ lat: number; lng: number } | null> {
  const cep = input.zip_code.replace(/\D/g, "");

  let cidade = input.city;
  let uf = input.state;

  // 1. ViaCEP — pega cidade/estado oficial pelo CEP
  if (cep.length === 8) {
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (r.ok) {
        const d = await r.json();
        if (!d.erro && d.localidade) {
          cidade = d.localidade;
          uf = d.uf;
        }
      }
    } catch (e) {
      console.warn("ViaCEP erro:", e);
    }
  }

  // 2. Nominatim com cidade + estado
  if (cidade) {
    try {
      const q = encodeURIComponent(`${cidade}, ${uf}, Brasil`);
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&limit=1&countrycodes=br`,
      );
      if (r.ok) {
        const d = await r.json();
        if (d?.length > 0) {
          console.log("✅ Geocode OK:", cidade, d[0].lat, d[0].lon);
          return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) };
        }
      }
    } catch (e) {
      console.warn("Nominatim erro:", e);
    }
  }

  console.warn("❌ Geocode falhou:", cidade, uf);
  return null;
}

// Otimiza a ordem das paradas usando OSRM Trip (Traveling Salesman)
export async function optimizeRoute(
  origin: { lat: number; lng: number },
  waypoints: Waypoint[],
): Promise<OptimizationResult> {
  if (waypoints.length === 0) {
    return { stops: [], total_distance_km: 0, total_duration_min: 0 };
  }

  // Se só 1 parada, não precisa otimizar
  if (waypoints.length === 1) {
    const wp = waypoints[0];
    const dist = haversineKm(origin.lat, origin.lng, wp.lat, wp.lng);
    return {
      stops: [
        {
          ...wp,
          stop_number: 1,
          distance_km: Math.round(dist * 10) / 10,
          duration_min: Math.ceil(dist * 3), // ~20km/h média urbana
          delivered_at: null,
        },
      ],
      total_distance_km: Math.round(dist * 10) / 10,
      total_duration_min: Math.ceil(dist * 3),
    };
  }

  try {
    // Monta coordenadas: origem + waypoints
    const coords = [
      `${origin.lng},${origin.lat}`,
      ...waypoints.map((w) => `${w.lng},${w.lat}`),
    ].join(";");

    const url = `${OSRM_BASE}/trip/v1/driving/${coords}?source=first&roundtrip=false&annotations=false&steps=false`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok" || !data.trips?.length) {
      // Fallback: ordem original sem otimização
      return fallbackOptimize(origin, waypoints);
    }

    const trip = data.trips[0];
    const waypointOrder: number[] = data.waypoints
      .slice(1) // remove origem
      .sort((a: any, b: any) => a.waypoint_index - b.waypoint_index)
      .map((w: any) => w.waypoint_index - 1); // índice no array original

    let cumDist = 0;
    let cumMin = 0;

    const stops: OptimizedStop[] = waypointOrder.map((idx, i) => {
      const wp = waypoints[idx];
      const leg = trip.legs[i];
      const distKm = Math.round((leg?.distance ?? 0) / 100) / 10;
      const durMin = Math.ceil((leg?.duration ?? 0) / 60);
      cumDist += distKm;
      cumMin += durMin;
      return {
        ...wp,
        stop_number: i + 1,
        distance_km: Math.round(distKm * 10) / 10,
        duration_min: durMin,
        delivered_at: null,
      };
    });

    return {
      stops,
      total_distance_km: Math.round(cumDist * 10) / 10,
      total_duration_min: cumMin,
    };
  } catch {
    // Se OSRM falhar, usa fallback local
    return fallbackOptimize(origin, waypoints);
  }
}

// Fallback: ordena por distância da origem (nearest neighbor)
function fallbackOptimize(
  origin: { lat: number; lng: number },
  waypoints: Waypoint[],
): OptimizationResult {
  const remaining = [...waypoints];
  const ordered: Waypoint[] = [];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((wp, i) => {
      const d = haversineKm(current.lat, current.lng, wp.lat, wp.lng);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    });
    ordered.push(remaining[nearestIdx]);
    current = {
      lat: remaining[nearestIdx].lat,
      lng: remaining[nearestIdx].lng,
    };
    remaining.splice(nearestIdx, 1);
  }

  let cumDist = 0;
  let cumMin = 0;
  let prev = origin;

  const stops: OptimizedStop[] = ordered.map((wp, i) => {
    const dist = haversineKm(prev.lat, prev.lng, wp.lat, wp.lng);
    const dur = Math.ceil(dist * 3);
    cumDist += dist;
    cumMin += dur;
    prev = { lat: wp.lat, lng: wp.lng };
    return {
      ...wp,
      stop_number: i + 1,
      distance_km: Math.round(dist * 10) / 10,
      duration_min: dur,
      delivered_at: null,
    };
  });

  return {
    stops,
    total_distance_km: Math.round(cumDist * 10) / 10,
    total_duration_min: cumMin,
  };
}

// Distância em km entre dois pontos (fórmula de Haversine)
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dL = ((lat2 - lat1) * Math.PI) / 180;
  const dN = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dL / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dN / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
