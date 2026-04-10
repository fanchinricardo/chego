import { useEffect, useRef, useState } from "react";
import { colors } from "./ui";

interface Props {
  lat?: number | null;
  lng?: number | null;
  onConfirm: (lat: number, lng: number) => void;
  onClose: () => void;
}

export function LocationPicker({ lat, lng, onConfirm, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    lat && lng ? { lat, lng } : null,
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapRef.current) return;

    // Carrega Leaflet via CDN
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = (window as any).L;
      setLoading(false);

      // Centro padrão: Brasil ou posição salva
      const center = pos ?? { lat: -15.7801, lng: -47.9292 };

      const map = L.map(mapRef.current, {
        center: [center.lat, center.lng],
        zoom: pos ? 15 : 5,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      // Ícone customizado
      const icon = L.divIcon({
        html: `<div style="
          width:32px;height:32px;border-radius:50% 50% 50% 0;
          background:#e91e8c;border:3px solid #fff;
          transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        className: "",
      });

      // Marcador inicial se tem posição
      if (pos) {
        markerRef.current = L.marker([pos.lat, pos.lng], {
          icon,
          draggable: true,
        }).addTo(map);
        markerRef.current.on("dragend", (e: any) => {
          const p = e.target.getLatLng();
          setPos({ lat: p.lat, lng: p.lng });
        });
      }

      // Clique no mapa move/cria o marcador
      map.on("click", (e: any) => {
        const { lat: lt, lng: ln } = e.latlng;
        setPos({ lat: lt, lng: ln });
        if (markerRef.current) {
          markerRef.current.setLatLng([lt, ln]);
        } else {
          markerRef.current = L.marker([lt, ln], {
            icon,
            draggable: true,
          }).addTo(map);
          markerRef.current.on("dragend", (ev: any) => {
            const p = ev.target.getLatLng();
            setPos({ lat: p.lat, lng: p.lng });
          });
        }
      });

      mapObjRef.current = map;
    };
    document.head.appendChild(script);

    return () => {
      mapObjRef.current?.remove();
    };
  }, []);

  // Usa localização do dispositivo
  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const map = mapObjRef.current;
      const L = (window as any).L;
      if (!map || !L) return;
      map.setView([latitude, longitude], 16);
      setPos({ lat: latitude, lng: longitude });
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        const icon = L.divIcon({
          html: `<div style="width:32px;height:32px;border-radius:50% 50% 50% 0;background:#e91e8c;border:3px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 32],
          className: "",
        });
        markerRef.current = L.marker([latitude, longitude], {
          icon,
          draggable: true,
        }).addTo(map);
        markerRef.current.on("dragend", (e: any) => {
          const p = e.target.getLatLng();
          setPos({ lat: p.lat, lng: p.lng });
        });
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        display: "flex",
        flexDirection: "column",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: colors.noite,
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.5)",
            fontSize: 13,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ← Cancelar
        </button>
        <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
          Marcar localização
        </p>
        <div style={{ width: 60 }} />
      </div>

      {/* Instrução */}
      <div
        style={{
          background: "#fff8e6",
          padding: "10px 16px",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 16 }}>👆</span>
        <p style={{ fontSize: 12, color: "#92400e" }}>
          Toque no mapa para marcar a localização. Arraste o pin para ajustar.
        </p>
      </div>

      {/* Mapa */}
      <div style={{ flex: 1, position: "relative" }}>
        {loading && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.fundo,
              zIndex: 10,
            }}
          >
            <p style={{ fontSize: 13, color: "#aaa" }}>Carregando mapa...</p>
          </div>
        )}
        <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
      </div>

      {/* Rodapé */}
      <div
        style={{
          background: "#fff",
          padding: "12px 16px",
          borderTop: `1px solid ${colors.bordaLilas}`,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <button
          onClick={useMyLocation}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: 10,
            background: colors.lilasClaro,
            border: "none",
            color: "#7e22ce",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          📍 Usar minha localização atual
        </button>

        {pos && (
          <p style={{ fontSize: 10, color: "#aaa", textAlign: "center" }}>
            {pos.lat.toFixed(6)}, {pos.lng.toFixed(6)}
          </p>
        )}

        <button
          onClick={() => pos && onConfirm(pos.lat, pos.lng)}
          disabled={!pos}
          style={{
            width: "100%",
            padding: "13px",
            borderRadius: 12,
            background: pos ? colors.rosa : "#d1d5db",
            color: "#fff",
            border: "none",
            fontSize: 14,
            fontWeight: 700,
            cursor: pos ? "pointer" : "not-allowed",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ✓ Confirmar localização
        </button>
      </div>
    </div>
  );
}
