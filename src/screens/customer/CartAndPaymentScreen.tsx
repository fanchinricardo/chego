import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { useCustomerAddresses } from '../../hooks/useCustomer'
import { colors, Button, Spinner, Toast } from '../../components/ui'

// ── Gerador de payload Pix BR Code (padrão BACEN EMV) ────────
function crc16(str: string): string {
  let crc = 0xffff
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = (crc << 1) ^ 0x1021
      } else {
        crc = crc << 1
      }
    }
    crc &= 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

function emv(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0')
  return `${id}${len}${value}`
}

// Remove acentos e caracteres não permitidos pelo padrão BACEN
function sanitize(str: string, maxLen: number): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove acentos
    .replace(/[^a-zA-Z0-9 ]/g, ' ')  // remove especiais
    .replace(/\s+/g, ' ')             // colapsa espaços
    .trim()
    .toUpperCase()
    .slice(0, maxLen)
}

function buildPixPayload(opts: {
  pixKey:       string
  merchantName: string
  merchantCity: string
  amount:       number
  txId?:        string
  description?: string
}): string {
  const name = sanitize(opts.merchantName, 25)
  const city = sanitize(opts.merchantCity, 15)
  const txId = (opts.txId ?? 'CHEGOPEDIDO')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 25) || 'CHEGOPEDIDO'

  // Merchant Account Information (ID 26)
  const guiVal  = emv('00', 'BR.GOV.BCB.PIX')
  const keyVal  = emv('01', opts.pixKey.trim())
  const descVal = opts.description
    ? emv('02', sanitize(opts.description, 72))
    : ''
  const mai = emv('26', guiVal + keyVal + descVal)

  // Monta o payload sem CRC
  const payload =
    emv('00', '01') +           // Payload Format Indicator
    emv('01', '12') +           // Point of Initiation: 11=estático, 12=dinâmico
    mai +                        // Merchant Account Info (chave Pix)
    emv('52', '0000') +         // Merchant Category Code
    emv('53', '986') +          // Transaction Currency (BRL=986)
    emv('54', opts.amount.toFixed(2)) + // Transaction Amount
    emv('58', 'BR') +           // Country Code
    emv('59', name) +           // Merchant Name
    emv('60', city) +           // Merchant City
    emv('62', emv('05', txId)) + // Additional Data (TxID)
    '6304'                       // CRC placeholder (preenchido abaixo)

  return payload + crc16(payload)
}

