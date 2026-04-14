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
        paddingBottom: 80,
      }}
    >
      {/* Header */}
      <div style={{ background: colors.noite }}>
        <div
          style={{ maxWidth: 520, margin: "0 auto", padding: "16px 20px 14px" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <Logo size={24} />
            <div style={{ display: "flex", gap: 8 }}>
              {itemCount > 0 && (
                <button
                  onClick={() => navigate("/cart")}
                  style={{
                    position: "relative",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "rgba(233,30,140,0.15)",
                    border: "none",
                    cursor: "pointer",
                    fontSize: 16,
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
                      width: 16,
                      height: 16,
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
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(233,30,140,0.12)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 16,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                👤
              </button>
            </div>
          </div>
          <p
            style={{
              fontSize: 10,
              color: "rgba(255,255,255,0.35)",
              marginBottom: 10,
            }}
          >
            Olá, {profile?.full_name?.split(" ")[0]} 👋
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(255,255,255,0.08)",
                borderRadius: 10,
                padding: "9px 12px",
              }}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>🔍</span>
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
                    color: "rgba(255,255,255,0.3)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Categorias */}
      <div
        style={{
          maxWidth: 520,
          margin: "0 auto",
          display: "flex",
          gap: 8,
          padding: "12px 16px",
          overflowX: "auto",
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

      {/* Conteúdo */}
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Spinner color={colors.rosa} />
          </div>
        ) : stores.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🏪</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: colors.noite }}>
              Nenhum comércio encontrado
            </p>
            <p style={{ fontSize: 13, color: "#aaa", marginTop: 6 }}>
              Tente outro filtro ou busca
            </p>
          </div>
        ) : (
          <div style={{ padding: "0 16px" }}>
            {openStores.length > 0 && (
              <>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#aaa",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    marginBottom: 10,
                    marginTop: 4,
                  }}
                >
                  Abertos agora ({openStores.length})
                </p>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 20,
                  }}
                >
                  {openStores.map((s) => (
                    <StoreCard
                      key={s.id}
                      store={s}
                      onPress={() => navigate(`/loja/${s.id}`)}
                    />
                  ))}
                </div>
              </>
            )}
            {closedStores.length > 0 && (
              <>
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
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
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
              </>
            )}
          </div>
        )}
      </div>

      {/* Barra do carrinho flutuante */}
      {itemCount > 0 && (
        <div
          onClick={() => navigate("/cart")}
          style={{
            position: "fixed",
            bottom: 76,
            left: "50%",
            transform: "translateX(-50%)",
            width: "calc(100% - 32px)",
            maxWidth: 448,
            background: colors.noite,
            borderRadius: 13,
            padding: "12px 16px",
            cursor: "pointer",
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            border: `1px solid ${colors.roxoMedio}`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                background: colors.rosa,
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 20,
              }}
            >
              {itemCount}
            </span>
            <span style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
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
          width: 44,
          height: 44,
          borderRadius: 12,
          background: selected ? colors.rosa : colors.lilasClaro,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          transition: "all 0.15s",
        }}
      >
        {icon}
      </div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: selected ? colors.rosa : "#aaa",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </div>
  );
}

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
        borderRadius: 14,
        border: `1px solid ${colors.bordaLilas}`,
        overflow: "hidden",
        cursor: closed ? "default" : "pointer",
        opacity: closed ? 0.6 : 1,
      }}
    >
      <div
        style={{
          height: 72,
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
            style={{ height: 48, objectFit: "contain" }}
          />
        ) : (
          <span
            style={{
              fontFamily: "'Righteous', cursive",
              fontSize: 18,
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
              top: 8,
              right: 10,
              background: "#22c55e",
              color: "#fff",
              fontSize: 9,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 8,
            }}
          >
            Aberto
          </span>
        )}
      </div>
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.noite }}>
            {store.name}
          </p>
          <p style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
            {store.open_now
              ? `⭐ 4.8 · ${store.estimated_time ?? 30} min · ${store.delivery_fee > 0 ? `R$\u00a0${store.delivery_fee.toFixed(0)}` : "Grátis"}`
              : "Fechado no momento"}
          </p>
        </div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: "#7e22ce",
            background: colors.lilasClaro,
            padding: "3px 9px",
            borderRadius: 10,
          }}
        >
          {store.store_groups?.icon} {store.store_groups?.name}
        </span>
      </div>
    </div>
  );
}
