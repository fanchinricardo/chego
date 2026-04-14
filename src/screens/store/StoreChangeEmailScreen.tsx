import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Button, Toast } from "../../components/ui";

export default function StoreChangeEmailScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [done, setDone] = useState(false);

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3000);
  }

  async function handleSave() {
    if (!newEmail.trim()) {
      showToast("Informe o novo e-mail", "error");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      showToast("E-mail inválido", "error");
      return;
    }
    if (!password) {
      showToast("Confirme sua senha atual", "error");
      return;
    }

    setLoading(true);
    try {
      // Reautentica para confirmar identidade
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email ?? "",
        password: password,
      });
      if (signInError) throw new Error("Senha incorreta");

      // Atualiza o email
      const { error } = await supabase.auth.updateUser({
        email: newEmail.trim(),
      });
      if (error) throw new Error(error.message);

      setDone(true);
      showToast("Confirmação enviada! Verifique seu novo e-mail. ✅");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 24px" }}
        >
          <button
            onClick={() => navigate(-1)}
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
              fontSize: 18,
              fontWeight: 700,
              color: "#fff",
              marginBottom: 2,
            }}
          >
            Alterar e-mail
          </p>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
            E-mail atual: {user?.email}
          </p>
        </div>
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          padding: "24px 20px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {done ? (
          <div
            style={{
              background: "#f0fdf4",
              border: "1px solid #86efac",
              borderRadius: 14,
              padding: "24px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ fontSize: 32, marginBottom: 12 }}>📧</p>
            <p
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#15803d",
                marginBottom: 8,
              }}
            >
              Confirmação enviada!
            </p>
            <p style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
              Enviamos um link de confirmação para <strong>{newEmail}</strong>.
              Acesse seu e-mail e clique no link para concluir a alteração.
            </p>
            <button
              onClick={() => navigate(-1)}
              style={{
                marginTop: 20,
                padding: "12px 24px",
                borderRadius: 12,
                background: "#15803d",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Voltar ao perfil
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                background: "#fff8e6",
                border: "1px solid #fcd34d",
                borderRadius: 12,
                padding: "12px 14px",
              }}
            >
              <p style={{ fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
                ⚠️ Após alterar, você precisará confirmar o novo e-mail antes de
                fazer login com ele.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.noite,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Novo e-mail
              </p>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
                style={{
                  padding: "12px 14px",
                  borderRadius: 12,
                  border: `1.5px solid ${colors.bordaLilas}`,
                  background: "#fff",
                  fontSize: 14,
                  color: colors.noite,
                  fontFamily: "'Space Grotesk', sans-serif",
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <p
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: colors.noite,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                Senha atual
              </p>
              <div style={{ position: "relative" }}>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Confirme sua senha para continuar"
                  style={{
                    width: "100%",
                    padding: "12px 44px 12px 14px",
                    borderRadius: 12,
                    border: `1.5px solid ${colors.bordaLilas}`,
                    background: "#fff",
                    fontSize: 14,
                    color: colors.noite,
                    fontFamily: "'Space Grotesk', sans-serif",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
                  }}
                >
                  {showPass ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleSave}
              style={{ marginTop: 8 }}
            >
              📧 Alterar e-mail
            </Button>
          </>
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
