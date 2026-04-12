import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Logo, Input, Button, OtpInput, Toast, colors } from '../components/ui'
import { useAuth } from '../contexts/AuthContext'

type Step = 'email' | 'otp' | 'success'

export default function RecoverPasswordScreen() {
  const navigate = useNavigate()
  const { sendPasswordReset } = useAuth()

  const [step, setStep]         = useState<Step>('email')
  const [email, setEmail]       = useState('')
  const [otp, setOtp]           = useState('')
  const [countdown, setCountdown] = useState(0)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [toast, setToast]       = useState('')

  function startCountdown() {
    setCountdown(60)
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0 }
        return c - 1
      })
    }, 1000)
  }

  async function handleSendEmail() {
    if (!email) { setError('Informe seu e-mail'); return }
    setLoading(true)
    setError('')
    try {
      await sendPasswordReset(email)
      setStep('otp')
      startCountdown()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (countdown > 0) return
    setLoading(true)
    try {
      await sendPasswordReset(email)
      startCountdown()
      setToast('Código reenviado!')
      setTimeout(() => setToast(''), 3000)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  // Na produção: verificar OTP via supabase.auth.verifyOtp
  function handleVerifyOtp() {
    if (otp.length < 4) { setError('Digite os 4 dígitos do código'); return }
    setStep('success')
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
      <div style={{ background: colors.noite, padding: "20px 24px 32px" }}>
        <button
          onClick={() => (step === "email" ? navigate(-1) : setStep("email"))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#fff",
            fontSize: 13,
            fontFamily: "'Space Grotesk', sans-serif",
            marginBottom: 16,
            padding: 0,
          }}
        >
          ← Voltar
        </button>
        <Logo size={28} />
        <p
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "#fff",
            marginTop: 12,
            lineHeight: 1.2,
          }}
        >
          {step === "success" ? "Tudo certo!" : "Recuperar "}
          {step !== "success" && (
            <span style={{ color: colors.rosa }}>senha</span>
          )}
        </p>
        <p
          style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 4 }}
        >
          {step === "email" && "Enviaremos um código no seu e-mail"}
          {step === "otp" && `Código enviado para ${email}`}
          {step === "success" && "Acesse seu e-mail para redefinir a senha"}
        </p>
      </div>

      {/* Corpo */}
      <div
        style={{
          flex: 1,
          padding: "28px 24px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* ── STEP EMAIL ── */}
        {step === "email" && (
          <>
            <Input
              label="E-mail cadastrado"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendEmail()}
              autoComplete="email"
              inputMode="email"
            />
            {error && (
              <p style={{ fontSize: 12, color: colors.rosa }}>{error}</p>
            )}
            <Button
              variant="primary"
              fullWidth
              loading={loading}
              onClick={handleSendEmail}
            >
              Enviar código
            </Button>
          </>
        )}

        {/* ── STEP OTP ── */}
        {step === "otp" && (
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
              <p style={{ fontSize: 13, color: "#888", textAlign: "center" }}>
                Digite o código de 4 dígitos enviado para{" "}
                <strong style={{ color: colors.noite }}>{email}</strong>
              </p>

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

            {error && (
              <p style={{ fontSize: 12, color: colors.rosa }}>{error}</p>
            )}

            <Button
              variant="primary"
              fullWidth
              onClick={handleVerifyOtp}
              disabled={otp.length < 4}
            >
              Verificar código
            </Button>
          </>
        )}

        {/* ── STEP SUCCESS ── */}
        {step === "success" && (
          <>
            <div
              style={{
                background: "#f0fff4",
                border: "1.5px solid #86efac",
                borderRadius: 16,
                padding: "28px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 12,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 26,
                }}
              >
                ✓
              </div>
              <p style={{ fontSize: 15, fontWeight: 700, color: "#166534" }}>
                Link enviado!
              </p>
              <p style={{ fontSize: 13, color: "#4ade80", lineHeight: 1.6 }}>
                Verifique sua caixa de entrada e clique no link para criar uma
                nova senha.
              </p>
            </div>

            <Button variant="dark" fullWidth onClick={() => navigate("/login")}>
              Voltar para o login
            </Button>
          </>
        )}
      </div>

      {toast && <Toast message={toast} />}
    </div>
  );
}