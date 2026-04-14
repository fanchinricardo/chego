import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import {
  useCustomerStores,
  useStoreGroups,
  StorePublic,
} from "../../hooks/useCustomer";
import { colors, Logo, Spinner } from "../../components/ui";
import { CustomerBottomNav } from "./CustomerBottomNav";

export default function CustomerHomeScreen() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { itemCount } = useCart();

  const [selectedGroup, setSelectedGroup] = useState<string | undefined>(
    undefined,
  );
  const [search, setSearch] = useState("");
  const [searchActive, setSearchActive] = useState(false);

  const { groups } = useStoreGroups();
  const { stores, loading } = useCustomerStores(
    selectedGroup,
    searchActive ? search : undefined,
  );

  function handleSearch(e: React.ChangeEvent<HTMLInputElement>) {
    setSearch(e.target.value);
    setSearchActive(e.target.value.length > 1);
  }
  function clearSearch() {
    setSearch("");
    setSearchActive(false);
  }

  const openStores = stores.filter((s) => s.open_now);
  const closedStores = stores.filter((s) => !s.open_now);

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: colors.fundo,
        fontFamily: "'Space Grotesk', sans-serif",
        paddingBottom: 90,
      }}
    >
      {/* ── Header ── */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 18px 14px" }}
        >
          {/* Top row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <div>
              <Logo size={22} />
              <p
                style={{
                  fontSize: 11,
                  color: "rgba(255,255,255,0.4)",
                  marginTop: 2,
                }}
              >
                Olá, {profile?.full_name?.split(" ")[0]} 👋
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {itemCount > 0 && (
                <button
                  onClick={() => navigate("/cart")}
                  style={{
                    position: "relative",
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "rgba(233,30,140,0.15)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 17,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  🛒
                  <span
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 17,
                      height: 17,
                      borderRadius: "50%",
                      background: colors.rosa,
                      color: "#fff",
                      fontSize: 9,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {itemCount}
                  </span>
                </button>
              )}
              <button
                onClick={() => navigate("/profile")}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  background: "rgba(233,30,140,0.12)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 17,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                👤
              </button>
            </div>
          </div>

          {/* Barra de busca */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "rgba(255,255,255,0.09)",
              borderRadius: 12,
              padding: "10px 14px",
            }}
          >
            <span style={{ fontSize: 15, flexShrink: 0 }}>🔍</span>
            <input
              value={search}
              onChange={handleSearch}
              placeholder="Buscar comércio ou produto..."
              style={{
                flex: 1,
                background: "none",
                border: "none",
                outline: "none",
                color: "#fff",
                fontSize: 13,
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            />
            {search && (
              <button
                onClick={clearSearch}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  cursor: "pointer",
                  fontSize: 15,
                  padding: 0,
                }}
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Categorias ── */}
      <div
        style={{
          background: colors.noite,
          borderBottom: `1px solid rgba(255,255,255,0.06)`,
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              padding: "10px 18px 14px",
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
          >
            <CategoryPill
              icon="🏪"
              label="Todos"
              selected={!selectedGroup}
              onClick={() => setSelectedGroup(undefined)}
            />
            {groups.map((g) => (
              <CategoryPill
                key={g.id}
                icon={g.icon ?? "🏪"}
                label={g.name}
                selected={selectedGroup === g.id}
                onClick={() =>
                  setSelectedGroup((prev) => (prev === g.id ? undefined : g.id))
                }
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Conteúdo ── */}
      <div style={{ maxWidth: 520, margin: "0 auto", width: "100%" }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: "center" }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : stores.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px" }}>
            <p style={{ fontSize: 40, marginBottom: 12 }}>🏪</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
              Nenhum comércio encontrado
            </p>
            <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>
              Tente outro filtro ou busca
            </p>
          </div>
        ) : (
          <div
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {openStores.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                  }}
                >
                  Abertos agora ({openStores.length})
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {openStores.map((s) => (
                    <StoreCard
                      key={s.id}
                      store={s}
                      onPress={() => navigate(`/loja/${s.id}`)}
                    />
                  ))}
                </div>
              </div>
            )}

            {closedStores.length > 0 && (
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                  }}
                >
                  Fechados
                </p>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {closedStores.map((s) => (
                    <StoreCard
                      key={s.id}
                      store={s}
                      onPress={() => navigate(`/loja/${s.id}`)}
                      closed
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Barra do carrinho flutuante ── */}
      {itemCount > 0 && (
        <div
          onClick={() => navigate("/cart")}
          style={{
            position: "fixed",
            bottom: 80,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 452,
            background: colors.noite,
            borderRadius: 14,
            padding: "13px 18px",
            cursor: "pointer",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: `1px solid ${colors.roxoMedio}`,
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                background: colors.rosa,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "3px 10px",
                borderRadius: 20,
              }}
            >
              {itemCount}
            </span>
            <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
              itens no carrinho
            </span>
          </div>
          <span
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 16,
              color: colors.rosa,
            }}
          >
            Ver carrinho →
          </span>
        </div>
      )}

      <CustomerBottomNav active="home" />
    </div>
  );
}

// ── Pill de categoria ─────────────────────────────────────
function CategoryPill({
  icon,
  label,
  selected,
  onClick,
}: {
  icon: string;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        flexShrink: 0,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 14,
          background: selected ? colors.rosa : "rgba(255,255,255,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          transition: "all 0.15s",
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: selected ? colors.rosa : "rgba(255,255,255,0.55)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Card de comércio ──────────────────────────────────────
function StoreCard({
  store,
  onPress,
  closed,
}: {
  store: StorePublic;
  onPress: () => void;
  closed?: boolean;
}) {
  return (
    <div
      onClick={closed ? undefined : onPress}
      style={{
        background: "#fff",
        borderRadius: 16,
        border: `1px solid ${colors.bordaLilas}`,
        overflow: "hidden",
        cursor: closed ? "default" : "pointer",
        opacity: closed ? 0.55 : 1,
        boxShadow: closed ? "none" : "0 2px 12px rgba(28,10,46,0.07)",
      }}
    >
      {/* Banner */}
      <div
        style={{
          height: 80,
          background: colors.noite,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {store.logo_url ? (
          <img
            src={store.logo_url}
            alt={store.name}
            style={{ height: 52, objectFit: "contain" }}
          />
        ) : (
          <span
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 20,
              color: "#fff",
              letterSpacing: 1,
            }}
          >
            {store.name.toUpperCase()}
          </span>
        )}
        {store.open_now && (
          <span
            style={{
              position: "absolute",
              top: 10,
              right: 12,
              background: "#22c55e",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "3px 9px",
              borderRadius: 8,
            }}
          >
            Aberto
          </span>
        )}
        {closed && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#fff",
                background: "rgba(0,0,0,0.5)",
                padding: "4px 10px",
                borderRadius: 8,
              }}
            >
              Fechado
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div
        style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: colors.noite,
              marginBottom: 3,
            }}
          >
            {store.name}
          </p>
          <p style={{ fontSize: 11, color: "#888" }}>
            {store.open_now
              ? `⭐ 4.8 · ${store.estimated_time ?? 30} min · ${store.delivery_fee > 0 ? `R$\u00a0${store.delivery_fee.toFixed(0)} entrega` : "Entrega grátis"}`
              : "Fechado no momento"}
          </p>
        </div>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#7e22ce",
            background: colors.lilasClaro,
            padding: "4px 10px",
            borderRadius: 10,
            flexShrink: 0,
          }}
        >
          {store.store_groups?.icon} {store.store_groups?.name}
        </span>
      </div>
    </div>
  );
}
