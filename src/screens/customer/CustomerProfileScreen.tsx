import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCustomerAddresses } from "../../hooks/useCustomer";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { CustomerBottomNav } from "./CustomerBottomNav";
import { LocationPicker } from "../../components/LocationPicker";
import { supabase } from "../../lib/supabase";

const EMPTY_ADDR = {
  label: "Casa",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  complement: "",
};

// ── Fora do componente pai para evitar recriação a cada render,
// o que causaria perda de foco nos inputs a cada digitação ──
function AddrFormFields({
  values,
  onChange,
}: {
  values: typeof EMPTY_ADDR;
  onChange: (f: typeof EMPTY_ADDR) => void;
}) {
  return (
    <>
      {/* Label */}
      <div style={{ display: "flex", gap: 8 }}>
        {["Casa", "Trabalho", "Outro"].map((l) => (
          <button
            key={l}
            onClick={() => onChange({ ...values, label: l })}
            style={{
              flex: 1,
              padding: "7px",
              borderRadius: 9,
              border: `1.5px solid ${values.label === l ? colors.rosa : colors.bordaLilas}`,
              background: values.label === l ? "#fff0f8" : "#fff",
              color: values.label === l ? colors.rosa : "#888",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {l === "Casa" ? "🏠" : l === "Trabalho" ? "💼" : "📍"} {l}
          </button>
        ))}
      </div>

      <Input
        label="Endereço *"
        placeholder="Rua das Flores, 142"
        value={values.address}
        onChange={(e) => onChange({ ...values, address: e.target.value })}
      />
      <Input
        label="Complemento"
        placeholder="Ap 31, Bloco B..."
        value={values.complement}
        onChange={(e) => onChange({ ...values, complement: e.target.value })}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 2 }}>
          <Input
            label="Cidade *"
            placeholder="Jundiaí"
            value={values.city}
            onChange={(e) => onChange({ ...values, city: e.target.value })}
          />
        </div>
        <div style={{ flex: 1 }}>
          <Input
            label="UF *"
            placeholder="SP"
            value={values.state}
            onChange={(e) =>
              onChange({
                ...values,
                state: e.target.value.toUpperCase().slice(0, 2),
              })
            }
            maxLength={2}
          />
        </div>
      </div>
      <Input
        label="CEP *"
        placeholder="00000-000"
        value={values.zip_code}
        onChange={(e) => onChange({ ...values, zip_code: e.target.value })}
        inputMode="numeric"
      />
    </>
  );
}

