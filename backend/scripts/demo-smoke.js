const DEMO_ADMIN_EMAIL = process.env.DEMO_ADMIN_EMAIL || 'admin.demo@disenosacuna.com';
const DEMO_ADMIN_PASSWORD = process.env.DEMO_ADMIN_PASSWORD || 'AdminDemo123!';
const DEMO_CUSTOMER_EMAIL = process.env.DEMO_CUSTOMER_EMAIL || 'cliente.demo@disenosacuna.com';
const DEMO_CUSTOMER_PASSWORD = process.env.DEMO_CUSTOMER_PASSWORD || 'ClienteDemo123!';
const API_BASE = process.env.DEMO_API_BASE || 'http://localhost:4000/api';
const APP_BASE = process.env.DEMO_APP_BASE || 'http://localhost:4000';

async function requestJson(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const message = data?.message || `Request failed: ${res.status}`;
    throw new Error(`${path} -> ${message}`);
  }

  return data;
}

async function run() {
  console.log('Iniciando smoke demo...');

  const designs = await requestJson('/catalog/designs?limit=1');
  const design = designs?.data?.[0];
  if (!design?.id) {
    throw new Error('No hay disenos para demo. Ejecuta npm run db:seed');
  }

  const customerLogin = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_CUSTOMER_EMAIL, password: DEMO_CUSTOMER_PASSWORD }),
  });

  const adminLogin = await requestJson('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_ADMIN_EMAIL, password: DEMO_ADMIN_PASSWORD }),
  });

  const checkout = await requestJson('/orders/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${customerLogin.token}`,
    },
    body: JSON.stringify({
      customerId: customerLogin.user.customer_id,
      items: [
        {
          designId: design.id,
          quantity: 1,
          personalizationData: { nombre: 'Demo Video', mensaje: 'Pedido de demostracion' },
        },
      ],
      shippingPrice: 0,
      notes: 'Pedido de prueba para demo',
    }),
  });

  const orderId = checkout?.data?.id;
  if (!orderId) {
    throw new Error('No se creo la orden en checkout');
  }

  await requestJson(`/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminLogin.token}`,
    },
    body: JSON.stringify({ status: 'paid', notes: 'Pago confirmado en video demo' }),
  });

  const orderDetail = await requestJson(`/orders/${orderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${customerLogin.token}`,
    },
  });

  const healthRes = await fetch(`${APP_BASE}/health`);
  if (!healthRes.ok) {
    throw new Error(`/health no disponible: ${healthRes.status}`);
  }

  const metricsRes = await fetch(`${APP_BASE}/metrics`);
  const metricsText = await metricsRes.text();
  if (!metricsRes.ok || !metricsText.includes('db_up')) {
    throw new Error('/metrics no contiene metrica db_up');
  }

  const result = {
    ok: true,
    orderId,
    orderCode: checkout.data.order_code,
    orderStatus: orderDetail?.data?.status,
    designUsed: design.slug,
  };

  console.log('DEMO_SMOKE_OK');
  console.log(JSON.stringify(result, null, 2));
}

run().catch((error) => {
  console.error('DEMO_SMOKE_FAIL');
  console.error(error.message);
  process.exitCode = 1;
});
