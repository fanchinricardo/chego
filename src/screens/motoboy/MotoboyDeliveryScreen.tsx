import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useMotoboyData } from "../../hooks/useMotoboyData";
import { colors, Spinner, Toast } from "../../components/ui";
import { RouteStop } from "../../hooks/useRoutes";

export default function MotoboyDeliveryScreen() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { stops, confirmDelivery, activeRoute } = useMotoboyData();

  const [stop, setStop] = useState<RouteStop | null>(null);
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  useEffect(() => {
    if (!orderId || stops.length === 0) return;
    const found = stops.find((s) => s.order_id === orderId);
    if (found) setStop(found);
  }, [orderId, stops]);

  // Seleciona foto da galeria ou câmera
  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    setPhotoUrl(URL.createObjectURL(file));
  }

  // Faz upload da foto para o Supabase Storage
  async function uploadPhoto(file: File): Promise<string | null> {
    if (!activeRoute || !orderId) return null;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `deliveries/${activeRoute.id}/${orderId}.${ext}`;
      const { error } = await supabase.storage
        .from("delivery-photos")
        .upload(path, file, { upsert: true });

      if (error) throw error;

      const { data } = supabase.storage
        .from("delivery-photos")
        .getPublicUrl(path);

      return data.publicUrl;
    } catch (err: any) {
      console.error("Erro ao fazer upload:", err.message);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    if (!orderId || !stop) return;
    setConfirming(true);
    try {
      let signatureUrl: string | undefined = undefined;

      // Faz upload da foto se houver
      if (photoFile) {
        const url = await uploadPhoto(photoFile);
        if (url) signatureUrl = url;
      }

      await confirmDelivery(orderId, notes.trim() || undefined, signatureUrl);

      showToast("Entrega confirmada!");
      setTimeout(() => navigate("/motoboy/route"), 1200);
    } catch (err: any) {
      showToast(err.message, "error");
      setConfirming(false);
    }
  }

  if (!stop)
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spinner color={colors.rosa} />
      </div>
    );

  // Já entregue
  if (stop.delivered_at) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          background: colors.fundo,
          fontFamily: "'Space Grotesk', sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "#22c55e",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 24,
            color: "#fff",
          }}
        >
          ✓
        </div>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>
          Já entregue
        </p>
        <p style={{ fontSize: 12, color: "#888" }}>
          {new Date(stop.delivered_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
        <button
          onClick={() => navigate("/motoboy/route")}
          style={{
            padding: "11px 24px",
            borderRadius: 12,
            background: colors.rosa,
            color: "#fff",
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          Voltar à rota
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 24,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
        <button
          onClick={() => navigate("/motoboy/route")}
          style={{
            background: "none",
            border: "none",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            cursor: "pointer",
            marginBottom: 10,
            padding: 0,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ← Voltar
        </button>
        <p
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Confirmar entrega
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          Parada {stop.stop_number} · {stop.customer_name}
        </p>
      </div>

      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Endereço */}
        <div
          style={{
            background: "#fff",
            borderRadius: 13,
            border: `1px solid ${colors.bordaLilas}`,
            padding: "12px 14px",
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "#aaa",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Endereço de entrega
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}>
            {stop.address}
          </p>
          <p
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: colors.rosa,
              marginTop: 6,
            }}
          >
            R$ {Number(stop.total).toFixed(2)}
          </p>

          {/* Navegar */}
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(stop.address)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              marginTop: 8,
              padding: "6px 14px",
              borderRadius: 9,
              background: "rgba(59,130,246,0.1)",
              color: "#3b82f6",
              fontSize: 11,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            🗺️ Abrir no Maps
          </a>
        </div>

        {/* Foto do comprovante */}
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.noite,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 8,
            }}
          >
            Foto do comprovante (opcional)
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            style={{ display: "none" }}
          />

          {photoUrl ? (
            <div
              style={{
                position: "relative",
                borderRadius: 13,
                overflow: "hidden",
                height: 160,
              }}
            >
              <img
                src={photoUrl}
                alt="Comprovante"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
              <button
                onClick={() => {
                  setPhotoUrl(null);
                  setPhotoFile(null);
                }}
                style={{
                  position: "absolute",
                  top: 8,
                  right: 8,
                  background: "rgba(0,0,0,0.5)",
                  border: "none",
                  borderRadius: "50%",
                  width: 28,
                  height: 28,
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%",
                height: 100,
                borderRadius: 13,
                background: "#fff",
                border: `1.5px dashed ${colors.bordaLilas}`,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              <span style={{ fontSize: 28 }}>📷</span>
              <span
                style={{
                  fontSize: 11,
                  color: "#aaa",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                Tirar foto ou escolher da galeria
              </span>
            </button>
          )}
        </div>

        {/* Observação */}
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: colors.noite,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 6,
            }}
          >
            Observação
          </p>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Deixei na portaria, entregue para vizinho..."
            rows={3}
            style={{
              width: "100%",
              background: "#fff",
              border: `1.5px solid ${colors.bordaLilas}`,
              borderRadius: 12,
              padding: "10px 12px",
              fontSize: 13,
              color: colors.noite,
              fontFamily: "'Space Grotesk', sans-serif",
              resize: "none",
              outline: "none",
            }}
          />
        </div>

        {/* Botão confirmar */}
        <button
          onClick={handleConfirm}
          disabled={confirming || uploading}
          style={{
            width: "100%",
            padding: "14px",
            borderRadius: 13,
            background: "#22c55e",
            color: "#fff",
            border: "none",
            fontSize: 15,
            fontWeight: 700,
            cursor: confirming || uploading ? "not-allowed" : "pointer",
            opacity: confirming || uploading ? 0.7 : 1,
            fontFamily: "'Space Grotesk', sans-serif",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {confirming || uploading ? (
            <>
              <Spinner size={18} />{" "}
              {uploading ? "Enviando foto..." : "Confirmando..."}
            </>
          ) : (
            "✓ Confirmar entrega"
          )}
        </button>

        {/* Problema na entrega */}
        <button
          onClick={() => showToast("Função em desenvolvimento", "error")}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: 13,
            background: "#fff0f3",
            border: `1px solid ${colors.bordaLilas}`,
            color: colors.rosa,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          ⚠️ Problema na entrega
        </button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