// ── CARRINHO ──────────────────────────────────────────────
export function CartScreen() {
  const navigate  = useNavigate()
  const { user }  = useAuth()
  const { items, total, updateQty, removeItem, storeId, storeName, clearCart } = useCart()
  const { addresses, loading: addrLoading } = useCustomerAddresses(user?.id ?? null)

  const [selectedAddr, setSelectedAddr] = useState<string | null>(null)
  const [notes, setNotes]               = useState('')
  const [submitting, setSubmitting]     = useState(false)
  const [toast, setToast]               = useState('')
  const [toastType, setToastType]       = useState<'success'|'error'>('success')

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast(msg); setToastType(type)
    setTimeout(() => setToast(''), 3000)
  }

  // Seleciona endereço padrão automaticamente
  useEffect(() => {
    const def = addresses.find(a => a.is_default)
    if (def && !selectedAddr) setSelectedAddr(def.id)
  }, [addresses])

  // Verifica se já existe pedido pago para essa loja e limpa o carrinho
  useEffect(() => {
    if (!user || !storeId || items.length === 0) return
    supabase
      .from('orders')
      .select('id, payment_status')
      .eq('customer_id', user.id)
      .eq('store_id', storeId)
      .eq('payment_status', 'paid')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          // Pedido já foi pago — limpa o carrinho sem cancelar no banco
          clearCart(false)
          showToast('Seu pedido já foi pago! ✅')
        }
      })
  }, [user, storeId])

  const address = addresses.find(a => a.id === selectedAddr)

  async function handleCheckout() {
    if (!user || !storeId) return
    if (!selectedAddr || !address) { showToast('Escolha um endereço de entrega', 'error'); return }
    if (items.length === 0)         { showToast('Carrinho vazio', 'error'); return }

    setSubmitting(true)
    try {
      // Busca taxa de entrega da loja
      const { data: store } = await supabase
        .from('stores')
        .select('delivery_fee, min_order_value')
        .eq('id', storeId)
        .single()

      const delivFee   = Number(store?.delivery_fee ?? 0)
      const minOrder   = Number(store?.min_order_value ?? 0)
      const subtotal   = total
      const orderTotal = subtotal + delivFee

      if (subtotal < minOrder && minOrder > 0) {
        showToast(`Pedido mínimo é R$ ${minOrder.toFixed(2)}`, 'error')
        setSubmitting(false)
        return
      }

      // ✅ Verifica se já existe pedido pendente de pagamento para essa loja
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, total')
        .eq('customer_id', user.id)
        .eq('store_id', storeId)
        .eq('payment_status', 'pending')
        .in('status', ['pending'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingOrder) {
        // Reutiliza o pedido existente em vez de criar outro
        navigate('/payment', {
          state: { orderId: existingOrder.id, total: Number(existingOrder.total) },
        })
        setSubmitting(false)
        return
      }

      // Cria pedido novo
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          store_id:         storeId,
          customer_id:      user.id,
          address_id:       selectedAddr,
          status:           'pending',
          payment_status:   'pending',
          subtotal,
          delivery_fee:     delivFee,
          total:            orderTotal,
          delivery_address: `${address.address}${address.complement ? ', ' + address.complement : ''} · ${address.city}`,
          delivery_lat:     address.lat ?? null,
          delivery_lng:     address.lng ?? null,
          notes:            notes.trim() || null,
        })
        .select()
        .single()

      if (orderErr) throw new Error(orderErr.message)

      // Insere itens
      const orderItems = items.map(item => ({
        order_id:    order.id,
        product_id:  item.product_id,
        quantity:    item.quantity,
        unit_price:  item.price,
        total_price: item.price * item.quantity,
        notes:       item.notes ?? null,
      }))

      const { error: itemsErr } = await supabase
        .from('order_items')
        .insert(orderItems)

      if (itemsErr) throw new Error(itemsErr.message)

      navigate('/payment', {
        state: { orderId: order.id, total: orderTotal },
      })

    } catch (err: any) {
      showToast(err.message, 'error')
      setSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div style={{ minHeight: '100dvh', background: colors.fundo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'Space Grotesk', sans-serif", padding: 24 }}>
        <p style={{ fontSize: 40 }}>🛒</p>
        <p style={{ fontSize: 16, fontWeight: 700, color: colors.noite }}>Carrinho vazio</p>
        <p style={{ fontSize: 13, color: '#aaa', textAlign: 'center' }}>Adicione produtos de um comércio para continuar</p>
        <button onClick={() => navigate('/home')} style={{ padding: '11px 24px', borderRadius: 12, background: colors.rosa, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
          Explorar comércios
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: colors.fundo, fontFamily: "'Space Grotesk', sans-serif", paddingBottom: 100 }}>
      <div style={{ background: colors.noite, padding: '16px 20px 18px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', marginBottom: 10, padding: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
          ← Continuar comprando
        </button>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Meu Carrinho</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{storeName} · {items.reduce((s, i) => s + i.quantity, 0)} itens</p>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Itens */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(item => (
            <div key={item.product_id} style={{ background: '#fff', borderRadius: 13, border: `1px solid ${colors.bordaLilas}`, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: colors.lilasClaro, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
                {item.image_url ? <img src={item.image_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: colors.noite, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</p>
                {item.notes && <p style={{ fontSize: 10, color: '#aaa', marginTop: 1 }}>obs: {item.notes}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => updateQty(item.product_id, item.quantity - 1)} style={{ width: 22, height: 22, borderRadius: 6, background: colors.lilasClaro, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: colors.noite }}>−</button>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.noite, minWidth: 16, textAlign: 'center' }}>{item.quantity}</span>
                  <button onClick={() => updateQty(item.product_id, item.quantity + 1)} style={{ width: 22, height: 22, borderRadius: 6, background: colors.rosa, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, color: '#fff' }}>+</button>
                </div>
                <p style={{ fontSize: 12, fontWeight: 700, color: colors.rosa }}>R${(item.price * item.quantity).toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Observações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: colors.noite, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Observações do pedido</p>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Alguma observação geral para o comércio?"
            rows={2}
            style={{ background: '#fff', border: `1.5px solid ${colors.bordaLilas}`, borderRadius: 11, padding: '9px 12px', fontSize: 13, color: colors.noite, fontFamily: "'Space Grotesk', sans-serif", resize: 'none', outline: 'none' }}
          />
        </div>

        {/* Endereço */}
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: colors.noite, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Endereço de entrega</p>
          {addrLoading ? <Spinner color={colors.rosa} size={20} /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {addresses.map(addr => (
                <div key={addr.id} onClick={() => setSelectedAddr(addr.id)} style={{ background: '#fff', borderRadius: 12, border: `1.5px solid ${selectedAddr === addr.id ? colors.rosa : colors.bordaLilas}`, padding: '10px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: selectedAddr === addr.id ? colors.rosa : colors.lilasClaro, border: `1.5px solid ${selectedAddr === addr.id ? colors.rosa : colors.bordaLilas}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selectedAddr === addr.id && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />}
                  </div>
                  <div>
                    <p style={{ fontSize: 12, fontWeight: 700, color: colors.noite }}>{addr.label}</p>
                    <p style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{addr.address} · {addr.city}</p>
                  </div>
                </div>
              ))}
              <button
                onClick={() => navigate('/profile')}
                style={{ background: 'none', border: `1px dashed ${colors.bordaLilas}`, borderRadius: 12, padding: '10px', color: colors.rosa, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
              >
                + Novo endereço (via Perfil)
              </button>
            </div>
          )}
        </div>

        {/* Resumo */}
        <div style={{ background: '#fff', borderRadius: 13, border: `1px solid ${colors.bordaLilas}`, padding: '12px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Subtotal</span>
            <span style={{ fontSize: 12, color: colors.noite }}>R$ {total.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#888' }}>Entrega</span>
            <span style={{ fontSize: 12, color: '#22c55e' }}>R$ 0,00</span>
          </div>
          <div style={{ height: 1, background: colors.bordaLilas, marginBottom: 8 }} />
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.noite }}>Total</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: colors.rosa }}>R$ {total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 32px)', maxWidth: 448 }}>
        <Button variant="primary" fullWidth loading={submitting} onClick={handleCheckout} style={{ fontSize: 15 }}>
          Ir para pagamento →
        </Button>
      </div>

      {toast && <Toast message={toast} type={toastType} />}
    </div>
  )
}

// ── PAGAMENTO QR CODE ────────────────────────────────────
export function PaymentScreen() {
  const navigate  = useNavigate()
  const location  = useLocation()

  // ✅ Lê o state corretamente via useLocation
  const locationState = location.state as { orderId: string; total: number } | null
  const { clearCart } = useCart()

  const [status, setStatus]         = useState<'waiting' | 'paid' | 'error'>('waiting')
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null)
  const [pixPayload, setPixPayload] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)

  const orderId    = locationState?.orderId ?? null
  const orderTotal = locationState?.total   ?? 0

  // Gera QR Code Pix localmente assim que a tela carrega
  useEffect(() => {
    if (!orderId || orderTotal <= 0) return
    generateLocalQr(orderId, orderTotal)
  }, [orderId, orderTotal])

  async function generateLocalQr(oid: string, _amount: number) {
    setGenerating(true)
    try {
      // Chama a Edge Function que usa o token do MP no backend
      const { data, error } = await supabase.functions.invoke('create-mp-payment', {
        body: { order_id: oid },
      })

      console.log('MP response:', JSON.stringify(data))
      console.log('MP error:', error)

      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)

      if (data?.qr_code_base64) {
        setQrDataUrl(`data:image/png;base64,${data.qr_code_base64}`)
      } else if (data?.qr_code) {
        const encoded = encodeURIComponent(data.qr_code)
        setQrDataUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encoded}&margin=10`)
      }

      if (data?.qr_code) setPixPayload(data.qr_code)

    } catch (err: any) {
      console.error('Erro ao gerar QR MP:', err.message)
    } finally {
      setGenerating(false)
    }
  }


  useEffect(() => {
    if (!orderId || status !== 'waiting') return
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('orders')
        .select('payment_status')
        .eq('id', orderId)
        .single()

      if (data?.payment_status === 'paid') {
        setStatus('paid')
        clearCart()
        clearInterval(interval)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [orderId, status])

  // Realtime: escuta webhook do MP
  useEffect(() => {
    if (!orderId) return
    const channel = supabase
      .channel(`payment-${orderId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'orders',
        filter: `id=eq.${orderId}`,
      }, payload => {
        if ((payload.new as any).payment_status === 'paid') {
          setStatus('paid')
          clearCart()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orderId])

  // ── Tela de sucesso ──
  if (status === 'paid') {
    return (
      <div style={{ minHeight: '100dvh', background: colors.fundo, fontFamily: "'Space Grotesk', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff' }}>✓</div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: "'Righteous', cursive", fontSize: 24, color: colors.noite, marginBottom: 6 }}>Pedido feito!</p>
          <p style={{ fontSize: 13, color: '#888', lineHeight: 1.7 }}>
            Pagamento confirmado. O comércio foi notificado e seu pedido está sendo preparado.
          </p>
        </div>
        <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${colors.bordaLilas}`, padding: '14px 18px', width: '100%', maxWidth: 320 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', marginBottom: 8 }}>Resumo</p>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, color: '#888' }}>#{orderId?.slice(0, 8).toUpperCase()}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: colors.rosa }}>R$ {orderTotal.toFixed(2)}</span>
          </div>
        </div>
        <button onClick={() => navigate('/orders')} style={{ width: '100%', maxWidth: 320, padding: '13px', borderRadius: 13, background: colors.noite, color: '#fff', border: 'none', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
          📍 Acompanhar entrega
        </button>
        <button onClick={() => navigate('/home')} style={{ background: 'none', border: 'none', color: colors.rosa, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
          Voltar para o início
        </button>
      </div>
    )
  }

  // ── Sem state (acesso direto à URL) ──
  if (!orderId) {
    return (
      <div style={{ minHeight: '100dvh', background: colors.fundo, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: "'Space Grotesk', sans-serif", padding: 24 }}>
        <p style={{ fontSize: 14, color: '#aaa', textAlign: 'center' }}>Nenhum pedido em andamento.</p>
        <button onClick={() => navigate('/home')} style={{ padding: '11px 24px', borderRadius: 12, background: colors.rosa, color: '#fff', border: 'none', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}>
          Ir para o início
        </button>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100dvh', background: colors.fundo, fontFamily: "'Space Grotesk', sans-serif" }}>
      <div style={{ background: colors.noite, padding: '16px 20px 18px' }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', fontSize: 13, cursor: 'pointer', marginBottom: 10, padding: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
          ← Voltar
        </button>
        <p style={{ fontSize: 17, fontWeight: 700, color: '#fff' }}>Pagamento</p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Escaneie o QR Code para pagar via Pix</p>
      </div>

      <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

        {/* QR Code */}
        <div style={{ background: '#fff', borderRadius: 16, border: `1px solid ${colors.bordaLilas}`, padding: '24px 20px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Total a pagar</p>

          {/* ✅ Valor correto vindo do locationState */}
          <p style={{ fontFamily: "'Righteous', cursive", fontSize: 32, color: colors.rosa }}>
            R$ {orderTotal.toFixed(2)}
          </p>

          <div style={{ width: 200, height: 200, background: '#fff', border: `3px solid ${colors.noite}`, borderRadius: 12, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {generating ? (
              <Spinner color={colors.noite} size={32} />
            ) : qrDataUrl ? (
              <img src={qrDataUrl} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="QR Code Pix" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 16 }}>
                <Spinner color={colors.noite} size={24} />
                <p style={{ fontSize: 10, color: '#aaa', textAlign: 'center' }}>Gerando QR Code...</p>
              </div>
            )}
          </div>

          <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center', lineHeight: 1.6 }}>
            Abra o app do banco ou carteira digital e escaneie
          </p>

          {pixPayload && (
            <button
              onClick={() => navigator.clipboard.writeText(pixPayload).then(() => alert('Código Pix copiado!'))}
              style={{ width: '100%', padding: '10px', borderRadius: 10, background: colors.lilasClaro, border: 'none', color: '#7e22ce', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif" }}
            >
              📋 Copiar código Pix
            </button>
          )}
        </div>

        {/* Aguardando */}
        <div style={{ background: '#fff8e6', border: '1px solid #fcd34d', borderRadius: 12, padding: '12px 16px', width: '100%', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, animation: 'chegô-blink 1s ease-in-out infinite' }} />
          <p style={{ fontSize: 12, color: '#92400e', fontWeight: 600 }}>Aguardando confirmação do pagamento...</p>
        </div>
        <style>{`@keyframes chegô-blink{0%,100%{opacity:1}50%{opacity:0.3}}`}</style>

        <p style={{ fontSize: 11, color: '#aaa', textAlign: 'center' }}>
          O pedido será confirmado automaticamente após o pagamento
        </p>
      </div>
    </div>
  )
}