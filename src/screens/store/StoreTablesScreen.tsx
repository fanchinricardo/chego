import { useState, useEffect, useCallback } from "react";
import QRCode from "qrcode";
import Swal from "sweetalert2";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "./StoreDashboard";
import { PDVTable } from "../../hooks/usePdv";

interface PDVTableWithQR extends PDVTable {
  qr_token?: string;
}

export default function StoreTablesScreen() {
  const navigate = useNavigate();
  const { store } = useStore();

  const [tables, setTables] = useState<PDVTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [qrTable, setQrTable] = useState<PDVTableWithQR | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [qrWaiter, setQrWaiter] = useState("");

  const [form, setForm] = useState({
    number: "",
    name: "",
    capacity: "4",
  });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  const fetchTables = useCallback(async () => {
    if (!store) return;
    setLoading(true);
    const { data } = await supabase
      .from("pdv_tables")
      .select("*, qr_token")
      .eq("store_id", store.id)
      .order("number");
    setTables((data ?? []) as PDVTable[]);
    setLoading(false);
  }, [store]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  async function openQR(table: PDVTableWithQR) {
    setQrTable(table);
    const base = window.location.origin;
    const urlConsumption = `${base}/mesa/${table.qr_token}`;
    const url1 = await QRCode.toDataURL(urlConsumption, {
      width: 220,
      margin: 1,
    });
    setQrDataUrl(url1);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ number: String(tables.length + 1), name: "", capacity: "4" });
    setShowForm(true);
  }

  function openEdit(table: PDVTable) {
    setEditingId(table.id);
    setForm({
      number: String(table.number),
      name: table.name ?? "",
      capacity: String(table.capacity),
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!store) return;
    if (!form.number) {
      showToast("Número da mesa obrigatório", "error");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("pdv_tables")
          .update({
            number: Number(form.number),
            name: form.name.trim() || null,
            capacity: Number(form.capacity) || 4,
          })
          .eq("id", editingId);
        if (error) throw new Error(error.message);
        showToast("Mesa atualizada!");
      } else {
        const { error } = await supabase.from("pdv_tables").insert({
          store_id: store.id,
          number: Number(form.number),
          name: form.name.trim() || null,
          capacity: Number(form.capacity) || 4,
          status: "available",
        });
        if (error) throw new Error(error.message);
        showToast("Mesa criada!");
      }
      setShowForm(false);
      await fetchTables();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const { isConfirmed } = await Swal.fire({
      title: "Excluir esta mesa?",
      text: "Esta ação não pode ser desfeita.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Sim, excluir",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e9181c",
    });
    if (!isConfirmed) return;
    try {
      await supabase.from("pdv_tables").delete().eq("id", id);
      showToast("Mesa excluída");
      await fetchTables();
    } catch (e: any) {
      showToast(e.message, "error");
    }
  }

  async function handleCreateAll() {
    if (!store) return;
    const { isConfirmed } = await Swal.fire({
      title: "Criar 10 mesas?",
      text: "Serão criadas as mesas de 1 a 10 com capacidade padrão de 4 pessoas.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Criar mesas",
      cancelButtonText: "Cancelar",
      confirmButtonColor: "#e9181c",
    });
    if (!isConfirmed) return;
    setSaving(true);
    try {
      const rows = Array.from({ length: 10 }, (_, i) => ({
        store_id: store.id,
        number: i + 1,
        name: `Mesa ${i + 1}`,
        capacity: 4,
        status: "available",
      }));
      const { error } = await supabase.from("pdv_tables").insert(rows);
      if (error) throw new Error(error.message);
      showToast("10 mesas criadas!");
      await fetchTables();
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    available: "#22c55e",
    occupied: colors.rosa,
    waiting_payment: "#f59e0b",
    closed: "#aaa",
  };
  const STATUS_LABEL: Record<string, string> = {
    available: "Livre",
    occupied: "Ocupada",
    waiting_payment: "Aguardando conta",
    closed: "Fechada",
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 18px" }}
        >
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
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>
                Mesas
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                {tables.length} mesa{tables.length !== 1 ? "s" : ""} cadastrada
                {tables.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {tables.length === 0 && (
                <button
                  onClick={handleCreateAll}
                  disabled={saving}
                  style={{
                    background: "rgba(255,255,255,0.1)",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.2)",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Criar 10
                </button>
              )}
              <button
                onClick={openCreate}
                style={{
                  background: colors.rosa,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 16px",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                + Nova
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* Formulário */}
        {showForm && (
          <div
            style={{
              background: "#fff",
              borderRadius: 16,
              border: `1px solid ${colors.bordaLilas}`,
              padding: "16px",
            }}
          >
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 14,
              }}
            >
              {editingId ? "Editar mesa" : "Nova mesa"}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
                }}
              >
                <Input
                  label="Número"
                  placeholder="1"
                  value={form.number}
                  type="number"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, number: e.target.value }))
                  }
                />
                <Input
                  label="Capacidade"
                  placeholder="4"
                  value={form.capacity}
                  type="number"
                  onChange={(e) =>
                    setForm((f) => ({ ...f, capacity: e.target.value }))
                  }
                />
              </div>
              <Input
                label="Nome (opcional)"
                placeholder="Ex: Varanda, Balcão..."
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setShowForm(false)}
                  style={{
                    flex: 1,
                    padding: "11px",
                    borderRadius: 11,
                    background: colors.lilasClaro,
                    color: "#7e22ce",
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontFamily: "'Space Grotesk', sans-serif",
                  }}
                >
                  Cancelar
                </button>
                <Button
                  variant="primary"
                  loading={saving}
                  onClick={handleSave}
                  style={{ flex: 2 }}
                >
                  {editingId ? "Salvar" : "Criar mesa"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 32 }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : tables.length === 0 && !showForm ? (
          <div
            style={{
              textAlign: "center",
              padding: "32px 20px",
              background: "#fff",
              borderRadius: 14,
              border: `1px dashed ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 8 }}>🪑</p>
            <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
              Nenhuma mesa cadastrada
            </p>
            <p
              style={{
                fontSize: 12,
                color: "#aaa",
                marginTop: 4,
                marginBottom: 16,
              }}
            >
              Crie mesas individualmente ou clique em "Criar 10" para criar
              automaticamente
            </p>
            <button
              onClick={handleCreateAll}
              disabled={saving}
              style={{
                padding: "10px 24px",
                borderRadius: 10,
                background: colors.rosa,
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Criar 10 mesas automaticamente
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 10,
            }}
          >
            {tables.map((table) => (
              <div
                key={table.id}
                style={{
                  background: "#fff",
                  borderRadius: 14,
                  border: `1px solid ${colors.bordaLilas}`,
                  padding: "12px 8px",
                  textAlign: "center",
                  position: "relative",
                }}
              >
                {/* Número */}
                <p
                  style={{
                    fontFamily: "'Righteous', cursive",
                    fontSize: 26,
                    color: colors.noite,
                    lineHeight: 1,
                  }}
                >
                  {table.number}
                </p>
                {/* Nome */}
                {table.name && (
                  <p
                    style={{
                      fontSize: 10,
                      color: "#888",
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {table.name}
                  </p>
                )}
                {/* Capacidade */}
                <p style={{ fontSize: 9, color: "#aaa", marginTop: 2 }}>
                  👥 {table.capacity}
                </p>
                {/* Status */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    marginTop: 6,
                  }}
                >
                  <div
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: STATUS_COLOR[table.status] ?? "#aaa",
                    }}
                  />
                  <span
                    style={{
                      fontSize: 8,
                      fontWeight: 600,
                      color: STATUS_COLOR[table.status] ?? "#aaa",
                    }}
                  >
                    {STATUS_LABEL[table.status] ?? table.status}
                  </span>
                </div>
                {/* Botões */}
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <button
                    onClick={() => openQR(table as PDVTableWithQR)}
                    style={{
                      flex: 1,
                      padding: "5px",
                      borderRadius: 7,
                      background: colors.lilasClaro,
                      border: "none",
                      color: "#7e22ce",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    📱
                  </button>
                  <button
                    onClick={() => openEdit(table)}
                    style={{
                      flex: 1,
                      padding: "5px",
                      borderRadius: 7,
                      background: colors.lilasClaro,
                      border: "none",
                      color: "#7e22ce",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(table.id)}
                    style={{
                      flex: 1,
                      padding: "5px",
                      borderRadius: 7,
                      background: "#fff0f3",
                      border: `1px solid ${colors.rosa}`,
                      color: colors.rosa,
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "'Space Grotesk', sans-serif",
                    }}
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal QR Code */}
      {qrTable && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 200,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 520,
              padding: "24px 20px 32px",
            }}
          >
            <p
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: colors.noite,
                marginBottom: 4,
              }}
            >
              {qrTable.name ?? `Mesa ${qrTable.number}`}
            </p>
            <p style={{ fontSize: 12, color: "#aaa", marginBottom: 20 }}>
              Imprima ou exiba este QR Code na mesa
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* QR consumo */}
              <div style={{ textAlign: "center" }}>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.noite,
                    marginBottom: 10,
                  }}
                >
                  📋 Ver consumo + Chamar garçom
                </p>
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    style={{ width: 180, height: 180, borderRadius: 12 }}
                  />
                )}
                <p style={{ fontSize: 10, color: "#aaa", marginTop: 6 }}>
                  {window.location.origin}/mesa/{qrTable.qr_token}
                </p>
              </div>
            </div>

            <button
              onClick={() => setQrTable(null)}
              style={{
                width: "100%",
                marginTop: 20,
                padding: "13px",
                borderRadius: 11,
                background: colors.noite,
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <BottomNav active="profile" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
