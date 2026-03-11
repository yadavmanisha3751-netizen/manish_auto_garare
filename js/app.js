// js/app.js — Shared utilities for Manish Auto Garage

// ── Auth helpers ──────────────────────────────────────────
const Auth = {
    getToken:      ()  => localStorage.getItem('mag_token'),
    setToken:      (t) => localStorage.setItem('mag_token', t),
    getUser:       ()  => JSON.parse(localStorage.getItem('mag_user') || 'null'),
    setUser:       (u) => localStorage.setItem('mag_user', JSON.stringify(u)),
    isLoggedIn:    ()  => !!localStorage.getItem('mag_token'),
    logout() { localStorage.removeItem('mag_token'); localStorage.removeItem('mag_user'); },

    getAdminToken: ()  => localStorage.getItem('mag_admin_token'),
    setAdminToken: (t) => localStorage.setItem('mag_admin_token', t),
    getAdmin:      ()  => JSON.parse(localStorage.getItem('mag_admin') || 'null'),
    setAdmin:      (a) => localStorage.setItem('mag_admin', JSON.stringify(a)),
    isAdmin:       ()  => !!localStorage.getItem('mag_admin_token'),
    logoutAdmin()  { localStorage.removeItem('mag_admin_token'); localStorage.removeItem('mag_admin'); }
};

// ── API fetch wrapper ─────────────────────────────────────
async function api(endpoint, method = 'GET', body = null, isAdmin = false) {
    const token   = isAdmin ? Auth.getAdminToken() : Auth.getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    try {
        const res  = await fetch('/api' + endpoint, opts);
        const data = await res.json();
        return { ok: res.ok, data };
    } catch (err) {
        return { ok: false, data: { message: 'Network error. Check server.' } };
    }
}

// ── Toast notifications ───────────────────────────────────
function toast(msg, type = 'info') {
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.id = 'toastWrap';
        wrap.className = 'toast-wrap';
        document.body.appendChild(wrap);
    }
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity 0.4s'; setTimeout(() => t.remove(), 400); }, 3500);
}

