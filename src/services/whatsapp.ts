import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callNotify(payload: Record<string, string>) {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await fetch(`${SUPABASE_URL}/functions/v1/notify-whatsapp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn("Notificação WhatsApp falhou (não crítico):", err);
  }
}

export const notify = {
  // Comércio recebe quando cliente faz pedido
  orderCreated: (order_id: string) =>
    callNotify({ event: "order_created", order_id }),
  // Cliente recebe quando comércio inicia preparo
  orderPreparing: (order_id: string) =>
    callNotify({ event: "order_preparing", order_id }),
  // Motoboy recebe quando comércio cria a rota
  routeStarted: (route_id: string) =>
    callNotify({ event: "route_started", route_id }),
  // Clientes recebem quando motoboy aceita a rota
  routeAccepted: (route_id: string) =>
    callNotify({ event: "route_accepted", route_id }),
};
