
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN;

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (!SUPABASE_URL || !SUPABASE_KEY || !ADMIN_TOKEN) {
    return res.status(500).json({ error: 'تنظیمات سرور کامل نیست.' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const isAdmin = token.length === ADMIN_TOKEN.length &&
    token === ADMIN_TOKEN;

  try {
    if (req.method === 'POST') {
      const order = req.body || {};

      if (
        typeof order.customer !== 'string' ||
        typeof order.phone !== 'string' ||
        typeof order.address !== 'string' ||
        !Array.isArray(order.items) ||
        !order.items.length ||
        !Number.isFinite(Number(order.total)) ||
        Number(order.total) < 0
      ) {
        return res.status(400).json({ error: 'اطلاعات سفارش معتبر نیست.' });
      }

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/orders`,
        {
          method: 'POST',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation'
          },
          body: JSON.stringify({
            order_code: String(order.id || Date.now()),
            order_date: String(order.date || new Date().toISOString()),
            customer_name: order.customer,
            phone: order.phone,
            address: order.address,
            location: order.location || null,
            payment_method: order.paymentMethod || 'cash',
            note: order.note || '',
            items: order.items,
            total: Number(order.total),
            status: 'جدید'
          })
        }
      );

      if (!response.ok) {
        return res.status(502).json({ error: 'ذخیره سفارش در پایگاه داده ناموفق بود.' });
      }

      return res.status(201).json({ ok: true });
    }

    if (req.method === 'GET') {
      if (!isAdmin) {
        return res.status(401).json({ error: 'دسترسی مدیریت لازم است.' });
      }

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?select=*&order=created_at.desc`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`
          }
        }
      );

      if (!response.ok) {
        return res.status(502).json({ error: 'دریافت سفارش‌ها ناموفق بود.' });
      }

      const rows = await response.json();
      return res.status(200).json(rows.map(row => ({
        id: Number(row.order_code) || row.id,
        date: row.order_date || row.created_at,
        customer: row.customer_name || '',
        phone: row.phone || '',
        address: row.address || '',
        location: row.location || null,
        paymentMethod: row.payment_method || 'cash',
        note: row.note || '',
        items: row.items || [],
        total: Number(row.total) || 0,
        status: row.status || 'جدید'
      })));
    }

    if (req.method === 'PATCH') {
      if (!isAdmin) {
        return res.status(401).json({ error: 'دسترسی مدیریت لازم است.' });
      }

      const { id, status } = req.body || {};
      const allowed = ['جدید', 'در حال آماده‌سازی', 'آماده تحویل', 'تحویل شد', 'لغو شد'];

      if (!id || !allowed.includes(status)) {
        return res.status(400).json({ error: 'اطلاعات وضعیت معتبر نیست.' });
      }

      const response = await fetch(
        `${SUPABASE_URL}/rest/v1/orders?order_code=eq.${encodeURIComponent(String(id))}`,
        {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=minimal'
          },
          body: JSON.stringify({ status })
        }
      );

      if (!response.ok) {
        return res.status(502).json({ error: 'تغییر وضعیت سفارش ناموفق بود.' });
      }

      return res.status(200).json({ ok: true });
    }

    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'این روش پشتیبانی نمی‌شود.' });
  } catch {
    return res.status(500).json({ error: 'خطای داخلی سرور.' });
  }
};
