import { useEffect, useState, useCallback } from "react";
import { supabase } from "../lib/supabase";

export interface Product {
  id: string;
  store_id: string;
  category: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  description?: string;
  price: number;
  category: string;
  active: boolean;
  image_url?: string | null;
}

export function useProducts(storeId: string | null) {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);

    const { data, error: err } = await supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .order("category")
      .order("sort_order")
      .order("name");

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    const list = (data ?? []) as Product[];
    setProducts(list);

    // Extrai categorias únicas
    const cats = [...new Set(list.map((p) => p.category))].sort();
    setCategories(cats);

    setLoading(false);
  }, [storeId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ── Upload de imagem para o Storage ──────────────────────
  async function uploadImage(file: File, productId: string): Promise<string> {
    const ext = file.name.split(".").pop();
    const path = `${storeId}/${productId}.${ext}`;

    const { error } = await supabase.storage
      .from("products")
      .upload(path, file, { upsert: true });

    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from("products").getPublicUrl(path);

    return data.publicUrl;
  }

  // ── Criar produto ─────────────────────────────────────────
  async function createProduct(
    payload: ProductPayload,
    imageFile?: File,
  ): Promise<Product> {
    if (!storeId) throw new Error("Store não identificada");
    setSaving(true);
    try {
      // 1. Insere o produto primeiro para obter o ID
      const { data, error } = await supabase
        .from("products")
        .insert({ ...payload, store_id: storeId })
        .select()
        .single();

      if (error) throw new Error(error.message);
      const product = data as Product;

      // 2. Faz upload da imagem se houver
      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, product.id);
        await supabase
          .from("products")
          .update({ image_url: imageUrl })
          .eq("id", product.id);
        product.image_url = imageUrl;
      }

      setProducts((prev) => [product, ...prev]);
      const cats = [...new Set([...categories, product.category])].sort();
      setCategories(cats);

      return product;
    } finally {
      setSaving(false);
    }
  }

  // ── Atualizar produto ─────────────────────────────────────
  async function updateProduct(
    id: string,
    payload: Partial<ProductPayload>,
    imageFile?: File,
  ): Promise<void> {
    setSaving(true);
    try {
      let finalPayload = { ...payload };

      if (imageFile) {
        const imageUrl = await uploadImage(imageFile, id);
        finalPayload.image_url = imageUrl;
      }

      const { error } = await supabase
        .from("products")
        .update(finalPayload)
        .eq("id", id);

      if (error) throw new Error(error.message);

      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...finalPayload } : p)),
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Toggle ativo/inativo ──────────────────────────────────
  async function toggleActive(id: string, active: boolean): Promise<void> {
    await supabase.from("products").update({ active }).eq("id", id);
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active } : p)),
    );
  }

  // ── Deletar produto ───────────────────────────────────────
  async function deleteProduct(id: string): Promise<void> {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) throw new Error(error.message);

    // Remove imagem do storage
    const product = products.find((p) => p.id === id);
    if (product?.image_url) {
      const path = product.image_url.split("/product-images/")[1];
      if (path) await supabase.storage.from("products").remove([path]);
    }

    setProducts((prev) => prev.filter((p) => p.id !== id));
  }

  return {
    products,
    categories,
    loading,
    saving,
    error,
    createProduct,
    updateProduct,
    toggleActive,
    deleteProduct,
    refetch: fetchProducts,
  };
}