export default function CustomerProfileScreen() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const {
    addresses,
    loading: addrLoading,
    addAddress,
    setDefault,
    refetch,
  } = useCustomerAddresses(user?.id ?? null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [pendingAddrId, setPendingAddrId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  // ── Novo: qual endereço está sendo editado ──
  const [editingAddrId, setEditingAddrId] = useState<string | null>(null);
  const [editAddrForm, setEditAddrForm] = useState({ ...EMPTY_ADDR });

  const [form, setForm] = useState({
    full_name: profile?.full_name ?? "",
    phone: profile?.phone ?? "",
  });

  const [addrForm, setAddrForm] = useState({ ...EMPTY_ADDR });

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  function openEditAddr(addr: any) {
    setEditingAddrId(addr.id);
    setEditAddrForm({
      label: addr.label ?? "Casa",
      address: addr.address ?? "",
      city: addr.city ?? "",
      state: addr.state ?? "",
      zip_code: addr.zip_code ?? "",
      complement: addr.complement ?? "",
    });
    // Fecha o formulário de novo endereço se estiver aberto
    setShowAddAddr(false);
  }

  function closeEditAddr() {
    setEditingAddrId(null);
    setEditAddrForm({ ...EMPTY_ADDR });
  }

  async function handleUpdateAddress() {
    if (
      !editAddrForm.address ||
      !editAddrForm.city ||
      !editAddrForm.state ||
      !editAddrForm.zip_code
    ) {
      showToast("Preencha todos os campos obrigatórios", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customer_addresses")
        .update({
          label: editAddrForm.label,
          address: editAddrForm.address.trim(),
          city: editAddrForm.city.trim(),
          state: editAddrForm.state.trim().toUpperCase().slice(0, 2),
          zip_code: editAddrForm.zip_code.replace(/\D/g, ""),
          complement: editAddrForm.complement.trim() || null,
        })
        .eq("id", editingAddrId!);

      if (error) throw new Error(error.message);
      showToast("Endereço atualizado!");
      closeEditAddr();
      refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleLocationConfirm(lat: number, lng: number) {
    if (!pendingAddrId || !user) return;
    await supabase
      .from("customer_addresses")
      .update({ lat, lng })
      .eq("id", pendingAddrId);
    showToast("Localização salva!");
    setShowMap(false);
    setPendingAddrId(null);
    refetch();
  }

  async function handleSaveProfile() {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || null,
        })
        .eq("id", user.id);

      if (error) throw new Error(error.message);
      showToast("Perfil atualizado!");
      setEditing(false);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAddress() {
    if (
      !addrForm.address ||
      !addrForm.city ||
      !addrForm.state ||
      !addrForm.zip_code
    ) {
      showToast("Preencha todos os campos obrigatórios", "error");
      return;
    }
    setSaving(true);
    try {
      const { data } = await supabase
        .from("customer_addresses")
        .insert({
          customer_id: user?.id,
          label: addrForm.label,
          address: addrForm.address.trim(),
          city: addrForm.city.trim(),
          state: addrForm.state.trim().toUpperCase().slice(0, 2),
          zip_code: addrForm.zip_code.replace(/\D/g, ""),
          complement: addrForm.complement.trim() || null,
          is_default: addresses.length === 0,
        })
        .select("id")
        .single();

      showToast("Endereço salvo! Agora marque no mapa.");
      setShowAddAddr(false);
      setAddrForm({ ...EMPTY_ADDR });

      if (data?.id) {
        setPendingAddrId(data.id);
        setShowMap(true);
      }

      refetch();
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    navigate("/", { replace: true });
  }

  const initials =
    profile?.full_name
      ?.split(" ")
      .slice(0, 2)
      .map((n) => n[0])
      .join("")
      .toUpperCase() ?? "?";

  // Componente interno do formulário de endereço (reaproveitado nos dois casos)
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 80,
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ background: colors.noite }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: colors.rosa,
              margin: "0 auto 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Righteous', cursive",
              fontSize: 24,
              color: "#fff",
            }}
          >
            {initials}
          </div>
          <p
            style={{
              fontSize: 17,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 2,
              marginLeft: 16,
            }}
          >
            {profile?.full_name ?? "—"}
          </p>
          <p style={{ fontSize: 11, color: "#fff", marginLeft: 16 }}>
            {user?.email}
          </p>
        </div>

        <div style={{ padding: "16px" }}>
          {/* ── Dados pessoais ── */}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.bordaLilas}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Dados pessoais
              </p>
              <button
                onClick={() => {
                  setForm({
                    full_name: profile?.full_name ?? "",
                    phone: profile?.phone ?? "",
                  });
                  setEditing((e) => !e);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.rosa,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {editing ? "Cancelar" : "Editar"}
              </button>
            </div>

            {editing ? (
              <div
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <Input
                  label="Nome completo"
                  value={form.full_name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                  autoComplete="name"
                />
                <Input
                  label="Telefone / WhatsApp"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  type="tel"
                  inputMode="numeric"
                />
                <Button
                  variant="primary"
                  fullWidth
                  loading={saving}
                  onClick={handleSaveProfile}
                >
                  Salvar
                </Button>
              </div>
            ) : (
              <div>
                {[
                  { label: "Nome", value: profile?.full_name ?? "—" },
                  { label: "Telefone", value: profile?.phone ?? "—" },
                  { label: "E-mail", value: user?.email ?? "—" },
                ].map((row, i, arr) => (
                  <div
                    key={row.label}
                    style={{
                      padding: "11px 16px",
                      borderBottom:
                        i < arr.length - 1
                          ? `1px solid ${colors.fundo}`
                          : "none",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <p style={{ fontSize: 12, color: "#aaa" }}>{row.label}</p>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.noite,
                        maxWidth: "60%",
                        textAlign: "right",
                        wordBreak: "break-all",
                      }}
                    >
                      {row.value}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Endereços ── */}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: `1px solid ${colors.bordaLilas}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#aaa",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Meus endereços
              </p>
              <button
                onClick={() => {
                  setShowAddAddr((a) => !a);
                  // Fecha edição se abrir novo
                  if (!showAddAddr) closeEditAddr();
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: colors.rosa,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                {showAddAddr ? "Cancelar" : "+ Novo"}
              </button>
            </div>

            {addrLoading ? (
              <div
                style={{
                  padding: 20,
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                <Spinner color={colors.rosa} size={20} />
              </div>
            ) : (
              <>
                {addresses.length === 0 && !showAddAddr && (
                  <div style={{ padding: "20px 16px", textAlign: "center" }}>
                    <p style={{ fontSize: 13, color: "#aaa" }}>
                      Nenhum endereço cadastrado
                    </p>
                  </div>
                )}

                {addresses.map((addr) => (
                  <div key={addr.id}>
                    {/* ── Linha do endereço ── */}
                    <div
                      style={{
                        padding: "11px 16px",
                        borderBottom: `1px solid ${colors.fundo}`,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 9,
                          background: addr.is_default
                            ? "#fff0f8"
                            : colors.lilasClaro,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                          flexShrink: 0,
                        }}
                      >
                        {addr.label === "Casa"
                          ? "🏠"
                          : addr.label === "Trabalho"
                            ? "💼"
                            : "📍"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <p
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: colors.noite,
                            }}
                          >
                            {addr.label}
                          </p>
                          {addr.is_default && (
                            <span
                              style={{
                                fontSize: 9,
                                fontWeight: 700,
                                color: colors.rosa,
                                background: "#fff0f8",
                                padding: "1px 6px",
                                borderRadius: 8,
                              }}
                            >
                              padrão
                            </span>
                          )}
                        </div>
                        <p
                          style={{
                            fontSize: 11,
                            color: "#888",
                            marginTop: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {addr.address} · {addr.city}
                        </p>
                      </div>

                      {/* Ações */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {/* Editar endereço */}
                        <button
                          onClick={() =>
                            editingAddrId === addr.id
                              ? closeEditAddr()
                              : openEditAddr(addr)
                          }
                          style={{
                            background:
                              editingAddrId === addr.id
                                ? "#fff0f8"
                                : colors.lilasClaro,
                            border: "none",
                            borderRadius: 7,
                            width: 28,
                            height: 28,
                            fontSize: 13,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                          title="Editar endereço"
                        >
                          ✏️
                        </button>

                        {/* Marcar no mapa */}
                        <button
                          onClick={() => {
                            setPendingAddrId(addr.id);
                            setShowMap(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: addr.lat ? "#15803d" : "#aaa",
                            fontSize: 16,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 28,
                            height: 28,
                          }}
                          title={
                            addr.lat
                              ? "Atualizar localização"
                              : "Marcar no mapa"
                          }
                        >
                          {addr.lat ? "📍" : "🗺️"}
                        </button>

                        {/* Definir como padrão */}
                        {!addr.is_default && (
                          <button
                            onClick={() => setDefault(addr.id)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#bbb",
                              fontSize: 11,
                              cursor: "pointer",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            Padrão
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ── Formulário inline de edição ── */}
                    {editingAddrId === addr.id && (
                      <div
                        style={{
                          padding: "14px 16px",
                          borderBottom: `1px solid ${colors.bordaLilas}`,
                          borderTop: `1px solid ${colors.bordaLilas}`,
                          background: "#fafafa",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <p
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color: "#aaa",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: 2,
                          }}
                        >
                          Editar endereço
                        </p>

                        <AddrFormFields
                          values={editAddrForm}
                          onChange={setEditAddrForm}
                        />

                        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                          <button
                            onClick={closeEditAddr}
                            style={{
                              flex: 1,
                              padding: "10px",
                              borderRadius: 10,
                              border: `1px solid ${colors.bordaLilas}`,
                              background: "#fff",
                              color: colors.noite,
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: "pointer",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleUpdateAddress}
                            disabled={saving}
                            style={{
                              flex: 2,
                              padding: "10px",
                              borderRadius: 10,
                              border: "none",
                              background: saving ? "#ccc" : colors.rosa,
                              color: "#fff",
                              fontSize: 13,
                              fontWeight: 700,
                              cursor: saving ? "not-allowed" : "pointer",
                              fontFamily: "'Space Grotesk', sans-serif",
                            }}
                          >
                            {saving ? "Salvando..." : "Salvar alterações"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Formulário de novo endereço */}
                {showAddAddr && (
                  <div
                    style={{
                      padding: "14px 16px",
                      borderTop: `1px solid ${colors.bordaLilas}`,
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#aaa",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        marginBottom: 2,
                      }}
                    >
                      Novo endereço
                    </p>

                    <AddrFormFields values={addrForm} onChange={setAddrForm} />

                    <Button
                      variant="primary"
                      fullWidth
                      loading={saving}
                      onClick={handleSaveAddress}
                    >
                      Salvar endereço
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Menu ── */}
          <div
            style={{
              background: "#fff",
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              overflow: "hidden",
              marginBottom: 14,
            }}
          >
            {[
              { icon: "📋", label: "Meus pedidos", path: "/orders" },
              { icon: "🔔", label: "Notificações", path: "/notifications" },
            ].map((item, i, arr) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  background: "none",
                  border: "none",
                  borderBottom:
                    i < arr.length - 1 ? `1px solid ${colors.fundo}` : "none",
                  cursor: "pointer",
                  fontFamily: "'Space Grotesk', sans-serif",
                }}
              >
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    background: colors.lilasClaro,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    flexShrink: 0,
                  }}
                >
                  {item.icon}
                </div>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: colors.noite,
                    flex: 1,
                    textAlign: "left",
                  }}
                >
                  {item.label}
                </p>
                <p style={{ fontSize: 16, color: "#bbb" }}>›</p>
              </button>
            ))}
          </div>

          {/* ── Sair ── */}
          <button
            onClick={handleSignOut}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: 13,
              background: "#fff0f3",
              border: `1px solid ${colors.bordaLilas}`,
              color: colors.rosa,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "'Space Grotesk', sans-serif",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            🚪 Sair da conta
          </button>

          <p
            style={{
              textAlign: "center",
              fontSize: 10,
              color: "#ccc",
              marginTop: 16,
            }}
          >
            Chegô v1.0 · Feito com ❤️ no Brasil
          </p>
        </div>

        {showMap && (
          <LocationPicker
            lat={
              pendingAddrId
                ? addresses.find((a) => a.id === pendingAddrId)?.lat
                : null
            }
            lng={
              pendingAddrId
                ? addresses.find((a) => a.id === pendingAddrId)?.lng
                : null
            }
            onConfirm={handleLocationConfirm}
            onClose={() => {
              setShowMap(false);
              setPendingAddrId(null);
            }}
          />
        )}

        <CustomerBottomNav active="profile" />
        {toast && <Toast message={toast} type={toastType} />}
      </div>
    </div>
  );
}
