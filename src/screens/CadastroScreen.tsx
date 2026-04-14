import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Logo,
  Input,
  Button,
  OtpInput,
  StepBar,
  Toast,
  colors,
} from "../components/ui";
import { useAuth, SignUpData } from "../contexts/AuthContext";

type Role = "customer" | "store";
type Step = 0 | 1 | 2;

interface AccountType {
  role: Role;
  icon: string;
  label: string;
  sub: string;
}

const ACCOUNT_TYPES: AccountType[] = [
  {
    role: "customer",
    icon: "🛍️",
    label: "Cliente",
    sub: "Quero comprar nos comércios",
  },
  {
    role: "store",
    icon: "🏪",
    label: "Comércio",
    sub: "Quero vender meus produtos",
  },
];

const STEP_TITLES = [
  { title: "Que tipo de", accent: "conta?" },
  { title: "Seus", accent: "dados" },
  { title: "Confirmar", accent: "conta" },
];

export default function CadastroScreen() {
  const navigate = useNavigate();
  const { signUpWithEmail, sendOtp, verifyOtp } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [role, setRole] = useState<Role>("customer");

  // Dados pessoais
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  // OTP
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  function showToast(msg: string, type: "success" | "error" = "success") {
    setToast(msg);
    setToastType(type);
    setTimeout(() => setToast(""), 3500);
  }

  function startCountdown() {
    setCountdown(60);
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  // ── Validação passo 1 → 2 ──────────────────────────────
  function goToStep1() {
    setStep(1);
  }

  // ── Validação passo 2 → 3 ──────────────────────────────
  async function goToStep2() {
    const e: Record<string, string> = {};

    // Nome completo — mínimo 3 chars e deve ter pelo menos 2 palavras
    if (!fullName.trim()) e.fullName = "Informe seu nome completo";
    else if (fullName.trim().length < 3)
      e.fullName = "Nome deve ter no mínimo 3 caracteres";
    else if (
      fullName
        .trim()
        .split(" ")
        .filter((w) => w.length > 0).length < 2
    )
      e.fullName = "Informe nome e sobrenome";

    // Telefone — mínimo 10 dígitos (com DDD)
    const phoneDigits = phone.replace(/\D/g, "");
    if (!phone.trim()) e.phone = "Informe seu WhatsApp";
    else if (phoneDigits.length < 10)
      e.phone = "Informe o número com DDD (ex: 11999999999)";
    else if (phoneDigits.length > 11) e.phone = "Número inválido";

    // E-mail básico
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim()) e.email = "Informe seu e-mail";
    else if (!emailRegex.test(email.trim())) e.email = "E-mail inválido";

    // Senha — mínimo 6 chars
    if (password.length < 6)
      e.password = "Senha deve ter no mínimo 6 caracteres";

    if (Object.keys(e).length) {
      setErrors(e);
      return;
    }
    setErrors({});

    setLoading(true);
    try {
      // Cria conta no Supabase Auth
      await signUpWithEmail({
        email,
        password,
        full_name: fullName,
        phone,
        role,
      } as SignUpData);
      // Envia OTP para o WhatsApp/SMS
      const cleaned = phone.replace(/\D/g, "");
      await sendOtp("+55" + cleaned);
      startCountdown();
      setStep(2);
    } catch (err: any) {
      showToast(
        err.message.includes("already registered")
          ? "Este e-mail já está cadastrado"
          : err.message,
        "error",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Verificar OTP e finalizar ──────────────────────────
  async function handleVerify() {
    if (otp.length < 4) {
      showToast("Digite os 4 dígitos", "error");
      return;
    }
    setLoading(true);
    try {
      const cleaned = phone.replace(/\D/g, "");
      await verifyOtp("+55" + cleaned, otp);
      showToast("Conta criada com sucesso!");
      setTimeout(() => navigate("/home"), 1200);
    } catch (err: any) {
      showToast("Código inválido ou expirado", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (countdown > 0) return;
    const cleaned = phone.replace(/\D/g, "");
    await sendOtp("+55" + cleaned);
    startCountdown();
    showToast("Código reenviado!");
  }

  function back() {
    if (step === 0) navigate(-1);
    else setStep((step - 1) as Step);
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
      {/* ── Header ── */}
      <div style={{ background: colors.noite }}>
        <button
          onClick={back}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "rgba(255,255,255,0.35)",
            fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 14,
            padding: 0,
          }}
        >
          ← Voltar
        </button>

        <StepBar total={3} current={step} />

        <p
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.3)",
            marginBottom: 6,
          }}
        >
          Passo {step + 1} de 3
        </p>
        <p
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: "#fff",
            lineHeight: 1.2,
          }}
        >
          {STEP_TITLES[step].title}{" "}
          <span style={{ color: colors.rosa }}>{STEP_TITLES[step].accent}</span>
        </p>
      </div>
      {/* fecha maxWidth header */}

      {/* ── Corpo ── */}
      <div
        style={{
          flex: 1,
          maxWidth: 520,
          margin: "0 auto",
          width: "100%",
          padding: "24px 24px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          minHeight: 0,
        }}
      >
        {/* ── PASSO 0: Tipo de conta ── */}
        {step === 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {ACCOUNT_TYPES.map((t) => (
                <div
                  key={t.role}
                  onClick={() => setRole(t.role)}
                  style={{
                    borderRadius: 16,
                    padding: "24px 12px",
                    border: `2px solid ${role === t.role ? colors.rosa : colors.bordaLilas}`,
                    background: role === t.role ? colors.lilasInput : "#fff",
                    cursor: "pointer",
                    textAlign: "center",
                    transition: "all 0.15s",
                    boxShadow:
                      role === t.role
                        ? "0 4px 16px rgba(233,30,140,0.15)"
                        : "none",
                  }}
                >
                  <div style={{ fontSize: 36, marginBottom: 10 }}>{t.icon}</div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: colors.noite,
                    }}
                  >
                    {t.label}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#aaa",
                      marginTop: 4,
                      lineHeight: 1.4,
                    }}
                  >
                    {t.sub}
                  </div>
                </div>
              ))}
            </div>

            <Button
              variant="primary"
              fullWidth
              onClick={goToStep1}
              style={{ marginTop: 8 }}
            >
              Continuar →
            </Button>

            <p style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
              Já tenho conta.{" "}
              <span
                onClick={() => navigate("/login")}
                style={{
                  color: colors.rosa,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Fazer login
              </span>
            </p>
          </div>
        )}

        {/* ── PASSO 1: Dados pessoais ── */}
        {step === 1 && (
          <>
            <Input
              label="Nome completo"
              placeholder="João da Silva"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={errors.fullName}
              autoComplete="name"
            />
            <Input
              label="Telefone / WhatsApp"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              error={errors.phone}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
            />
            <Input
              label="E-mail"
              placeholder="joao@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              type="email"
              inputMode="email"
              autoComplete="email"
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              <Input
                label="Senha"
                placeholder="mínimo 6 caracteres"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                error={errors.password}
                autoComplete="new-password"
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
              {/* Indicador de força da senha */}
              {password.length > 0 && (
                <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background:
                          password.length >= n * 4
                            ? n === 1
                              ? colors.rosa
                              : n === 2
                                ? colors.amarelo
                                : "#22c55e"
                            : colors.bordaLilas,
                        transition: "background 0.3s",
                      }}
                    />
                  ))}
                  <span style={{ fontSize: 10, color: "#aaa", minWidth: 40 }}>
                    {password.length < 6
                      ? "fraca"
                      : password.length < 8
                        ? "média"
                        : "forte"}
                  </span>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={goToStep2}
              style={{ marginTop: 8 }}
            >
              Continuar →
            </Button>
          </>
        )}

        {/* ── PASSO 2: Verificação OTP ── */}
        {step === 2 && (
          <>
            <div
              style={{
                background: "#fff",
                border: `1.5px solid ${colors.bordaLilas}`,
                borderRadius: 16,
                padding: "24px 20px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 16,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <p style={{ fontSize: 13, color: "#888" }}>
                  Enviamos um código para
                </p>
                <p
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: colors.noite,
                    marginTop: 2,
                  }}
                >
                  {phone}
                </p>
              </div>

              <OtpInput value={otp} onChange={setOtp} />

              <button
                onClick={handleResend}
                disabled={countdown > 0}
                style={{
                  background: "none",
                  border: "none",
                  cursor: countdown > 0 ? "default" : "pointer",
                  fontSize: 12,
                  fontFamily: "'Space Grotesk', sans-serif",
                  color: countdown > 0 ? "#bbb" : colors.rosa,
                  fontWeight: 600,
                }}
              >
                {countdown > 0
                  ? `Reenviar em 00:${String(countdown).padStart(2, "0")}`
                  : "Reenviar código"}
              </button>
            </div>

            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleVerify}
              disabled={otp.length < 4}
            >
              Verificar e entrar
            </Button>

            {/* Card informativo */}
            <div
              style={{
                background: colors.lilasClaro,
                borderRadius: 12,
                padding: "14px 16px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  background: colors.rosa,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  color: "#fff",
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ✓
              </div>
              <div>
                <p
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: colors.noite,
                    marginBottom: 3,
                  }}
                >
                  Quase lá!
                </p>
                <p style={{ fontSize: 11, color: "#888", lineHeight: 1.6 }}>
                  {role === "customer"
                    ? "Após verificar, você já pode explorar todos os comércios do seu bairro."
                    : role === "store"
                      ? "Após verificar, configure sua loja e comece a vender."
                      : "Após verificar, você poderá receber rotas de entrega."}
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  );
}
