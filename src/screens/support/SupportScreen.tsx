import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { colors, Spinner } from "../../components/ui";

const ADMIN_ID = "f892db9d-39a4-41ff-bef3-3c6460fa840d";

interface Message {
  id: string;
  conversa_id: string;
  remetente_id: string;
  remetente_nome: string;
  mensagem: string;
  tipo: string | null;
  created_at: string;
}

export default function SupportScreen() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.id === ADMIN_ID;

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [conversaId, setConversaId] = useState<string | null>(null);
  const [status, setStatus] = useState<"aberta" | "encerrada">("aberta");
  const [conversas, setConversas] = useState<any[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ending, setEnding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const conversaIdRef = useRef<string | null>(null);

  useEffect(() => {
    conversaIdRef.current = conversaId;
  }, [conversaId]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const poll = useCallback(async () => {
    const id = conversaIdRef.current;
    if (!id) return;
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversa_id", id)
      .order("created_at", { ascending: true });
    if (data)
      setMessages((prev) =>
        prev.length === data.length ? prev : (data as Message[]),
      );
    const { data: conv } = await supabase
      .from("support_conversations")
      .select("status")
      .eq("id", id)
      .single();
    if (conv) setStatus(conv.status);
  }, []);

  const pollConversas = useCallback(async () => {
    const { data, error } = await supabase
      .from("support_conversations")
      .select(
        "id, status, criado_em, comercio_id, profiles:comercio_id(full_name)",
      )
      .order("criado_em", { ascending: false });
    if (data) setConversas(data);
  }, []);

  useEffect(() => {
    if (!conversaId) return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [conversaId, poll]);

  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(pollConversas, 5000);
    return () => clearInterval(interval);
  }, [isAdmin, pollConversas]);

  useEffect(() => {
    if (user) init();
  }, [user]);

  async function init() {
    setLoading(true);
    if (isAdmin) {
      await pollConversas();
    } else {
      const conv = await getOrCreateConversa();
      if (conv) {
        setConversaId(conv.id);
        setStatus(conv.status);
        await loadMessages(conv.id);
      }
    }
    setLoading(false);
  }

  async function getOrCreateConversa() {
    if (!user) return null;
    const { data: ex } = await supabase
      .from("support_conversations")
      .select("*")
      .eq("comercio_id", user.id)
      .eq("status", "aberta")
      .maybeSingle();
    if (ex) return ex;
    const { data } = await supabase
      .from("support_conversations")
      .insert({ comercio_id: user.id, status: "aberta" })
      .select()
      .single();
    return data;
  }

  async function loadMessages(id: string) {
    const { data } = await supabase
      .from("support_messages")
      .select("*")
      .eq("conversa_id", id)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
  }

  async function selectConversa(conv: any) {
    setConversaId(conv.id);
    setStatus(conv.status);
    setMessages([]);
    await loadMessages(conv.id);
    setSidebarOpen(false);
  }

  async function sendMessage() {
    if (!text.trim() || !conversaId || !user || status === "encerrada") return;
    const nome = isAdmin ? "Suporte Chegô" : (profile?.full_name ?? "Comércio");
    await supabase.from("support_messages").insert({
      conversa_id: conversaId,
      remetente_id: user.id,
      remetente_nome: nome,
      mensagem: text.trim(),
      tipo: "texto",
    });
    setText("");
    await poll();
    // Notifica via WhatsApp
    if (isAdmin) {
      await notifySupport("admin_reply", text.trim());
    } else if (messages.length === 0) {
      // Primeira mensagem — notifica admin
      await notifySupport("new_conversation", text.trim());
    }
  }

  async function notifySupport(type: string, message: string) {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-support`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ type, conversa_id: conversaId, message }),
        },
      );
    } catch (e) {
      console.error("notify-support:", e);
    }
  }

  async function sendFile(file: File) {
    if (!conversaId || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const fileName = `support/${conversaId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("support-files")
        .upload(fileName, file);
      if (error) throw error;
      const { data: urlData } = supabase.storage
        .from("support-files")
        .getPublicUrl(fileName);
      const isImage = file.type.startsWith("image/");
      const nome = isAdmin
        ? "Suporte Chegô"
        : (profile?.full_name ?? "Comércio");
      await supabase.from("support_messages").insert({
        conversa_id: conversaId,
        remetente_id: user.id,
        remetente_nome: nome,
        mensagem: urlData.publicUrl,
        tipo: isImage ? "imagem" : "arquivo",
      });
      await poll();
    } catch (e: any) {
      console.error("upload:", e);
    } finally {
      setUploading(false);
    }
  }

  async function endConversation() {
    if (!conversaId) return;
    setEnding(true);
    await supabase
      .from("support_conversations")
      .update({ status: "encerrada" })
      .eq("id", conversaId);
    await supabase.from("support_messages").insert({
      conversa_id: conversaId,
      remetente_id: user!.id,
      remetente_nome: "Sistema",
      mensagem: "✅ Atendimento encerrado.",
      tipo: "sistema",
    });
    setStatus("encerrada");
    setEnding(false);
    if (isAdmin) {
      await pollConversas();
      await notifySupport(
        "conversation_ended",
        "Seu atendimento foi encerrado pelo suporte.",
      );
    }
  }

  async function newConversation() {
    if (!user) return;
    const { data } = await supabase
      .from("support_conversations")
      .insert({ comercio_id: user.id, status: "aberta" })
      .select()
      .single();
    if (data) {
      setConversaId(data.id);
      setStatus("aberta");
      setMessages([]);
    }
  }

  function fmtDate(d: string) {
    try {
      const date = new Date(d.endsWith("Z") ? d : d + "Z");
      if (isNaN(date.getTime())) return "";
      const hoje = new Date();
      return date.toDateString() === hoje.toDateString()
        ? date.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          })
        : date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
    } catch {
      return "";
    }
  }

  function nomeDaConversa(conv: any) {
    return (
      conv?.profiles?.full_name ?? conv?.comercio_id?.slice(0, 8) ?? "Comércio"
    );
  }

  const isEncerrada = status === "encerrada";

  if (loading)
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: colors.fundo,
        }}
      >
        <Spinner color={colors.rosa} />
      </div>
    );

  // Mensagens
  const renderMessages = () => (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {messages.length === 0 && !isAdmin && (
        <div
          style={{ textAlign: "center", padding: "40px 20px", color: "#aaa" }}
        >
          <p style={{ fontSize: 32, marginBottom: 8 }}>👋</p>
          <p style={{ fontSize: 14, fontWeight: 600, color: colors.noite }}>
            Como podemos ajudar?
          </p>
          <p style={{ fontSize: 12, marginTop: 4 }}>
            Envie sua mensagem e responderemos em breve.
          </p>
        </div>
      )}
      {messages.map((msg) => {
        const isMe = msg.remetente_id === user?.id;
        if (msg.tipo === "sistema")
          return (
            <div key={msg.id} style={{ textAlign: "center" }}>
              <span
                style={{
                  fontSize: 11,
                  color: "#888",
                  background: "#e0e0e0",
                  borderRadius: 20,
                  padding: "3px 12px",
                }}
              >
                {msg.mensagem}
              </span>
            </div>
          );
        return (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: isMe ? "flex-end" : "flex-start",
            }}
          >
            <div style={{ maxWidth: "75%" }}>
              {!isMe && (
                <p
                  style={{
                    fontSize: 11,
                    color: "#888",
                    marginBottom: 3,
                    marginLeft: 4,
                  }}
                >
                  {msg.remetente_nome}
                </p>
              )}
              <div
                style={{
                  background: isMe ? colors.rosa : "#fff",
                  color: isMe ? "#fff" : colors.noite,
                  borderRadius: isMe
                    ? "18px 18px 4px 18px"
                    : "18px 18px 18px 4px",
                  padding: "10px 14px",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                }}
              >
                {msg.tipo === "imagem" ? (
                  <img
                    src={msg.mensagem}
                    style={{
                      maxWidth: "100%",
                      borderRadius: 8,
                      display: "block",
                    }}
                    loading="lazy"
                  />
                ) : msg.tipo === "arquivo" ? (
                  <a
                    href={msg.mensagem}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: isMe ? "#fff" : colors.rosa,
                      fontSize: 13,
                      textDecoration: "underline",
                    }}
                  >
                    📎 {msg.mensagem.split("/").pop()}
                  </a>
                ) : (
                  <p
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.mensagem}
                  </p>
                )}
                <p
                  style={{
                    fontSize: 10,
                    marginTop: 4,
                    textAlign: "right",
                    opacity: 0.7,
                  }}
                >
                  {fmtDate(msg.created_at)}
                </p>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={endRef} />
    </div>
  );

  // Input
  const renderInput = () => {
    if (isEncerrada)
      return (
        <div
          style={{
            background: "#fff",
            borderTop: "1px solid #eee",
            padding: "14px 16px",
            textAlign: "center",
            flexShrink: 0,
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "#888",
              marginBottom: isAdmin ? 0 : 10,
            }}
          >
            Atendimento encerrado.
          </p>
          {!isAdmin && (
            <button
              onClick={newConversation}
              style={{
                background: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
                marginTop: 8,
              }}
            >
              Abrir novo atendimento
            </button>
          )}
        </div>
      );
    return (
      <div
        style={{
          background: "#fff",
          borderTop: "1px solid #eee",
          padding: "10px 12px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) sendFile(f);
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: colors.lilasClaro,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {uploading ? "⏳" : "📎"}
        </button>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Digite sua mensagem..."
          style={{
            flex: 1,
            border: `1.5px solid ${colors.bordaLilas}`,
            borderRadius: 20,
            padding: "10px 16px",
            fontSize: 13,
            outline: "none",
            fontFamily: "'Space Grotesk', sans-serif",
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!text.trim()}
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: text.trim() ? colors.rosa : "#ddd",
            color: "#fff",
            border: "none",
            cursor: text.trim() ? "pointer" : "default",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    );
  };

  // ── COMÉRCIO ────────────────────────────────────────────────────────────────
  if (!isAdmin)
    return (
      <div
        style={{
          height: "100dvh",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Space Grotesk', sans-serif",
          background: "#f0f2f5",
        }}
      >
        <div
          style={{
            background: colors.noite,
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => navigate(-1)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              fontSize: 20,
              padding: "0 4px",
              flexShrink: 0,
            }}
          >
            ←
          </button>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: colors.rosa,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 18 }}>🎧</span>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              Suporte Chegô
            </p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                marginTop: 2,
              }}
            >
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: isEncerrada ? "#aaa" : "#22c55e",
                }}
              />
              <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                {isEncerrada ? "Encerrado" : "Em atendimento"}
              </p>
            </div>
          </div>
        </div>
        {renderMessages()}
        {conversaId && renderInput()}
      </div>
    );

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        fontFamily: "'Space Grotesk', sans-serif",
        background: "#f0f2f5",
        position: "relative",
      }}
    >
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 20,
          }}
        />
      )}

      {/* Sidebar */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          height: "100%",
          width: 280,
          background: "#fff",
          borderRight: "1px solid #eee",
          display: "flex",
          flexDirection: "column",
          zIndex: 30,
          transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.2s",
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #eee",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>
            Atendimentos{" "}
            <span
              style={{
                fontSize: 11,
                background: "#f0f0f0",
                color: "#888",
                borderRadius: 10,
                padding: "1px 8px",
                marginLeft: 4,
              }}
            >
              {conversas.length}
            </span>
          </p>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#aaa",
              fontSize: 20,
            }}
          >
            ×
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {conversas.length === 0 && (
            <p
              style={{
                textAlign: "center",
                padding: 20,
                color: "#aaa",
                fontSize: 13,
              }}
            >
              Nenhum atendimento
            </p>
          )}
          {conversas.map((conv: any) => {
            const isActive = conv.id === conversaId;
            const isOpen = conv.status === "aberta";
            return (
              <button
                key={conv.id}
                onClick={() => selectConversa(conv)}
                style={{
                  width: "100%",
                  padding: "12px 16px",
                  borderBottom: "1px solid #f5f5f5",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  background: isActive ? "#f0fdf4" : "transparent",
                  borderLeft: `3px solid ${isActive ? "#22c55e" : "transparent"}`,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: isOpen ? "#dcfce7" : "#f0f0f0",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isOpen ? "#15803d" : "#888",
                    }}
                  >
                    {nomeDaConversa(conv).charAt(0).toUpperCase()}
                  </p>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.noite,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {nomeDaConversa(conv)}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        color: "#aaa",
                        flexShrink: 0,
                        marginLeft: 4,
                      }}
                    >
                      {fmtDate(conv.criado_em)}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: isOpen ? "#dcfce7" : "#f0f0f0",
                      color: isOpen ? "#15803d" : "#888",
                      borderRadius: 10,
                      padding: "1px 7px",
                    }}
                  >
                    {isOpen ? "Em aberto" : "Encerrado"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            background: colors.noite,
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "none",
              borderRadius: 8,
              padding: "7px 10px",
              cursor: "pointer",
              color: "#fff",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {conversaId
                ? nomeDaConversa(
                    conversas.find((c: any) => c.id === conversaId),
                  )
                : "Painel de Suporte"}
            </p>
            {conversaId && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 2,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: isEncerrada ? "#aaa" : "#22c55e",
                  }}
                />
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }}>
                  {isEncerrada ? "Encerrado" : "Em aberto"}
                </p>
              </div>
            )}
          </div>
          {conversaId && !isEncerrada && (
            <button
              onClick={endConversation}
              disabled={ending}
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                borderRadius: 8,
                padding: "6px 12px",
                color: "#fca5a5",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {ending ? "Encerrando..." : "Encerrar"}
            </button>
          )}
        </div>

        {!conversaId ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#aaa",
              gap: 12,
            }}
          >
            <p style={{ fontSize: 40 }}>💬</p>
            <p style={{ fontSize: 14, fontWeight: 600 }}>
              Selecione um atendimento
            </p>
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                background: "#22c55e",
                color: "#fff",
                border: "none",
                borderRadius: 20,
                padding: "8px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              Ver atendimentos
            </button>
          </div>
        ) : (
          <>
            {renderMessages()}
            {renderInput()}
          </>
        )}
      </div>
    </div>
  );
}
