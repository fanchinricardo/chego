import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { Logo, Button, Toast, colors } from "../components/ui";

export default function NewPasswordScreen() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  async function handleSave() {
    if (password.length < 6) {
      setError("Senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw new Error(error.message);
      setToast("Senha atualizada com sucesso! ✅");
      setTimeout(() => navigate("/", { replace: true }), 1500);
    } catch (e: any) {
      setError(e.message);
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
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ background: colors.noite, padding: "20px 24px 28px" }}>
        <Logo size={22} />
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            marginTop: 16,
            marginBottom: 4,
          }}
        >
          Nova <span style={{ color: colors.rosa }}>senha</span>
        </h2>
        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.5)" }}>
          Escolha uma nova senha para sua conta
        </p>
      </div>

      <div
        style={{
          flex: 1,
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <p style={{ fontSize: 12, color: "#dc2626" }}>{error}</p>
          </div>
        )}

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
            Nova senha
          </p>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="mínimo 6 caracteres"
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
            Confirmar senha
          </p>
          <input
            type={showPass ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="repita a senha"
            style={{
              width: "100%",
              padding: "12px 14px",
              borderRadius: 12,
              border: `1.5px solid ${confirm && confirm !== password ? "#fca5a5" : colors.bordaLilas}`,
              background: "#fff",
              fontSize: 14,
              color: colors.noite,
              fontFamily: "'Space Grotesk', sans-serif",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <Button
          variant="primary"
          fullWidth
          loading={loading}
          onClick={handleSave}
          style={{ marginTop: 8 }}
        >
          Salvar nova senha →
        </Button>
      </div>

      {toast && <Toast message={toast} type="success" />}
    </div>
  );
}
