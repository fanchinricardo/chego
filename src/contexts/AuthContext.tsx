import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase, Profile } from "../lib/supabase";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (data: SignUpData) => Promise<void>;
  signOut: () => Promise<void>;
  sendOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, token: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

export interface SignUpData {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  role: "customer" | "store" | "motoboy";
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Se sessão foi invalidada, limpa tudo
        if (event === "SIGNED_OUT" || !session) {
          setSession(null);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        setSession(session);
        setUser(session.user);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadOrCreateProfile(user).finally(() => setLoading(false));
  }, [user]);

  async function loadOrCreateProfile(u: User) {
    // 1. Tenta carregar o profile existente — usa cast para evitar erro de enum
    for (let i = 0; i < 5; i++) {
      if (i > 0) await new Promise((r) => setTimeout(r, 800));

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, created_at")
        .eq("id", u.id)
        .maybeSingle();

      if (error) console.warn(`Tentativa ${i + 1}:`, error.message);
      if (data) {
        setProfile(data as any);
        return;
      }
    }

    // 2. Profile não existe — cria via RPC
    const meta = u.user_metadata ?? {};
    const validRoles = ["store", "customer", "motoboy"];
    const role = validRoles.includes(meta.role) ? meta.role : "customer";
    const full_name =
      meta.full_name?.trim() ||
      meta.name?.trim() ||
      u.email?.split("@")[0] ||
      "Usuário";

    const { error } = await supabase.rpc("create_profile_if_not_exists", {
      p_id: u.id,
      p_full_name: full_name,
      p_phone: meta.phone?.trim() || null,
      p_role: role,
    });

    if (error) {
      console.error("Erro ao criar profile:", error.message);
      return;
    }

    const { data: created } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", u.id)
      .maybeSingle();

    if (created) setProfile(created as Profile);
  }

  async function signInWithEmail(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
  }

  async function signUpWithEmail(data: SignUpData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.full_name,
          phone: data.phone,
          role: data.role,
        },
      },
    });
    if (error) throw new Error(translateAuthError(error.message));

    // NÃO inserir profile aqui — o trigger on_auth_user_created cuida disso
    // O loadOrCreateProfile vai buscar o profile quando o usuário logar
  }

  async function sendOtp(phone: string) {
    const { error } = await supabase.auth.signInWithOtp({ phone });
    if (error) throw new Error(error.message);
  }

  async function verifyOtp(phone: string, token: string) {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: "sms",
    });
    if (error) throw new Error(translateAuthError(error.message));
  }

  async function sendPasswordReset(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    if (error) throw new Error(error.message);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signInWithEmail,
        signInWithGoogle,
        signUpWithEmail,
        signOut,
        sendOtp,
        verifyOtp,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

function translateAuthError(msg: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "E-mail ou senha incorretos",
    "Email not confirmed": "Confirme seu e-mail antes de entrar",
    "User already registered": "Este e-mail já está cadastrado",
    "Password should be at least 6": "Senha deve ter no mínimo 6 caracteres",
    "Phone number format is invalid": "Telefone inválido. Use DDI+DDD+número",
    "Token has expired": "Código expirado. Solicite um novo",
    "Invalid OTP": "Código inválido",
    over_request_rate_limit: "Muitas tentativas. Aguarde alguns minutos",
  };
  for (const [key, value] of Object.entries(map))
    if (msg.toLowerCase().includes(key.toLowerCase())) return value;
  return msg;
}
