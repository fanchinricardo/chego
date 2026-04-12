import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Button, Toast } from "../../components/ui";

const DAYS = [
  { key: "sun", label: "Domingo" },
  { key: "mon", label: "Segunda-feira" },
  { key: "tue", label: "Terça-feira" },
  { key: "wed", label: "Quarta-feira" },
  { key: "thu", label: "Quinta-feira" },
  { key: "fri", label: "Sexta-feira" },
  { key: "sat", label: "Sábado" },
];

interface DaySchedule {
  open: boolean;
  from: string;
  to: string;
}

type Schedule = Record<string, DaySchedule>;

const DEFAULT_SCHEDULE: Schedule = {
  sun: { open: false, from: "08:00", to: "22:00" },
  mon: { open: true, from: "08:00", to: "22:00" },
  tue: { open: true, from: "08:00", to: "22:00" },
  wed: { open: true, from: "08:00", to: "22:00" },
  thu: { open: true, from: "08:00", to: "22:00" },
  fri: { open: true, from: "08:00", to: "22:00" },
  sat: { open: true, from: "08:00", to: "22:00" },
};

export default function StoreScheduleScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [schedule, setSchedule] = useState<Schedule>(DEFAULT_SCHEDULE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  // Carrega horários salvos
  useEffect(() => {
    if (!store) return;
    supabase
      .from("store_schedules")
      .select("*")
      .eq("store_id", store.id)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const loaded: Schedule = { ...DEFAULT_SCHEDULE };
        data.forEach((row: any) => {
          loaded[row.day_key] = {
            open: row.open,
            from: row.open_time ?? "08:00",
            to: row.close_time ?? "22:00",
          };
        });
        setSchedule(loaded);
      });
  }, [store]);

  function toggleDay(key: string) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], open: !prev[key].open },
    }));
  }

  function updateTime(key: string, field: "from" | "to", value: string) {
    setSchedule((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }

  // Copia horário de um dia para todos os dias abertos
  function copyToAll(key: string) {
    const ref = schedule[key];
    setSchedule((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((k) => {
        if (next[k].open) {
          next[k] = { ...next[k], from: ref.from, to: ref.to };
        }
      });
      return next;
    });
    showToast("Horário copiado para todos os dias abertos");
  }

  async function handleSave() {
    if (!store) return;
    setSaving(true);
    try {
      const rows = DAYS.map((d) => ({
        store_id: store.id,
        day_key: d.key,
        open: schedule[d.key].open,
        open_time: schedule[d.key].open ? schedule[d.key].from : null,
        close_time: schedule[d.key].open ? schedule[d.key].to : null,
      }));

      const { error } = await supabase
        .from("store_schedules")
        .upsert(rows, { onConflict: "store_id,day_key" });

      if (error) throw new Error(error.message);

      // Atualiza open_now na tabela stores baseado no horário atual
      await updateOpenNow();

      showToast("Horários salvos!");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateOpenNow() {
    if (!store) return;
    const now = new Date();
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const todayKey = dayKeys[now.getDay()];
    const today = schedule[todayKey];

    let openNow = false;
    if (today?.open && today.from && today.to) {
      const [fH, fM] = today.from.split(":").map(Number);
      const [tH, tM] = today.to.split(":").map(Number);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      const fromMin = fH * 60 + fM;
      const toMin = tH * 60 + tM;
      openNow = nowMin >= fromMin && nowMin <= toMin;
    }

    await supabase
      .from("stores")
      .update({ open_now: openNow })
      .eq("id", store.id);
  }

  const openDays = DAYS.filter((d) => schedule[d.key].open).length;
  const closedDays = 7 - openDays;

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 32,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "16px 20px 18px" }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
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
            fontSize: 18,
            fontWeight: 700,
            color: "#fff",
            marginBottom: 2,
          }}
        >
          Horário de funcionamento
        </p>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
          {openDays} dia{openDays !== 1 ? "s" : ""} aberto · {closedDays}{" "}
          fechado{closedDays !== 1 ? "s" : ""}
        </p>
      </div>

      <div
        style={{
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {/* Dica */}
        <div
          style={{
            background: "#fff8e6",
            border: "1px solid #fcd34d",
            borderRadius: 12,
            padding: "10px 14px",
          }}
        >
          <p style={{ fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
            💡 O status "Aberto/Fechado" da loja é atualizado automaticamente
            com base neste horário.
          </p>
        </div>

        {/* Lista de dias */}
        {DAYS.map((day, i) => {
          const s = schedule[day.key];
          return (
            <div
              key={day.key}
              style={{
                background: "#fff",
                borderRadius: 14,
                border: `1.5px solid ${s.open ? colors.bordaLilas : "#e5e7eb"}`,
                padding: "12px 14px",
                opacity: 1,
              }}
            >
              {/* Linha superior: nome + toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: s.open ? 10 : 0,
                }}
              >
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: s.open ? colors.noite : "#9ca3af",
                  }}
                >
                  {day.label}
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {s.open && (
                    <span
                      style={{ fontSize: 9, color: "#22c55e", fontWeight: 600 }}
                    >
                      ● Aberto
                    </span>
                  )}
                  {!s.open && (
                    <span
                      style={{ fontSize: 9, color: "#9ca3af", fontWeight: 600 }}
                    >
                      Fechado
                    </span>
                  )}
                  {/* Toggle switch */}
                  <div
                    onClick={() => toggleDay(day.key)}
                    style={{
                      width: 42,
                      height: 24,
                      borderRadius: 12,
                      cursor: "pointer",
                      background: s.open ? colors.rosa : "#d1d5db",
                      position: "relative",
                      transition: "background 0.2s",
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 3,
                        left: s.open ? 21 : 3,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "#fff",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Horários */}
              {s.open && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 9,
                        color: "#aaa",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      Abre
                    </p>
                    <input
                      type="time"
                      value={s.from}
                      onChange={(e) =>
                        updateTime(day.key, "from", e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        border: `1.5px solid ${colors.bordaLilas}`,
                        borderRadius: 9,
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.noite,
                        background: colors.fundo,
                        fontFamily: "'Space Grotesk', sans-serif",
                        outline: "none",
                      }}
                    />
                  </div>

                  <div style={{ fontSize: 16, color: "#aaa", paddingTop: 18 }}>
                    →
                  </div>

                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 9,
                        color: "#aaa",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        marginBottom: 4,
                      }}
                    >
                      Fecha
                    </p>
                    <input
                      type="time"
                      value={s.to}
                      onChange={(e) =>
                        updateTime(day.key, "to", e.target.value)
                      }
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        border: `1.5px solid ${colors.bordaLilas}`,
                        borderRadius: 9,
                        fontSize: 14,
                        fontWeight: 600,
                        color: colors.noite,
                        background: colors.fundo,
                        fontFamily: "'Space Grotesk', sans-serif",
                        outline: "none",
                      }}
                    />
                  </div>

                  {/* Copiar para todos */}
                  <button
                    onClick={() => copyToAll(day.key)}
                    title="Copiar para todos os dias abertos"
                    style={{
                      padding: "7px 8px",
                      borderRadius: 9,
                      border: `1px solid ${colors.bordaLilas}`,
                      background: colors.lilasClaro,
                      color: "#7e22ce",
                      fontSize: 14,
                      cursor: "pointer",
                      marginTop: 18,
                      flexShrink: 0,
                    }}
                  >
                    ⎘
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {/* Ações rápidas */}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => {
              setSchedule((prev) => {
                const next = { ...prev };
                Object.keys(next).forEach((k) => {
                  next[k] = { ...next[k], open: true };
                });
                return next;
              });
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: "#f0fdf4",
              border: "1px solid #86efac",
              color: "#15803d",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Todos abertos
          </button>
          <button
            onClick={() => {
              setSchedule((prev) => {
                const next = { ...prev };
                next["sun"] = { ...next["sun"], open: false };
                next["sat"] = { ...next["sat"], open: false };
                return next;
              });
            }}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 10,
              background: colors.lilasClaro,
              border: `1px solid ${colors.bordaLilas}`,
              color: "#7e22ce",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            Fechar fds
          </button>
        </div>

        <Button
          variant="primary"
          fullWidth
          loading={saving}
          onClick={handleSave}
        >
          💾 Salvar horários
        </Button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
