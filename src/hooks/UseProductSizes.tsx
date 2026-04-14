import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface ProductSize {
  id: string;
  store_id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ProductSizePrice {
  id: string;
  product_id: string;
  size_id: string;
  price: number;
  active: boolean;
  product_sizes?: ProductSize;
}

// ── Hook para o comércio gerenciar tamanhos da loja ──────────
export function useProductSizes(storeId: string | null) {
  const [sizes, setSizes] = useState<ProductSize[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSizes = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    const { data } = await supabase
      .from("product_sizes")
      .select("*")
      .eq("store_id", storeId)
      .eq("active", true)
      .order("sort_order");
    setSizes((data ?? []) as ProductSize[]);
    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchSizes();
  }, [fetchSizes]);

  async function createSize(name: string) {
    if (!storeId) return;
    const { error } = await supabase.from("product_sizes").insert({
      store_id: storeId,
      name: name.trim(),
      sort_order: sizes.length,
    });
    if (error) throw new Error(error.message);
    await fetchSizes();
  }

  async function deleteSize(id: string) {
    const { error } = await supabase
      .from("product_sizes")
      .update({ active: false })
      .eq("id", id);
    if (error) throw new Error(error.message);
    await fetchSizes();
  }

  return { sizes, loading, createSize, deleteSize, refetch: fetchSizes };
}

// ── Hook para preços por tamanho de um produto ───────────────
export function useProductSizePrices(productId: string | null) {
  const [prices, setPrices] = useState<ProductSizePrice[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPrices = useCallback(async () => {
    if (!productId) return;
    setLoading(true);
    const { data } = await supabase
      .from("product_size_prices")
      .select("*, product_sizes(id, name, sort_order)")
      .eq("product_id", productId)
      .eq("active", true)
      .order("product_sizes(sort_order)");
    setPrices((data ?? []) as ProductSizePrice[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  async function upsertPrice(productId: string, sizeId: string, price: number) {
    const { error } = await supabase.from("product_size_prices").upsert(
      {
        product_id: productId,
        size_id: sizeId,
        price: price,
        active: true,
      },
      { onConflict: "product_id,size_id" },
    );
    if (error) throw new Error(error.message);
    await fetchPrices();
  }

  return { prices, loading, upsertPrice, refetch: fetchPrices };
}

// ── Busca preços de vários produtos (para tela do cliente) ───
export async function fetchSizePricesForProduct(
  productId: string,
): Promise<ProductSizePrice[]> {
  const { data } = await supabase
    .from("product_size_prices")
    .select("*, product_sizes(id, name, sort_order)")
    .eq("product_id", productId)
    .eq("active", true)
    .order("product_sizes(sort_order)");
  return (data ?? []) as ProductSizePrice[];
}
