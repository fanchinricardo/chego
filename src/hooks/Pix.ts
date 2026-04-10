// Gerador de Pix BR Code (padrão BACEN EMV)
// Gera o payload de texto do Pix e o QR Code como dataURL via biblioteca qrcode

import QRCode from "qrcode";

// ── Helpers CRC16-CCITT ────────────────────────────────────
function crc16(str: string): string {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return (crc & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

// ── Gera payload Pix (texto) ───────────────────────────────
export interface PixOptions {
  pixKey: string; // chave Pix (CPF, CNPJ, email, telefone ou aleatória)
  merchantName: string; // nome do recebedor (máx 25 chars)
  merchantCity: string; // cidade do recebedor (máx 15 chars)
  amount: number; // valor em reais
  txId?: string; // identificador único (máx 25 chars)
  description?: string; // descrição opcional
}

export function generatePixPayload(opts: PixOptions): string {
  const name = opts.merchantName.slice(0, 25).toUpperCase();
  const city = opts.merchantCity.slice(0, 15).toUpperCase();
  const txId = (opts.txId ?? "***").slice(0, 25).replace(/[^a-zA-Z0-9]/g, "");

  // Campo 26: Merchant Account Information
  const guiVal = emv("00", "BR.GOV.BCB.PIX");
  const keyVal = emv("01", opts.pixKey);
  const descVal = opts.description
    ? emv("02", opts.description.slice(0, 72))
    : "";
  const mai = emv("26", guiVal + keyVal + descVal);

  // Payload sem CRC
  const payload =
    emv("00", "01") + // Payload Format Indicator
    emv("01", "12") + // Point of Initiation Method (dinâmico)
    mai + // Merchant Account Information
    emv("52", "0000") + // Merchant Category Code
    emv("53", "986") + // Transaction Currency (BRL)
    emv("54", opts.amount.toFixed(2)) + // Transaction Amount
    emv("58", "BR") + // Country Code
    emv("59", name) + // Merchant Name
    emv("60", city) + // Merchant City
    emv("62", emv("05", txId)) + // Additional Data Field (TxID)
    "6304"; // CRC placeholder

  return payload + crc16(payload);
}

// ── Gera QR Code como dataURL PNG ─────────────────────────
export async function generatePixQrCode(
  opts: PixOptions,
  size = 256,
): Promise<{ dataUrl: string; payload: string }> {
  const payload = generatePixPayload(opts);
  const dataUrl = await QRCode.toDataURL(payload, {
    width: size,
    margin: 2,
    color: { dark: "#1c0a2e", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
  return { dataUrl, payload };
}
