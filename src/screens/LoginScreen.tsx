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
        background: colors.noite,
        display: "flex",
        flexDirection: "column",
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "20px 24px 0",
        }}
      >
        {/* Botão voltar visível */}
        <button
          onClick={() => navigate(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(255,255,255,0.12)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: 10,
            padding: "8px 16px",
            cursor: "pointer",
            color: "#fff",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 32,
          }}
        >
          ← Voltar
        </button>

        <Logo size={36} />
        <p
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: "#fff",
            marginTop: 16,
            lineHeight: 1.2,
          }}
        >
          Bem-vindo <span style={{ color: colors.rosa }}>de volta!</span>
        </p>
        <p
          style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginTop: 8 }}
        >
          Entre na sua conta Chegô
        </p>
      </div>

      {/* Card do formulário */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "32px 24px 40px",
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: 24,
            padding: "32px 24px",
            boxShadow: "0 8px 40px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
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

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
                    width: 38,
                    height: 38,
                    flexShrink: 0,
                    background: colors.lilasClaro,
                    border: `1px solid ${colors.bordaLilas}`,
                    borderRadius: 10,
                    cursor: "pointer",
                    fontSize: 16,
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
                fontSize: 13,
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
                borderRadius: 12,
                padding: "12px 16px",
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
            style={{ fontSize: 16, padding: "15px" }}
          >
            Entrar agora
          </Button>

          <div style={{ height: 1, background: colors.bordaLilas }} />

          <p
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#888",
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