// ── Format helpers ────────────────────────────────────────
function inr(n) {
    return '₹' + parseFloat(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fdate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}
function ftime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':');
    const hr = parseInt(h);
    return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? 'PM' : 'AM'}`;
}
function badgeHtml(status) {
    const map = { 'Pending': 'pending', 'In Progress': 'progress', 'Completed': 'completed', 'Cancelled': 'cancelled' };
    return `<span class="badge badge-${map[status] || 'pending'}">${status}</span>`;
}

// ── Number to words (Indian) ─────────────────────────────
function numWords(n) {
    n = Math.floor(n);
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    if (n === 0) return 'Zero';
    if (n < 20)  return ones[n];
    if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '');
    if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+numWords(n%100) : '');
    if (n < 100000) return numWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+numWords(n%1000) : '');
    if (n < 10000000) return numWords(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' '+numWords(n%100000) : '');
    return numWords(Math.floor(n/10000000)) + ' Crore' + (n%10000000 ? ' '+numWords(n%10000000) : '');
}

// ── Invoice builder (used in both user dashboard & admin) ─
function buildInvoice(b, userInfo) {
    const labour   = parseFloat(b.bill_labour || 0);
    const parts    = parseFloat(b.bill_parts  || 0);
    const gst      = parseFloat(b.bill_gst    || 0);
    const total    = parseFloat(b.bill_amount || 0);
    const svcTotal = (b.services || []).reduce((sum, s) => sum + parseFloat(s.price_at_booking || 0), 0);
    const subtotal = svcTotal + labour + parts;
    const svcRows  = (b.services || []).map(s =>
        `<tr><td>${s.service_name || s.name}</td><td style="text-align:right">${inr(s.price_at_booking)}</td></tr>`).join('');
    const isPaid = b.payment_status === 'Paid';

    return `<div id="invoicePrint" style="font-family:Arial,sans-serif;color:#1a1a2e;background:white;padding:15px">
    <div class="invoice-header">
      <div>
        <div style="font-size:1.3rem;font-weight:800">🏍️ Manish Auto Garage</div>
        <div style="font-size:0.72rem;color:#e8400a;font-weight:700;letter-spacing:1px">2 WHEELER SPECIALIST</div>
        <div style="font-size:0.8rem;color:#555;margin-top:3px">Near Road No. 22, Wagle Circle, Opposite Spraytech Company, Thane West 400604</div>
        <div style="font-size:0.8rem;color:#555">📞 +91 88281 33876</div>
        <div style="font-size:0.75rem;color:#777">GSTIN: 27AABCU9603R1ZX</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;font-size:1rem">TAX INVOICE</div>
        <div style="font-size:0.82rem">No: <strong>MAG-${String(b.id).padStart(5,'0')}</strong></div>
        <div style="font-size:0.82rem">Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong></div>
        <div style="margin-top:5px">
          <span style="background:${isPaid?'#d4edda':'#fff3cd'};color:${isPaid?'#155724':'#856404'};padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:700">
            ${isPaid ? '✓ PAID' : '⏳ UNPAID'}
          </span>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px">
      <div style="background:#f9f9f9;padding:10px;border-radius:6px;border-left:3px solid #e8400a">
        <div style="font-size:0.7rem;color:#888;text-transform:uppercase;margin-bottom:2px">Customer</div>
        <div style="font-weight:700">${userInfo?.full_name || b.full_name || 'Customer'}</div>
        <div style="font-size:0.82rem;color:#555">${userInfo?.phone || b.phone || ''}</div>
      </div>
      <div style="background:#f9f9f9;padding:10px;border-radius:6px;border-left:3px solid #e8400a">
        <div style="font-size:0.7rem;color:#888;text-transform:uppercase;margin-bottom:2px">Vehicle</div>
        <div style="font-weight:700">${b.vehicle_type} — ${b.vehicle_year} ${b.vehicle_make} ${b.vehicle_model}</div>
        <div style="font-size:0.82rem;color:#555">Plate: <strong>${b.vehicle_plate}</strong> | Date: ${fdate(b.booking_date)}</div>
      </div>
    </div>

    <table class="invoice-tbl">
      <thead><tr><th>Description</th><th style="text-align:right;width:130px">Amount (₹)</th></tr></thead>
      <tbody>
        ${svcRows}
        <tr><td><strong>Labour Charges</strong></td><td style="text-align:right">${inr(labour)}</td></tr>
        ${parts > 0 ? `<tr><td>Spare Parts${b.bill_notes ? ` — ${b.bill_notes}` : ''}</td><td style="text-align:right">${inr(parts)}</td></tr>` : ''}
        <tr style="background:#f9f9f9"><td style="color:#555">Sub Total</td><td style="text-align:right">${inr(subtotal)}</td></tr>
        <tr style="background:#fff3e0"><td style="color:#e65100">GST @ 18% (CGST 9% + SGST 9%)</td><td style="text-align:right;color:#e65100">${inr(gst)}</td></tr>
        <tr class="invoice-total-row"><td>GRAND TOTAL</td><td style="text-align:right">${inr(total)}</td></tr>
      </tbody>
    </table>

    <div style="background:#fff3e0;border:1px solid #ffcc80;padding:8px 12px;border-radius:5px;font-size:0.82rem;margin:10px 0">
      <strong>Amount in Words:</strong> ${numWords(total)} Rupees Only
    </div>
    ${isPaid && b.cashfree_payment_id ? `<div style="background:#d4edda;padding:6px 12px;border-radius:5px;font-size:0.8rem;color:#155724;margin-bottom:10px"><strong>✓ Payment ID:</strong> ${b.cashfree_payment_id}</div>` : ''}
    <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px dashed #ddd;font-size:0.75rem;color:#888">
      <div>Thank you for visiting Manish Auto Garage!<br>Warranty: 30 days on labour | Parts as per manufacturer</div>
      <div style="text-align:center"><div style="height:30px;border-top:1px solid #333;width:120px;margin-top:25px"></div><div>Authorised Signature</div></div>
    </div>
  </div>`;
}
