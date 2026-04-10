import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  image_url?: string | null;
}

interface CartContextType {
  items: CartItem[];
  storeId: string | null;
  storeName: string | null;
  total: number;
  itemCount: number;
  addItem: (
    item: Omit<CartItem, "quantity">,
    storeId: string,
    storeName: string,
  ) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  updateNotes: (productId: string, notes: string) => void;
  clearCart: () => void;
  canAddFrom: (storeId: string) => boolean;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = "chegô_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);

  // Carrega carrinho salvo
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { items, storeId, storeName } = JSON.parse(saved);
        setItems(items ?? []);
        setStoreId(storeId ?? null);
        setStoreName(storeName ?? null);
      }
    } catch {}
  }, []);

  // Salva no localStorage sempre que mudar
  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ items, storeId, storeName }),
    );
  }, [items, storeId, storeName]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  function canAddFrom(sid: string): boolean {
    return !storeId || storeId === sid;
  }

  function addItem(
    item: Omit<CartItem, "quantity">,
    sid: string,
    sName: string,
  ) {
    // Loja diferente — limpa carrinho
    if (storeId && storeId !== sid) {
      setItems([{ ...item, quantity: 1 }]);
      setStoreId(sid);
      setStoreName(sName);
      return;
    }

    setStoreId(sid);
    setStoreName(sName);

    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      if (existing) {
        return prev.map((i) =>
          i.product_id === item.product_id
            ? { ...i, quantity: i.quantity + 1 }
            : i,
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  function removeItem(productId: string) {
    setItems((prev) => {
      const next = prev.filter((i) => i.product_id !== productId);
      if (next.length === 0) {
        setStoreId(null);
        setStoreName(null);
      }
      return next;
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      prev.map((i) =>
        i.product_id === productId ? { ...i, quantity: qty } : i,
      ),
    );
  }

  function updateNotes(productId: string, notes: string) {
    setItems((prev) =>
      prev.map((i) => (i.product_id === productId ? { ...i, notes } : i)),
    );
  }

  function clearCart() {
    setItems([]);
    setStoreId(null);
    setStoreName(null);
  }

  return (
    <CartContext.Provider
      value={{
        items,
        storeId,
        storeName,
        total,
        itemCount,
        addItem,
        removeItem,
        updateQty,
        updateNotes,
        clearCart,
        canAddFrom,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
