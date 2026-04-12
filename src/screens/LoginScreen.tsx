import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Logo, Input, Button, Divider, Toast, colors } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export default function LoginScreen() {
  const navigate = useNavigate();
  const { signInWithEmail, signInWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoad, setGoogleLoad] = useState(false);
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
      // AuthContext redireciona automaticamente via useEffect no Splash
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

  async function handleGoogle() {
    setGoogleLoad(true);
    try {
      await signInWithGoogle();
    } catch (e: any) {
      showError(e.message);
      setGoogleLoad(false);
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
      {/* ── Header roxo ── */}
      <div
        style={{
          background: colors.noite,
          padding: "20px 24px 32px",
        }}
      >
        <button
          onClick={() => navigate(-1)}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 16,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          ← Voltar
        </button>
        <Logo size={32} />
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            marginTop: 12,
            lineHeight: 1.2,
          }}
        >
          Bem-vindo <span style={{ color: colors.rosa }}>de volta!</span>
        </p>
        <p
          style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}
        >
          Entre na sua conta Chegô
        </p>
      </div>

      {/* ── Formulário ── */}
      <div
        style={{
          flex: 1,
          padding: "28px 24px 36px",
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

        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
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
          style={{ marginTop: 4 }}
        >
          Entrar agora
        </Button>

        <Divider />

        {/* Link cadastro */}
        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#888",
            marginTop: 4,
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

      {toast && <Toast message={toast} />}
    </div>
  );
}
