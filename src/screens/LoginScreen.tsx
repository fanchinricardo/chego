import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Input, Button, Toast, colors } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signInWithEmail } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  function showError(msg: string) {
    setError(msg);
    setTimeout(() => setError(""), 4000);
  }

  async function handleLogin() {
    if (!email || !password) {
      showError("Preencha e-mail e senha");
      return;
    }
    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (e: any) {
      showError(
        e.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos"
          : e.message,
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "20px 24px 36px" }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.35)",
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
              marginBottom: 20,
              padding: 0,
            }}
          >
            ← Voltar
          </button>
          <Logo size={34} />
          <p
            style={{
              fontSize: 26,
              fontWeight: 700,
              color: "#fff",
              marginTop: 14,
              lineHeight: 1.2,
            }}
          >
            Bem-vindo <span style={{ color: colors.rosa }}>de volta!</span>
          </p>
          <p
            style={{
              fontSize: 14,
              color: "rgba(255,255,255,0.45)",
              marginTop: 6,
            }}
          >
            Entre na sua conta Chegô
          </p>
        </div>
      </div>

      {/* Formulário — card flutuando sobre o header */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "0 20px",
          marginTop: -20,
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 20,
            padding: "28px 24px 32px",
            boxShadow: "0 4px 32px rgba(28,10,46,0.10)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <Input
            label="E-mail"
            type="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            autoComplete="email"
            inputMode="email"
          />

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <Input
              label="Senha"
              type={showPass ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              autoComplete="current-password"
              suffix={
                <button
                  onClick={() => setShowPass((s) => !s)}
                  style={{
                    width: 36,
                    height: 36,
                    flexShrink: 0,
                    background: colors.lilasClaro,
                    border: `1px solid ${colors.bordaLilas}`,
                    borderRadius: 9,
                    cursor: "pointer",
                    fontSize: 15,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {showPass ? "🙈" : "👁"}
                </button>
              }
            />
            <button
              onClick={() => navigate("/recuperar-senha")}
              style={{
                alignSelf: "flex-end",
                background: "none",
                border: "none",
                color: colors.rosa,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Esqueci minha senha
            </button>
          </div>

          {error && (
            <div
              style={{
                background: "#fff0f3",
                border: `1px solid ${colors.rosa}`,
                borderRadius: 10,
                padding: "10px 14px",
                fontSize: 13,
                color: colors.rosa,
                fontWeight: 500,
              }}
            >
              ⚠ {error}
            </div>
          )}

          <Button
            variant="primary"
            fullWidth
            loading={loading}
            onClick={handleLogin}
            style={{ fontSize: 15, marginTop: 2 }}
          >
            Entrar agora
          </Button>

          <p
            style={{
              textAlign: "center",
              fontSize: 13,
              color: "#aaa",
              margin: 0,
            }}
          >
            Não tem conta?{" "}
            <span
              onClick={() => navigate("/cadastro")}
              style={{ color: colors.rosa, fontWeight: 700, cursor: "pointer" }}
            >
              Criar agora
            </span>
          </p>
        </div>
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}
