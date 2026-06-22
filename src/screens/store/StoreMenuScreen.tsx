import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../lib/supabase";
import { useStore } from "../../hooks/useStore";
import { colors, Input, Button, Spinner, Toast } from "../../components/ui";
import { BottomNav } from "../store/StoreDashboard";
import Swal from "sweetalert2";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface DailyMenu {
  id: string;
  items: string; // Lista de pratos
  price: number | null;
  available_date: string;
  created_at: string;
}

const EMPTY_MENU = {
  items: "",
  price: "",
  available_date: new Date().toISOString().slice(0, 10),
};

export default function StoreMenuScreen() {
  const { store } = useStore();
  const storeId = store?.id ?? null;

  const [menus, setMenus] = useState<DailyMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_MENU);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    store?.logo_url ?? null,
  );
  const [uploading, setUploading] = useState(false);
  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file)); // Gera um preview local
    }
  }

  async function uploadImage(file: File) {
    const fileExt = file.name.split(".").pop();
    const fileName = `${store?.id}-${Math.random()}.${fileExt}`;
    const filePath = `store-logos/${fileName}`;

    // Upload para o bucket 'logos' (certifique-se que ele existe no Supabase)
    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Pega a URL pública
    const { data } = supabase.storage.from("logos").getPublicUrl(filePath);
    return data.publicUrl;
  }
  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  const fetchMenus = useCallback(async () => {
    if (!storeId) return;
    const { data } = await supabase
      .from("daily_menus") // Você precisará criar esta tabela
      .select("*")
      .eq("store_id", storeId)
      .order("available_date", { ascending: false })
      .limit(10);
    setMenus((data ?? []) as DailyMenu[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  async function handleSave() {
    if (!form.items) {
      return showToast("Descreva os itens do cardápio", "error");
    }

    setSaving(true);
    try {
      let menu_image_url: string | null = null;
      if (imageFile) {
        menu_image_url = await uploadImage(imageFile);
      }

      const { error: insertError } = await supabase.from("daily_menus").insert([
        {
          store_id: storeId,
          items: form.items,
          price: form.price ? parseFloat(form.price) : null,
          available_date: form.available_date,
          image_url: menu_image_url,
        },
      ]);

      if (insertError) throw insertError;

      // ✅ Passa os 3 argumentos corretamente
      await sendMenuNotification(form.items, form.price, menu_image_url);

      Swal.fire({
        icon: "success",
        title: "Cardápio Salvo!",
        text: "Seus clientes foram notificados.",
        timer: 2000,
        showConfirmButton: false,
      });

      setForm(EMPTY_MENU);
      setImageFile(null);
      setImagePreview(null);
      setShowForm(false);
      fetchMenus();
    } catch (e: any) {
      console.error(e);
      showToast(e.message || "Erro ao salvar", "error");
    } finally {
      setSaving(false);
    }
  }

  async function sendMenuNotification(
    items: string,
    price: any,
    imageUrl: string | null, // ✅ parâmetro que faltava
  ) {
    setSending(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/notify-daily-menu`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({
            store_id: storeId,
            store_name: store?.name,
            items,
            price,
            media: imageUrl,
            available_date: form.available_date,
          }),
        },
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Erro ao enviar notificações");
      showToast("✅ Clientes notificados!");
    } catch (e: any) {
      console.error("❌ Erro sendMenuNotification:", e.message);
      showToast(e.message, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite, padding: "20px" }}>
        <div
          style={{
            maxWidth: 520,
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h1
            style={{ color: "#fff", fontFamily: "'Righteous'", fontSize: 22 }}
          >
            🍴 Cardápio
          </h1>
          <Button variant="primary" onClick={() => setShowForm(!showForm)}>
            {showForm ? "Fechar" : "+ Novo"}
          </Button>
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {showForm && (
          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <Input
              type="date"
              label="Data"
              value={form.available_date}
              onChange={(e) =>
                setForm({ ...form, available_date: e.target.value })
              }
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <label
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                }}
              >
                Itens do Cardápio
              </label>
              <textarea
                placeholder="Ex: Arroz, feijão, bife acebolado e batata frita..."
                rows={5}
                style={{
                  border: `1.5px solid ${colors.bordaLilas}`,
                  borderRadius: 11,
                  padding: 10,
                }}
                value={form.items}
                onChange={(e) => setForm({ ...form, items: e.target.value })}
              />
            </div>
            {/* Seção de Imagem/Logo */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <label
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  border: `2px dashed ${colors.bordaLilas}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  overflow: "hidden",
                  position: "relative",
                  background: "#fff",
                }}
              >
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 24 }}>📷</span>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </label>
              <p style={{ fontSize: 11, color: colors.noite, fontWeight: 600 }}>
                Toque para {imagePreview ? "alterar" : "adicionar"} logo
              </p>
            </div>
            <Input
              label="Preço (opcional)"
              placeholder="25.90"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
            <Button loading={saving} onClick={handleSave}>
              Salvar e Notificar
            </Button>
          </div>
        )}

        {/* Listagem simples dos últimos cardápios */}
        {menus.map((menu) => (
          <div
            key={menu.id}
            style={{
              background: "#fff",
              padding: 14,
              borderRadius: 14,
              border: `1px solid ${colors.bordaLilas}`,
            }}
          >
            <p style={{ fontSize: 11, color: "#888" }}>
              {new Date(menu.available_date).toLocaleDateString("pt-BR")}
            </p>
            <p style={{ fontWeight: 700, margin: "4px 0" }}>{menu.items}</p>
            {menu.price && (
              <p style={{ color: colors.rosa, fontWeight: 700 }}>
                R$ {menu.price}
              </p>
            )}
          </div>
        ))}
      </div>

      {sending && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: 24,
              borderRadius: 16,
              textAlign: "center",
            }}
          >
            <Spinner color={colors.rosa} />
            <p style={{ marginTop: 10, fontWeight: 700 }}>
              Enviando cardápio aos clientes...
            </p>
          </div>
        </div>
      )}
      <BottomNav active="menu" />
      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
