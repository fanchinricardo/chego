import {
  ReactNode,
  InputHTMLAttributes,
  ButtonHTMLAttributes,
  useState,
} from "react";

// ── Paleta Chegô ──────────────────────────────────────────
export const colors = {
  noite: "#1c0a2e",
  roxoMedio: "#2d1445",
  rosa: "#e91e8c",
  amarelo: "#ffdd57",
  fundo: "#fdf4ff",
  bordaLilas: "#ead6ff",
  lilasClaro: "#f5eeff",
  lilasInput: "#fff0f8",
};

// ── Logo ─────────────────────────────────────────────────
export function Logo({
  size = 40,
  dark = false,
}: {
  size?: number;
  dark?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: "'Righteous', cursive",
        fontSize: size,
        color: dark ? colors.noite : "#fff",
        lineHeight: 1,
        letterSpacing: -0.5,
      }}
    >
      Cheg<span style={{ color: colors.rosa }}>ô</span>
    </span>
  );
}

// ── Input ─────────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  suffix?: ReactNode;
}

export function Input({ label, error, suffix, ...props }: InputProps) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && (
        <label
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: colors.noite,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {label}
        </label>
      )}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          style={{
            flex: 1,
            background: "#fff",
            border: `1.5px solid ${error ? colors.rosa : focused ? colors.rosa : colors.bordaLilas}`,
            borderRadius: 11,
            padding: "11px 13px",
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14,
            color: colors.noite,
            outline: "none",
            transition: "border 0.15s",
            width: "100%",
            ...props.style,
          }}
        />
        {suffix}
      </div>
      {error && (
        <span
          style={{
            fontSize: 11,
            color: colors.rosa,
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ── OTP Input ────────────────────────────────────────────
interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (val: string) => void;
}

export function OtpInput({ length = 4, value, onChange }: OtpInputProps) {
  const digits = value
    .split("")
    .concat(Array(length).fill(""))
    .slice(0, length);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    const inputs = document.querySelectorAll<HTMLInputElement>(".otp-digit");
    if (e.key === "Backspace") {
      const next = [...digits];
      next[i] = "";
      onChange(next.join(""));
      if (i > 0) inputs[i - 1]?.focus();
    }
  }

  function handleChange(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const char = e.target.value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[i] = char;
    onChange(next.join(""));
    const inputs = document.querySelectorAll<HTMLInputElement>(".otp-digit");
    if (char && i < length - 1) inputs[i + 1]?.focus();
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 6,
        justifyContent: "center",
        flexWrap: "nowrap",
        width: "100%",
      }}
    >
      {digits.map((d, i) => (
        <input
          key={i}
          className="otp-digit"
          maxLength={1}
          value={d}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          inputMode="numeric"
          style={{
            flex: 1,
            minWidth: 0,
            maxWidth: 48,
            height: 52,
            borderRadius: 10,
            border: `1.5px solid ${d ? colors.rosa : colors.bordaLilas}`,
            background: d ? colors.lilasInput : colors.fundo,
            textAlign: "center",
            fontSize: 18,
            fontWeight: 700,
            color: d ? colors.rosa : colors.noite,
            fontFamily: "'Space Grotesk', sans-serif",
            outline: "none",
            transition: "all 0.15s",
          }}
        />
      ))}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "dark" | "outline" | "ghost";
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({
  variant = "primary",
  loading,
  fullWidth,
  children,
  style,
  disabled,
  ...props
}: BtnProps) {
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: colors.rosa, color: "#fff", border: "none" },
    dark: { background: colors.noite, color: "#fff", border: "none" },
    outline: {
      background: "transparent",
      color: "#fff",
      border: `1.5px solid rgba(255,255,255,0.18)`,
    },
    ghost: {
      background: "#fff",
      color: colors.noite,
      border: `1.5px solid ${colors.bordaLilas}`,
    },
  };
  return (
    <button
      disabled={disabled || loading}
      {...props}
      style={{
        width: fullWidth ? "100%" : undefined,
        padding: "13px 20px",
        borderRadius: 13,
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 14,
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.6 : 1,
        transition: "opacity 0.15s, transform 0.1s",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        ...styles[variant],
        ...style,
      }}
      onMouseDown={(e) => {
        e.currentTarget.style.transform = "scale(0.97)";
      }}
      onMouseUp={(e) => {
        e.currentTarget.style.transform = "scale(1)";
      }}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}

// ── Spinner ───────────────────────────────────────────────
export function Spinner({
  size = 18,
  color = "#fff",
}: {
  size?: number;
  color?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={{ animation: "chegô-spin 0.8s linear infinite" }}
    >
      <style>{`@keyframes chegô-spin { to { transform: rotate(360deg) } }`}</style>
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke={color}
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Divider ───────────────────────────────────────────────
export function Divider({ label = "ou continue com" }: { label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ flex: 1, height: 1, background: colors.bordaLilas }} />
      <span
        style={{
          fontSize: 11,
          color: "#c4aad8",
          fontWeight: 500,
          fontFamily: "'Space Grotesk', sans-serif",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: colors.bordaLilas }} />
    </div>
  );
}

// ── Step bar ──────────────────────────────────────────────
export function StepBar({
  total,
  current,
}: {
  total: number;
  current: number;
}) {
  return (
    <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            background:
              i < current
                ? colors.rosa
                : i === current
                  ? colors.amarelo
                  : "rgba(255,255,255,0.15)",
            transition: "background 0.3s",
          }}
        />
      ))}
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────
interface ToastProps {
  message: string;
  type?: "success" | "error";
}

export function Toast({ message, type = "success" }: ToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 32,
        left: "50%",
        transform: "translateX(-50%)",
        background: type === "error" ? "#2d0a14" : "#0a2d1e",
        color: type === "error" ? "#ff6b8a" : "#4ade80",
        border: `1px solid ${type === "error" ? "#e91e8c" : "#22c55e"}`,
        borderRadius: 14,
        padding: "12px 20px",
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        zIndex: 9999,
        maxWidth: 320,
        textAlign: "center",
        animation: "chegô-fadein 0.3s ease",
      }}
    >
      <style>{`@keyframes chegô-fadein { from { opacity:0; transform: translateX(-50%) translateY(12px) } to { opacity:1; transform: translateX(-50%) translateY(0) } }`}</style>
      {type === "success" ? "✓ " : "✕ "}
      {message}
    </div>
  );
}
