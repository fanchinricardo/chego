// Componente de cupom fiscal para impressora térmica 80mm
// Usar via window.print() após renderizar

export interface ReceiptStore {
  name: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
  cnpj?: string | null;
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
  notes?: string | null;
}

export interface ReceiptData {
  store: ReceiptStore;
  items: ReceiptItem[];
  subtotal: number;
  tip?: number | null; // gorjeta
  total: number;
  payments: { method: string; amount: number; change?: number }[];
  table?: string | null; // mesa (PDV)
  order_code?: string | null; // código do pedido (delivery)
  customer?: string | null; // nome do cliente
  type: "pdv" | "delivery";
  printed_at: string;
}

const METHOD_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  credito: "Cartão Crédito",
  debito: "Cartão Débito",
  pix: "Pix",
  pix_manual: "Pix Manual",
  credito_ent: "Cartão Crédito",
  debito_ent: "Cartão Débito",
};

export function generateReceiptHTML(data: ReceiptData): string {
  const {
    store,
    items,
    subtotal,
    tip,
    total,
    payments,
    table,
    order_code,
    customer,
    type,
    printed_at,
  } = data;

  const date = new Date(printed_at);
  const dateStr = date.toLocaleDateString("pt-BR");
  const timeStr = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemsHTML = items
    .map(
      (item) => `
    <div class="item">
      <div class="item-name">${item.quantity}x ${item.name}</div>
      ${item.notes ? `<div class="item-notes">  obs: ${item.notes}</div>` : ""}
      <div class="item-price">
        <span>R$ ${item.unit_price.toFixed(2)} un</span>
        <span><b>R$ ${item.total.toFixed(2)}</b></span>
      </div>
    </div>
  `,
    )
    .join("");

  const paymentsHTML = payments
    .map(
      (p) => `
    <div class="row">
      <span>${METHOD_LABEL[p.method] ?? p.method}</span>
      <span>R$ ${p.amount.toFixed(2)}</span>
    </div>
    ${p.change && Math.round(p.change * 100) > 0 ? `<div class="row muted"><span>Troco</span><span>R$ ${p.change.toFixed(2)}</span></div>` : ""}
  `,
    )
    .join("");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Cupom</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      padding: 4mm;
      color: #000;
    }
    .center { text-align: center; }
    .bold   { font-weight: bold; }
    .big    { font-size: 15px; }
    .sep    { border-top: 1px dashed #000; margin: 4px 0; }
    .sep2   { border-top: 2px solid #000; margin: 4px 0; }
    .row    { display: flex; justify-content: space-between; margin: 2px 0; }
    .muted  { color: #555; font-size: 11px; }
    .item   { margin: 4px 0; }
    .item-name { font-weight: bold; }
    .item-notes { font-size: 11px; color: #555; }
    .item-price { display: flex; justify-content: space-between; font-size: 11px; }
    .total-row  { display: flex; justify-content: space-between; font-size: 15px; font-weight: bold; margin: 4px 0; }
    .footer { text-align: center; font-size: 11px; margin-top: 6px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>

  <div class="center">
    <div class="bold big">${store.name}</div>
    ${store.address ? `<div>${store.address}</div>` : ""}
    ${store.city ? `<div>${store.city}${store.state ? ` - ${store.state}` : ""}</div>` : ""}
    ${store.phone ? `<div>Tel: ${store.phone}</div>` : ""}
    ${store.cnpj ? `<div>CNPJ: ${store.cnpj}</div>` : ""}
  </div>

  <div class="sep2"></div>

  <div class="center bold">
    ${type === "pdv" ? `MESA: ${table ?? ""}` : `PEDIDO #${order_code ?? ""}`}
  </div>
  ${customer ? `<div class="center">Cliente: ${customer}</div>` : ""}
  <div class="center muted">${dateStr} ${timeStr}</div>

  <div class="sep"></div>
  <div class="bold">ITENS</div>
  <div class="sep"></div>

  ${itemsHTML}

  <div class="sep"></div>

  <div class="row"><span>Subtotal</span><span>R$ ${subtotal.toFixed(2)}</span></div>
  ${tip ? `<div class="row"><span>Gorjeta (10%)</span><span>R$ ${tip.toFixed(2)}</span></div>` : ""}

  <div class="sep2"></div>
  <div class="total-row"><span>TOTAL</span><span>R$ ${total.toFixed(2)}</span></div>
  <div class="sep2"></div>

  <div class="bold">PAGAMENTO</div>
  <div class="sep"></div>
  ${paymentsHTML}

  <div class="sep2"></div>

  <div class="footer">
    <div>Obrigado pela preferência!</div>
    <div style="margin-top:4px">*** NÃO É DOCUMENTO FISCAL ***</div>
    <div style="margin-top:4px; font-size:10px">Emitido por Chegô</div>
  </div>

</body>
</html>`;
}

export function printReceipt(data: ReceiptData) {
  const html = generateReceiptHTML(data);
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) {
    alert("Permita popups para imprimir");
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 500);
}
