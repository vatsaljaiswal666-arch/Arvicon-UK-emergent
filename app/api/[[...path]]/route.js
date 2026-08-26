import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import * as XLSX from 'xlsx'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const json = (data, status = 200) => NextResponse.json(data, { status })
const err = (msg, status = 400) => json({ error: msg }, status)

// ============ HEALTH / SETUP ============
async function health() {
  const db = supabaseAdmin()
  const tables = ['products', 'customers', 'suppliers', 'warehouses', 'inventory',
    'sales_orders', 'invoices', 'shipments', 'inventory_movements', 'alerts']
  const results = {}
  for (const t of tables) {
    // Use actual GET query (not HEAD) - HEAD returns 200 even for missing tables in some PostgREST configs
    const { data, error } = await db.from(t).select('id').limit(1)
    if (error) {
      results[t] = { ok: false, error: error.message || 'Table not found' }
    } else {
      // Get count separately
      const { count } = await db.from(t).select('id', { count: 'exact', head: true })
      results[t] = { ok: true, count: count || 0 }
    }
  }
  const ready = Object.values(results).every(r => r.ok)
  return json({ ready, tables: results })
}

// ============ DEMO DATA SEEDING ============
async function seed() {
  const db = supabaseAdmin()
  // Wipe existing demo inventory + shipments + demo movements first for idempotency
  await db.from('inventory_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('inventory').delete().eq('is_demo', true)
  await db.from('shipment_items').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  await db.from('shipments').delete().eq('is_demo', true)
  // Warehouses
  let { data: whs } = await db.from('warehouses').select('*').eq('code', 'WH-UK-01').limit(1)
  let warehouse = whs?.[0]
  if (!warehouse) {
    const { data } = await db.from('warehouses').insert({
      code: 'WH-UK-01', name: 'Arvicon UK Main Warehouse', country: 'United Kingdom'
    }).select().single()
    warehouse = data
  }

  // Products - Natural Stone catalog
  const productSeed = [
    { sku: 'SND-KAN-6040-25', name: 'Kandla Grey Sandstone', category: 'Sandstone', material: 'Sandstone', colour: 'Grey', finish: 'Natural', size: '600x400x25mm', thickness_mm: 25, grade: 'A', standard_cost: 12.50, standard_selling_price: 24.00, min_stock_level: 500 },
    { sku: 'SND-RAJ-6060-30', name: 'Rajasthan Green Sandstone', category: 'Sandstone', material: 'Sandstone', colour: 'Green', finish: 'Honed', size: '600x600x30mm', thickness_mm: 30, grade: 'A', standard_cost: 14.00, standard_selling_price: 28.00, min_stock_level: 400 },
    { sku: 'LIM-KOT-6030-20', name: 'Kota Blue Limestone', category: 'Limestone', material: 'Limestone', colour: 'Blue', finish: 'Polished', size: '600x300x20mm', thickness_mm: 20, grade: 'A', standard_cost: 18.00, standard_selling_price: 34.00, min_stock_level: 300 },
    { sku: 'LIM-YEL-6040-25', name: 'Yellow Limestone Cobbles', category: 'Limestone', material: 'Limestone', colour: 'Yellow', finish: 'Tumbled', size: '600x400x25mm', thickness_mm: 25, grade: 'B', standard_cost: 16.00, standard_selling_price: 30.00, min_stock_level: 250 },
    { sku: 'GRA-BLK-6030-20', name: 'Black Galaxy Granite', category: 'Granite', material: 'Granite', colour: 'Black', finish: 'Polished', size: '600x300x20mm', thickness_mm: 20, grade: 'A', standard_cost: 42.00, standard_selling_price: 78.00, min_stock_level: 200 },
    { sku: 'GRA-IMP-6060-30', name: 'Imperial Red Granite', category: 'Granite', material: 'Granite', colour: 'Red', finish: 'Flamed', size: '600x600x30mm', thickness_mm: 30, grade: 'A', standard_cost: 38.00, standard_selling_price: 72.00, min_stock_level: 200 },
    { sku: 'MAR-STAT-6060-20', name: 'Statuario Marble', category: 'Marble', material: 'Marble', colour: 'White', finish: 'Polished', size: '600x600x20mm', thickness_mm: 20, grade: 'A', standard_cost: 65.00, standard_selling_price: 125.00, min_stock_level: 150 },
    { sku: 'SLT-BLK-6030-15', name: 'Brazilian Black Slate', category: 'Slate', material: 'Slate', colour: 'Black', finish: 'Natural', size: '600x300x15mm', thickness_mm: 15, grade: 'A', standard_cost: 22.00, standard_selling_price: 42.00, min_stock_level: 300 },
    { sku: 'POR-BEI-6060-10', name: 'Porcelain Beige 600x600', category: 'Porcelain', material: 'Porcelain', colour: 'Beige', finish: 'Matte', size: '600x600x10mm', thickness_mm: 10, grade: 'A', standard_cost: 8.50, standard_selling_price: 18.00, min_stock_level: 800 },
    { sku: 'SVR-MIX-LP', name: 'Mixed Stone Veneer Loose Panels', category: 'Stone Veneer', material: 'Sandstone', colour: 'Mixed', finish: 'Natural', size: 'Loose', thickness_mm: 30, grade: 'A', standard_cost: 28.00, standard_selling_price: 56.00, min_stock_level: 150 },
  ]
  for (const p of productSeed) {
    await db.from('products').upsert({ ...p, is_demo: true, active: true }, { onConflict: 'sku' })
  }
  const { data: allProducts } = await db.from('products').select('*').eq('is_demo', true)

  // Customers
  const customerSeed = [
    { code: 'CUST-001', company_name: 'Stone Direct UK Ltd', contact_person: 'James Whitmore', email: 'james@stonedirectuk.com', phone: '+44 20 7946 0123', country: 'United Kingdom', payment_terms: 'Net 30', credit_limit: 50000, currency: 'GBP' },
    { code: 'CUST-002', company_name: 'Landscapes Europe GmbH', contact_person: 'Anna M\u00fcller', email: 'anna@landscapes-eu.de', phone: '+49 30 12345678', country: 'Germany', payment_terms: 'Net 45', credit_limit: 75000, currency: 'EUR' },
    { code: 'CUST-003', company_name: 'Heritage Paving Co', contact_person: 'Sarah OConnor', email: 'sarah@heritagepaving.co.uk', phone: '+44 161 496 0123', country: 'United Kingdom', payment_terms: 'Net 30', credit_limit: 40000, currency: 'GBP' },
    { code: 'CUST-004', company_name: 'Mediterranean Stone SL', contact_person: 'Carlos Ruiz', email: 'carlos@medstone.es', phone: '+34 93 123 4567', country: 'Spain', payment_terms: 'Net 60', credit_limit: 60000, currency: 'EUR' },
    { code: 'CUST-005', company_name: 'Northern Yards Inc', contact_person: 'Michael Chen', email: 'mchen@northernyards.com', phone: '+1 617 555 0198', country: 'United States', payment_terms: 'Net 30', credit_limit: 100000, currency: 'USD' },
  ]
  for (const c of customerSeed) await db.from('customers').upsert({ ...c, is_demo: true }, { onConflict: 'code' })
  const { data: allCustomers } = await db.from('customers').select('*').eq('is_demo', true)

  // Suppliers
  const supplierSeed = [
    { code: 'SUP-001', name: 'Rajasthan Stone Quarries Pvt Ltd', contact_person: 'Rakesh Sharma', email: 'rakesh@rsquarries.in', phone: '+91 141 234 5678', country: 'India', payment_terms: 'Net 45' },
    { code: 'SUP-002', name: 'Kota Blue Traders', contact_person: 'Vikram Singh', email: 'vikram@kotablue.in', phone: '+91 744 234 5678', country: 'India', payment_terms: 'Net 30' },
    { code: 'SUP-003', name: 'Southern Granite Exporters', contact_person: 'Ramesh Iyer', email: 'ramesh@sge.in', phone: '+91 80 4567 8901', country: 'India', payment_terms: 'Net 60' },
    { code: 'SUP-004', name: 'Carrara Marble Direct', contact_person: 'Luca Bianchi', email: 'luca@carraramarble.it', phone: '+39 0585 12345', country: 'Italy', payment_terms: 'Net 30' },
  ]
  for (const s of supplierSeed) await db.from('suppliers').upsert({ ...s, is_demo: true }, { onConflict: 'code' })
  const { data: allSuppliers } = await db.from('suppliers').select('*').eq('is_demo', true)

  const pById = Object.fromEntries(allProducts.map(p => [p.sku, p]))
  const cById = Object.fromEntries(allCustomers.map(c => [c.code, c]))
  const sById = Object.fromEntries(allSuppliers.map(s => [s.code, s]))

  // Inventory - varied stock records
  const today = new Date()
  const daysAgo = (n) => new Date(today.getTime() - n * 86400000).toISOString().slice(0, 10)
  const stockSeed = [
    { sku: 'SND-KAN-6040-25', batch: 'B-KAN-2024-11', qty: 2400, pallets: 32, source: 'outsourced', supplier: 'SUP-001', supplier_cost: 30000, freight: 4500, duty_tax: 2100, handling: 800, selling: 25.50, status: 'available', days: 42 },
    { sku: 'SND-KAN-6040-25', batch: 'B-KAN-2025-02', qty: 1800, pallets: 24, source: 'outsourced', supplier: 'SUP-001', supplier_cost: 22500, freight: 3200, duty_tax: 1600, handling: 600, selling: 26.00, status: 'reserved', days: 12, customer: 'CUST-001' },
    { sku: 'SND-RAJ-6060-30', batch: 'B-RAJ-2025-01', qty: 1500, pallets: 20, source: 'outsourced', supplier: 'SUP-001', supplier_cost: 21000, freight: 3800, duty_tax: 1800, handling: 700, selling: 29.00, status: 'available', days: 28 },
    { sku: 'LIM-KOT-6030-20', batch: 'B-KOT-2024-12', qty: 950, pallets: 14, source: 'outsourced', supplier: 'SUP-002', supplier_cost: 17100, freight: 2800, duty_tax: 1400, handling: 550, selling: 35.00, status: 'available', days: 55 },
    { sku: 'LIM-KOT-6030-20', batch: 'B-KOT-2025-03', qty: 620, pallets: 9, source: 'outsourced', supplier: 'SUP-002', supplier_cost: 11160, freight: 1900, duty_tax: 950, handling: 400, selling: 36.00, status: 'in_transit', days: 8 },
    { sku: 'LIM-YEL-6040-25', batch: 'B-YEL-2024-10', qty: 210, pallets: 4, source: 'outsourced', supplier: 'SUP-002', supplier_cost: 3360, freight: 800, duty_tax: 400, handling: 200, selling: 32.00, status: 'available', days: 92 },
    { sku: 'GRA-BLK-6030-20', batch: 'B-BLK-2025-02', qty: 720, pallets: 12, source: 'outsourced', supplier: 'SUP-003', supplier_cost: 30240, freight: 4200, duty_tax: 2600, handling: 900, selling: 82.00, status: 'available', days: 18 },
    { sku: 'GRA-IMP-6060-30', batch: 'B-IMP-2024-11', qty: 480, pallets: 8, source: 'outsourced', supplier: 'SUP-003', supplier_cost: 18240, freight: 3200, duty_tax: 1900, handling: 700, selling: 75.00, status: 'available', days: 48 },
    { sku: 'MAR-STAT-6060-20', batch: 'B-STAT-2025-01', qty: 320, pallets: 6, source: 'outsourced', supplier: 'SUP-004', supplier_cost: 20800, freight: 3600, duty_tax: 2200, handling: 800, selling: 128.00, status: 'reserved', days: 22, customer: 'CUST-002' },
    { sku: 'SLT-BLK-6030-15', batch: 'B-SLT-2025-02', qty: 1450, pallets: 18, source: 'outsourced', supplier: 'SUP-001', supplier_cost: 31900, freight: 4400, duty_tax: 2400, handling: 850, selling: 44.00, status: 'available', days: 21 },
    { sku: 'POR-BEI-6060-10', batch: 'B-POR-2024-09', qty: 380, pallets: 6, source: 'own_production', production_cost: 3230, freight: 200, handling: 150, selling: 18.50, status: 'available', days: 118 },
    { sku: 'SVR-MIX-LP', batch: 'B-SVR-2025-03', qty: 180, pallets: 3, source: 'own_production', production_cost: 5040, freight: 400, handling: 250, selling: 58.00, status: 'available', days: 5 },
  ]
  let stockCounter = 1
  for (const s of stockSeed) {
    const p = pById[s.sku]
    if (!p) continue
    const stock_id = 'STK-' + String(stockCounter++).padStart(5, '0')
    const row = {
      stock_id, product_id: p.id, warehouse_id: warehouse.id,
      batch_lot: s.batch,
      quantity_sqm: s.qty, pallets: s.pallets || 0,
      source: s.source,
      supplier_id: s.supplier ? sById[s.supplier].id : null,
      supplier_cost: s.supplier_cost || 0,
      production_cost: s.production_cost || 0,
      freight_cost: s.freight || 0, duty_tax: s.duty_tax || 0,
      handling_cost: s.handling || 0,
      selling_price_sqm: s.selling,
      status: s.status,
      customer_id: s.customer ? cById[s.customer].id : null,
      reserved_sqm: s.status === 'reserved' ? s.qty : 0,
      date_added: daysAgo(s.days),
      is_demo: true,
    }
    const { data: inserted } = await db.from('inventory').insert(row).select().single()
    if (inserted) {
      await db.from('inventory_movements').insert({
        inventory_id: inserted.id, product_id: p.id, movement_type: 'Stock Added',
        quantity_sqm: s.qty, notes: 'Initial demo stock', actor: 'system',
      })
    }
  }

  // Shipments
  const shipSeed = [
    { sid: 'SHP-2025-001', cn: 'MSCU1234567', vessel: 'MSC Gulsun', line: 'MSC', etd_d: -20, eta_d: 3, actual_dep_d: -18, origin: 'Mundra, India', dest: 'Southampton, UK', pol: 'Mundra', pod: 'Southampton', status: 'in_transit', customer: 'CUST-001', freight: 3500, port_charges: 800, customs: 400, sqm: 1800, pallets: 24 },
    { sid: 'SHP-2025-002', cn: 'CMAU9876543', vessel: 'CMA CGM Marco Polo', line: 'CMA CGM', etd_d: -15, eta_d: -2, actual_dep_d: -14, origin: 'Chennai, India', dest: 'Felixstowe, UK', pol: 'Chennai', pod: 'Felixstowe', status: 'in_transit', customer: 'CUST-003', freight: 3200, port_charges: 750, customs: 380, sqm: 620, pallets: 9 },
    { sid: 'SHP-2025-003', cn: 'OOLU5551234', vessel: 'OOCL Hong Kong', line: 'OOCL', etd_d: -8, eta_d: 6, actual_dep_d: -8, origin: 'Mundra, India', dest: 'Hamburg, Germany', pol: 'Mundra', pod: 'Hamburg', status: 'in_transit', customer: 'CUST-002', freight: 3800, port_charges: 900, customs: 500, sqm: 320, pallets: 6 },
    { sid: 'SHP-2025-004', cn: 'HLXU2223344', vessel: 'Hapag Berlin', line: 'Hapag-Lloyd', etd_d: null, eta_d: null, status: 'production', customer: 'CUST-004', origin: 'Jaipur, India', dest: 'Barcelona, Spain', sqm: 1450, pallets: 18 },
    { sid: 'SHP-2025-005', cn: 'EGLV7778899', vessel: 'Ever Given', line: 'Evergreen', etd_d: null, eta_d: null, status: 'ready', customer: 'CUST-005', origin: 'Chennai, India', dest: 'Boston, USA', sqm: 720, pallets: 12 },
    { sid: 'SHP-2025-006', cn: 'MSCU4445566', vessel: 'MSC Oscar', line: 'MSC', etd_d: -35, eta_d: -3, actual_dep_d: -33, actual_arr_d: -1, origin: 'Mundra, India', dest: 'Southampton, UK', pol: 'Mundra', pod: 'Southampton', status: 'delivered', customer: 'CUST-001', freight: 3400, port_charges: 780, customs: 420, sqm: 2400, pallets: 32 },
  ]
  for (const s of shipSeed) {
    const etd = s.etd_d != null ? daysAgo(-s.etd_d) : null
    const eta = s.eta_d != null ? daysAgo(-s.eta_d) : null
    const actual_departure = s.actual_dep_d != null ? daysAgo(-s.actual_dep_d) : null
    const actual_arrival = s.actual_arr_d != null ? daysAgo(-s.actual_arr_d) : null
    await db.from('shipments').upsert({
      shipment_id: s.sid, container_number: s.cn, vessel: s.vessel, shipping_line: s.line,
      etd, eta, actual_departure, actual_arrival,
      origin: s.origin, destination: s.dest, port_loading: s.pol, port_discharge: s.pod,
      status: s.status, freight: s.freight || 0, port_charges: s.port_charges || 0, customs: s.customs || 0,
      customer_id: cById[s.customer]?.id, total_sqm: s.sqm, pallets: s.pallets,
      is_demo: true,
    }, { onConflict: 'shipment_id' })
  }

  // Sales orders
  const soSeed = [
    { on: 'SO-2025-001', customer: 'CUST-001', status: 'confirmed', days: 8, items: [{ sku: 'SND-KAN-6040-25', qty: 1800, price: 26.00 }] },
    { on: 'SO-2025-002', customer: 'CUST-002', status: 'confirmed', days: 22, items: [{ sku: 'MAR-STAT-6060-20', qty: 320, price: 128.00 }] },
    { on: 'SO-2025-003', customer: 'CUST-003', status: 'delivered', days: 45, items: [{ sku: 'SND-KAN-6040-25', qty: 2400, price: 25.50 }] },
    { on: 'SO-2025-004', customer: 'CUST-005', status: 'processing', days: 15, items: [{ sku: 'GRA-BLK-6030-20', qty: 400, price: 82.00 }, { sku: 'SLT-BLK-6030-15', qty: 600, price: 44.00 }] },
  ]
  const soIds = {}
  for (const so of soSeed) {
    // idempotent: upsert-then-fetch by order_number
    const total_sqm = so.items.reduce((a, i) => a + i.qty, 0)
    const total_value = so.items.reduce((a, i) => a + i.qty * i.price, 0)
    await db.from('sales_orders').upsert({
      order_number: so.on, customer_id: cById[so.customer].id, status: so.status,
      order_date: daysAgo(so.days), total_sqm, total_value, is_demo: true,
    }, { onConflict: 'order_number' })
    const { data: soRow } = await db.from('sales_orders').select('*').eq('order_number', so.on).single()
    if (!soRow) continue
    soIds[so.on] = soRow.id
    // clear then re-insert items for idempotency
    await db.from('sales_order_items').delete().eq('sales_order_id', soRow.id)
    for (const it of so.items) {
      await db.from('sales_order_items').insert({
        sales_order_id: soRow.id, product_id: pById[it.sku].id,
        quantity_sqm: it.qty, price_per_sqm: it.price, allocated_sqm: so.status === 'confirmed' || so.status === 'delivered' ? it.qty : 0,
      })
    }
  }

  // Invoices + Payments
  const invSeed = [
    { in: 'INV-2025-001', so: 'SO-2025-001', customer: 'CUST-001', amount: 46800, paid: 20000, days: 6, due_days: 30, status: 'partially_paid' },
    { in: 'INV-2025-002', so: 'SO-2025-002', customer: 'CUST-002', amount: 40960, paid: 0, days: 20, due_days: 45, status: 'unpaid' },
    { in: 'INV-2025-003', so: 'SO-2025-003', customer: 'CUST-003', amount: 61200, paid: 61200, days: 40, due_days: 30, status: 'paid' },
    { in: 'INV-2024-098', so: null, customer: 'CUST-004', amount: 18500, paid: 0, days: 78, due_days: 60, status: 'overdue' },
  ]
  for (const inv of invSeed) {
    const invoice_date = daysAgo(inv.days)
    const due_date = daysAgo(inv.days - inv.due_days)
    await db.from('invoices').upsert({
      invoice_number: inv.in, customer_id: cById[inv.customer].id,
      sales_order_id: inv.so ? soIds[inv.so] : null,
      invoice_date, due_date, amount: inv.amount, amount_paid: inv.paid, status: inv.status,
      is_demo: true,
    }, { onConflict: 'invoice_number' })
    const { data: invRow } = await db.from('invoices').select('*').eq('invoice_number', inv.in).single()
    if (invRow && inv.paid > 0) {
      // clear old payments for demo idempotency
      await db.from('payments').delete().eq('invoice_id', invRow.id)
      await db.from('payments').insert({
        invoice_id: invRow.id, payment_date: daysAgo(inv.days - 5), amount: inv.paid, method: 'Bank Transfer',
      })
    }
  }

  // Alerts (calculated insights)
  await db.from('alerts').delete().eq('type', 'demo').neq('id', '00000000-0000-0000-0000-000000000000')
  const alerts = [
    { type: 'demo', severity: 'warning', message: 'Yellow Limestone Cobbles has been unsold for 92 days (Slow-moving stock)' },
    { type: 'demo', severity: 'danger', message: 'Container CMAU9876543 is 2 days overdue (ETA passed)' },
    { type: 'demo', severity: 'danger', message: 'Invoice INV-2024-098 (Mediterranean Stone SL) is 18 days overdue - \u20ac18,500' },
    { type: 'demo', severity: 'info', message: 'Black Galaxy Granite generated the highest gross margin this month' },
    { type: 'demo', severity: 'warning', message: 'Porcelain Beige stock (380 SQM) below reorder point (800 SQM)' },
  ]
  await db.from('alerts').insert(alerts)

  return json({ ok: true, message: 'Demo data seeded successfully' })
}

async function wipeDemo() {
  const db = supabaseAdmin()
  const notNull = '00000000-0000-0000-0000-000000000000'
  await db.from('payments').delete().neq('id', notNull)
  await db.from('invoices').delete().eq('is_demo', true)
  await db.from('sales_order_items').delete().neq('id', notNull)
  await db.from('sales_orders').delete().eq('is_demo', true)
  await db.from('shipment_items').delete().neq('id', notNull)
  await db.from('shipments').delete().eq('is_demo', true)
  await db.from('inventory_movements').delete().neq('id', notNull)
  await db.from('inventory').delete().eq('is_demo', true)
  await db.from('customers').delete().eq('is_demo', true)
  await db.from('suppliers').delete().eq('is_demo', true)
  await db.from('products').delete().eq('is_demo', true)
  await db.from('alerts').delete().eq('type', 'demo')
  return json({ ok: true, message: 'Demo data removed' })
}

// ============ DASHBOARD ============
async function dashboard() {
  const db = supabaseAdmin()
  // Auto-refresh insights before returning dashboard
  try { await recomputeInsights() } catch (e) { console.error('insights err', e.message) }
  const [inv, orders, invoices, shipments, alerts] = await Promise.all([
    db.from('inventory').select('*, products(name,category,colour,sku), suppliers(name)'),
    db.from('sales_orders').select('*, customers(company_name,country,currency)'),
    db.from('invoices').select('*, customers(company_name,currency)'),
    db.from('shipments').select('*, customers(company_name)'),
    db.from('alerts').select('*').eq('resolved', false).order('created_at', { ascending: false }).limit(10),
  ])
  const inventory = inv.data || []
  const salesOrders = orders.data || []
  const inv_data = invoices.data || []
  const shp = shipments.data || []

  const num = (v) => Number(v || 0)
  const totalSqm = inventory.reduce((a, r) => a + num(r.quantity_sqm), 0)
  const reservedSqm = inventory.reduce((a, r) => a + num(r.reserved_sqm), 0)
  const inTransitSqm = inventory.filter(r => r.status === 'in_transit').reduce((a, r) => a + num(r.quantity_sqm), 0)
  const availableSqm = inventory.filter(r => r.status === 'available').reduce((a, r) => a + num(r.quantity_sqm) - num(r.reserved_sqm), 0)
  const stockValue = inventory.reduce((a, r) => a + num(r.total_landed_cost), 0)
  const potentialValue = inventory.reduce((a, r) => a + num(r.quantity_sqm) * num(r.selling_price_sqm), 0)
  const totalPallets = inventory.reduce((a, r) => a + num(r.pallets), 0)

  const today = new Date().toISOString().slice(0, 10)
  const monthStart = new Date(); monthStart.setDate(1)
  const yearStart = new Date(); yearStart.setMonth(0, 1)
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7)

  const monthSales = salesOrders.filter(o => new Date(o.order_date) >= monthStart).reduce((a, o) => a + num(o.total_value), 0)
  const yearSales = salesOrders.filter(o => new Date(o.order_date) >= yearStart).reduce((a, o) => a + num(o.total_value), 0)
  const weekSales = salesOrders.filter(o => new Date(o.order_date) >= weekStart).reduce((a, o) => a + num(o.total_value), 0)
  const todaySales = salesOrders.filter(o => o.order_date === today).reduce((a, o) => a + num(o.total_value), 0)

  // Profitability
  const soldOrDeliveredInv = inventory.filter(r => ['sold', 'delivered'].includes(r.status))
  const revenue = soldOrDeliveredInv.reduce((a, r) => a + num(r.quantity_sqm) * num(r.selling_price_sqm), 0)
  const cost = soldOrDeliveredInv.reduce((a, r) => a + num(r.total_landed_cost), 0)
  const grossProfit = revenue - cost
  const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : 0

  // Shipments buckets
  const now = new Date()
  const inTransitShips = shp.filter(s => s.status === 'in_transit')
  const productionShips = shp.filter(s => s.status === 'production')
  const readyShips = shp.filter(s => s.status === 'ready')
  const deliveredShips = shp.filter(s => s.status === 'delivered')
  const delayedShips = shp.filter(s => s.eta && new Date(s.eta) < now && !['delivered', 'arrived', 'cancelled'].includes(s.status))
  const arrivingThisWeek = shp.filter(s => {
    if (!s.eta) return false
    const eta = new Date(s.eta); const wk = new Date(); wk.setDate(wk.getDate() + 7)
    return eta >= now && eta <= wk
  })

  // Receivables
  const outstanding = inv_data.reduce((a, r) => a + (num(r.amount) - num(r.amount_paid)), 0)
  const overdue = inv_data.filter(r => r.due_date && new Date(r.due_date) < now && r.status !== 'paid')
    .reduce((a, r) => a + (num(r.amount) - num(r.amount_paid)), 0)
  const dueThisWeek = inv_data.filter(r => {
    if (!r.due_date) return false
    const d = new Date(r.due_date); const wk = new Date(); wk.setDate(wk.getDate() + 7)
    return d >= now && d <= wk && r.status !== 'paid'
  }).reduce((a, r) => a + (num(r.amount) - num(r.amount_paid)), 0)

  // Ageing
  const ageing = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
  for (const r of inv_data) {
    if (r.status === 'paid' || !r.due_date) continue
    const outstandingAmt = num(r.amount) - num(r.amount_paid)
    if (outstandingAmt <= 0) continue
    const days = Math.floor((now - new Date(r.due_date)) / 86400000)
    if (days < 0) continue
    if (days <= 30) ageing['0-30'] += outstandingAmt
    else if (days <= 60) ageing['31-60'] += outstandingAmt
    else if (days <= 90) ageing['61-90'] += outstandingAmt
    else ageing['90+'] += outstandingAmt
  }

  // Sales trend last 6 months
  const trend = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i); d.setDate(1)
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' })
    const startMs = d.getTime()
    const endD = new Date(d); endD.setMonth(endD.getMonth() + 1)
    const val = salesOrders
      .filter(o => { const t = new Date(o.order_date).getTime(); return t >= startMs && t < endD.getTime() })
      .reduce((a, o) => a + num(o.total_value), 0)
    trend.push({ month: label, sales: Math.round(val) })
  }

  // Top products by stock value
  const byProduct = {}
  for (const r of inventory) {
    const key = r.products?.name || 'Unknown'
    if (!byProduct[key]) byProduct[key] = { name: key, sqm: 0, value: 0 }
    byProduct[key].sqm += num(r.quantity_sqm)
    byProduct[key].value += num(r.total_landed_cost)
  }
  const topProducts = Object.values(byProduct).sort((a, b) => b.value - a.value).slice(0, 8)

  // Source split
  const ownSqm = inventory.filter(r => r.source === 'own_production').reduce((a, r) => a + num(r.quantity_sqm), 0)
  const outsourcedSqm = inventory.filter(r => r.source === 'outsourced').reduce((a, r) => a + num(r.quantity_sqm), 0)

  return json({
    stock: {
      total_sqm: totalSqm, available_sqm: availableSqm, reserved_sqm: reservedSqm,
      in_transit_sqm: inTransitSqm, stock_value: stockValue, potential_value: potentialValue,
      total_pallets: totalPallets,
    },
    sales: { today: todaySales, week: weekSales, month: monthSales, year: yearSales, trend },
    profitability: { revenue, cost, gross_profit: grossProfit, gross_margin: grossMargin },
    shipments: {
      in_transit: inTransitShips.length, production: productionShips.length, ready: readyShips.length,
      delivered: deliveredShips.length, delayed: delayedShips.length, arriving_this_week: arrivingThisWeek.length,
      total: shp.length,
    },
    receivables: { outstanding, overdue, due_this_week: dueThisWeek, ageing },
    top_products: topProducts,
    source_split: { own: ownSqm, outsourced: outsourcedSqm },
    alerts: alerts.data || [],
  })
}

// ============ EXCEL IMPORT ============
const COLUMN_MAP = {
  // canonical field -> synonyms
  sku: ['sku', 'product code', 'code', 'item code', 'item'],
  product_name: ['product', 'product name', 'item name', 'description'],
  category: ['category', 'type', 'material type'],
  colour: ['colour', 'color'],
  finish: ['finish'],
  size: ['size', 'dimensions'],
  batch_lot: ['batch', 'lot', 'batch no', 'lot no', 'batch number'],
  quantity_sqm: ['sqm', 'total sqm', 'quantity sqm', 'area', 'quantity', 'qty'],
  pallets: ['pallets', 'pallet', 'no of pallets'],
  weight_mt: ['weight', 'weight mt', 'mt', 'weight (mt)'],
  source: ['source'],
  supplier_code: ['supplier', 'supplier code', 'vendor'],
  supplier_cost: ['supplier cost', 'purchase cost', 'cost'],
  supplier_invoice_number: ['supplier invoice', 'supplier invoice no', 'invoice no', 'invoice number', 'purchase invoice'],
  freight_cost: ['freight', 'freight cost', 'shipping cost'],
  duty_tax: ['duty', 'tax', 'duty tax', 'customs'],
  handling_cost: ['handling', 'handling cost'],
  selling_price_sqm: ['selling price', 'price', 'price per sqm', 'sale price'],
  status: ['status', 'stock status'],
  customer_code: ['customer', 'buyer', 'client'],
  warehouse_location: ['location', 'rack', 'warehouse location'],
  notes: ['notes', 'remarks', 'comments'],
}

function normHeader(h) {
  return String(h || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

function detectMapping(headers) {
  const mapping = {}
  const usedCanonical = new Set()
  const nH = headers.map(normHeader)
  for (const [canon, syns] of Object.entries(COLUMN_MAP)) {
    for (let i = 0; i < nH.length; i++) {
      if (syns.includes(nH[i]) || syns.some(s => nH[i] === s)) {
        if (!usedCanonical.has(canon)) {
          mapping[headers[i]] = canon
          usedCanonical.add(canon)
          break
        }
      }
    }
  }
  return mapping
}

async function excelDetect(request) {
  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return err('No file uploaded')
  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const sheets = wb.SheetNames.map(name => {
    const ws = wb.Sheets[name]
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })
    const headers = rows.length > 0 ? Object.keys(rows[0]) : []
    const mapping = detectMapping(headers)
    // detect type based on headers
    let detected_type = 'stock'
    const hStr = headers.map(normHeader).join(' ')
    if (hStr.includes('container') || hStr.includes('vessel') || hStr.includes('etd')) detected_type = 'shipment'
    else if (hStr.includes('order number') || hStr.includes('sales order') || hStr.includes('so number')) detected_type = 'sales'
    return { name, headers, sample: rows.slice(0, 5), row_count: rows.length, detected_mapping: mapping, detected_type }
  })
  return json({ file_name: file.name, sheets, canonical_fields: Object.keys(COLUMN_MAP) })
}

async function excelImport(request) {
  const form = await request.formData()
  const file = form.get('file')
  const mapping = JSON.parse(form.get('mapping') || '{}') // { excel_header: canonical_field }
  const sheet_name = form.get('sheet_name')
  const import_type = form.get('import_type') || 'stock'
  if (!(file instanceof File)) return err('No file uploaded')
  const db = supabaseAdmin()

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[sheet_name || wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

  // create batch
  const { data: batch } = await db.from('import_batches').insert({
    file_name: file.name, batch_type: import_type, total_rows: rows.length, status: 'processing',
  }).select().single()

  // load lookups
  const { data: products } = await db.from('products').select('id,sku,name,standard_selling_price')
  const { data: suppliers } = await db.from('suppliers').select('id,code,name')
  const { data: customers } = await db.from('customers').select('id,code,company_name')
  const { data: warehouses } = await db.from('warehouses').select('id,code,name').limit(1)
  const productsBySku = Object.fromEntries(products.map(p => [p.sku.toLowerCase(), p]))
  const productsByName = Object.fromEntries(products.map(p => [p.name.toLowerCase(), p]))
  const supplierByCode = Object.fromEntries(suppliers.map(s => [s.code.toLowerCase(), s]))
  const supplierByName = Object.fromEntries(suppliers.map(s => [s.name.toLowerCase(), s]))
  const customerByCode = Object.fromEntries(customers.map(c => [c.code.toLowerCase(), c]))
  const customerByName = Object.fromEntries(customers.map(c => [c.company_name.toLowerCase(), c]))
  const warehouse = warehouses[0]

  // existing SKUs (for duplicate stock detection by batch+sku)
  const { data: existingInv } = await db.from('inventory').select('stock_id,batch_lot,product_id')
  const existingBatchSet = new Set(existingInv.map(i => `${i.product_id}||${i.batch_lot || ''}`))

  let success = 0, failed = 0, duplicates = 0
  const errors = []
  let stockCounter = existingInv.length + 1

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      // apply mapping - build canonical object
      const c = {}
      for (const [excelH, canonicalF] of Object.entries(mapping)) {
        if (canonicalF) c[canonicalF] = row[excelH]
      }
      // resolve product
      let product = null
      if (c.sku) product = productsBySku[String(c.sku).toLowerCase()]
      if (!product && c.product_name) product = productsByName[String(c.product_name).toLowerCase()]
      if (!product) {
        // auto-create product from Excel if we have a name/sku
        const sku = c.sku ? String(c.sku) : (c.product_name ? String(c.product_name).slice(0, 40).replace(/\s+/g, '-').toUpperCase() : null)
        const name = c.product_name || c.sku
        if (!name) throw new Error('Missing product name/SKU')
        const { data: newP } = await db.from('products').insert({
          sku, name, category: c.category || null, colour: c.colour || null,
          finish: c.finish || null, size: c.size || null,
        }).select().single()
        product = newP
        productsBySku[sku.toLowerCase()] = newP
      }

      // resolve supplier
      let supplier_id = null
      if (c.supplier_code) {
        const s = supplierByCode[String(c.supplier_code).toLowerCase()] || supplierByName[String(c.supplier_code).toLowerCase()]
        if (s) supplier_id = s.id
        else {
          const code = 'SUP-' + Date.now().toString(36).toUpperCase().slice(-6)
          const { data: newS } = await db.from('suppliers').insert({ code, name: String(c.supplier_code) }).select().single()
          supplier_id = newS.id
          supplierByCode[code.toLowerCase()] = newS
        }
      }
      let customer_id = null
      if (c.customer_code) {
        const cust = customerByCode[String(c.customer_code).toLowerCase()] || customerByName[String(c.customer_code).toLowerCase()]
        if (cust) customer_id = cust.id
      }

      // duplicate check
      const key = `${product.id}||${c.batch_lot || ''}`
      if (c.batch_lot && existingBatchSet.has(key)) {
        duplicates++
        await db.from('import_rows').insert({
          batch_id: batch.id, row_number: i + 1, raw_data: row, status: 'duplicate', error_message: 'Same batch+product already exists',
        })
        continue
      }

      const qtySqm = Number(c.quantity_sqm) || 0
      if (qtySqm <= 0) throw new Error('Quantity SQM missing or invalid')

      const stock_id = 'STK-' + String(stockCounter++).padStart(5, '0')
      const status = (c.status || 'available').toString().toLowerCase().replace(/\s+/g, '_')
      const validStatus = ['available', 'reserved', 'sold', 'delivered', 'damaged', 'in_transit', 'outsourced', 'on_hold'].includes(status) ? status : 'available'
      const source = (c.source || (supplier_id ? 'outsourced' : 'own_production')).toString().toLowerCase().replace(/\s+/g, '_')
      const validSource = ['own_production', 'outsourced'].includes(source) ? source : (supplier_id ? 'outsourced' : 'own_production')

      const { error: insErr } = await db.from('inventory').insert({
        stock_id, product_id: product.id, warehouse_id: warehouse.id,
        batch_lot: c.batch_lot || null,
        quantity_sqm: qtySqm,
        pallets: Number(c.pallets) || 0,
        weight_mt: Number(c.weight_mt) || 0,
        source: validSource,
        supplier_id, customer_id,
        supplier_cost: Number(c.supplier_cost) || 0,
        supplier_invoice_number: c.supplier_invoice_number || null,
        freight_cost: Number(c.freight_cost) || 0,
        duty_tax: Number(c.duty_tax) || 0,
        handling_cost: Number(c.handling_cost) || 0,
        selling_price_sqm: Number(c.selling_price_sqm) || Number(product.standard_selling_price) || 0,
        status: validStatus,
        warehouse_location: c.warehouse_location || null,
        notes: c.notes || null,
      })
      if (insErr) throw new Error(insErr.message)
      existingBatchSet.add(key)
      await db.from('import_rows').insert({ batch_id: batch.id, row_number: i + 1, raw_data: row, status: 'success' })
      success++
    } catch (e) {
      failed++
      await db.from('import_rows').insert({
        batch_id: batch.id, row_number: i + 1, raw_data: row, status: 'failed', error_message: e.message,
      })
      errors.push({ row: i + 1, error: e.message })
    }
  }

  await db.from('import_batches').update({
    status: 'completed', success_rows: success, failed_rows: failed, duplicate_rows: duplicates,
  }).eq('id', batch.id)

  return json({ ok: true, batch_id: batch.id, total: rows.length, success, failed, duplicates, errors: errors.slice(0, 20) })
}

// ============ EXCEL EXPORT ============
async function excelExport(what) {
  const db = supabaseAdmin()
  let rows = []
  let filename = 'export.xlsx'
  if (what === 'stock') {
    const { data } = await db.from('inventory').select('*, products(sku,name,category,colour,finish,size), suppliers(name), customers(company_name), warehouses(name)')
    rows = (data || []).map(r => ({
      'Stock ID': r.stock_id, 'Date': r.date_added,
      'SKU': r.products?.sku, 'Product': r.products?.name, 'Category': r.products?.category,
      'Colour': r.products?.colour, 'Finish': r.products?.finish, 'Size': r.products?.size,
      'Batch/Lot': r.batch_lot, 'Total SQM': r.quantity_sqm, 'Pallets': r.pallets, 'Weight MT': r.weight_mt,
      'Warehouse': r.warehouses?.name, 'Location': r.warehouse_location,
      'Source': r.source, 'Supplier': r.suppliers?.name, 'Supplier Cost': r.supplier_cost,
      'Freight': r.freight_cost, 'Duty': r.duty_tax, 'Handling': r.handling_cost,
      'Landed Cost': r.total_landed_cost, 'Cost/SQM': r.cost_per_sqm,
      'Selling Price/SQM': r.selling_price_sqm, 'Status': r.status,
      'Reserved SQM': r.reserved_sqm, 'Customer': r.customers?.company_name,
    }))
    filename = 'stock-master.xlsx'
  } else if (what === 'shipments') {
    const { data } = await db.from('shipments').select('*, customers(company_name)')
    rows = (data || []).map(r => ({
      'Shipment ID': r.shipment_id, 'Container': r.container_number, 'Vessel': r.vessel,
      'Line': r.shipping_line, 'ETD': r.etd, 'ETA': r.eta, 'Actual Departure': r.actual_departure,
      'Actual Arrival': r.actual_arrival, 'Origin': r.origin, 'Destination': r.destination,
      'POL': r.port_loading, 'POD': r.port_discharge, 'Status': r.status,
      'Customer': r.customers?.company_name, 'Total SQM': r.total_sqm, 'Pallets': r.pallets,
      'Freight': r.freight, 'Total Shipping Cost': r.total_shipping_cost,
    }))
    filename = 'shipments.xlsx'
  } else if (what === 'sales') {
    const { data } = await db.from('sales_orders').select('*, customers(company_name,country,currency)')
    rows = (data || []).map(r => ({
      'Order Number': r.order_number, 'Date': r.order_date,
      'Customer': r.customers?.company_name, 'Country': r.customers?.country, 'Currency': r.currency,
      'Status': r.status, 'Total SQM': r.total_sqm, 'Total Value': r.total_value,
    }))
    filename = 'sales-orders.xlsx'
  } else if (what === 'invoices') {
    const { data } = await db.from('invoices').select('*, customers(company_name,currency)')
    rows = (data || []).map(r => ({
      'Invoice': r.invoice_number, 'Date': r.invoice_date, 'Due Date': r.due_date,
      'Customer': r.customers?.company_name, 'Currency': r.currency,
      'Amount': r.amount, 'Paid': r.amount_paid, 'Outstanding': Number(r.amount) - Number(r.amount_paid), 'Status': r.status,
    }))
    filename = 'invoices.xlsx'
  }
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Data')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}

async function excelTemplate(what) {
  const templates = {
    stock: [{ 'SKU': 'SND-KAN-6040-25', 'Product': 'Kandla Grey Sandstone', 'Category': 'Sandstone', 'Colour': 'Grey', 'Finish': 'Natural', 'Size': '600x400x25mm', 'Batch': 'B-2025-001', 'Total SQM': 1200, 'Pallets': 16, 'Weight MT': 30, 'Source': 'outsourced', 'Supplier': 'SUP-001', 'Supplier Cost': 15000, 'Freight': 2500, 'Duty': 1200, 'Handling': 500, 'Selling Price/SQM': 25.50, 'Status': 'available', 'Customer': '', 'Notes': 'Example row - replace with real data' }],
    shipment: [{ 'Container': 'MSCU1234567', 'Vessel': 'MSC Example', 'Line': 'MSC', 'ETD': '2025-01-15', 'ETA': '2025-02-05', 'Origin': 'Mundra', 'Destination': 'Southampton', 'POL': 'Mundra', 'POD': 'Southampton', 'Customer': 'CUST-001', 'Product': 'SND-KAN-6040-25', 'Total SQM': 1200, 'Pallets': 16, 'Status': 'in_transit' }],
    sales: [{ 'Order Number': 'SO-2025-100', 'Date': '2025-01-20', 'Customer': 'CUST-001', 'Product': 'SND-KAN-6040-25', 'Quantity': 1200, 'Price': 25.50, 'Status': 'confirmed' }],
  }
  const rows = templates[what] || templates.stock
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template')
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="template-${what}.xlsx"`,
    },
  })
}

// ============ GENERIC CRUD ============
const ALLOWED = new Set(['products', 'customers', 'suppliers', 'warehouses', 'inventory',
  'sales_orders', 'sales_order_items', 'invoices', 'payments', 'shipments', 'shipment_items',
  'outsource_purchases', 'documents', 'alerts', 'inventory_movements', 'import_batches', 'import_rows'])

const SELECT_MAP = {
  inventory: '*, products(sku,name,category,colour,finish,size,thickness_mm), suppliers(name,code), customers(company_name,code), warehouses(name,code)',
  sales_orders: '*, customers(company_name,country,currency), sales_order_items(*, products(sku,name))',
  invoices: '*, customers(company_name,currency), sales_orders(order_number)',
  shipments: '*, customers(company_name), suppliers(name), shipment_items(*, products(sku,name))',
  payments: '*, invoices(invoice_number,customer_id)',
  outsource_purchases: '*, suppliers(name), products(sku,name)',
  inventory_movements: '*, products(sku,name), inventory(stock_id)',
}

async function listResource(resource, url) {
  const db = supabaseAdmin()
  const sel = SELECT_MAP[resource] || '*'
  let q = db.from(resource).select(sel)
  const search = url.searchParams.get('search')
  const status = url.searchParams.get('status')
  const source = url.searchParams.get('source')
  const supplier_id = url.searchParams.get('supplier_id')
  const customer_id = url.searchParams.get('customer_id')
  const product_id = url.searchParams.get('product_id')
  if (status) q = q.eq('status', status)
  if (source) q = q.eq('source', source)
  if (supplier_id) q = q.eq('supplier_id', supplier_id)
  if (customer_id) q = q.eq('customer_id', customer_id)
  if (product_id) q = q.eq('product_id', product_id)
  if (resource === 'inventory' && search) q = q.or(`stock_id.ilike.%${search}%,batch_lot.ilike.%${search}%`)
  q = q.order('created_at', { ascending: false }).limit(500)
  const { data, error } = await q
  if (error) return err(error.message)
  return json({ data: data || [] })
}

async function createResource(resource, body) {
  const db = supabaseAdmin()
  const { data, error } = await db.from(resource).insert(body).select().single()
  if (error) return err(error.message)
  return json({ data })
}
async function updateResource(resource, id, body) {
  const db = supabaseAdmin()
  const { data, error } = await db.from(resource).update(body).eq('id', id).select().single()
  if (error) return err(error.message)
  return json({ data })
}
async function deleteResource(resource, id) {
  const db = supabaseAdmin()
  const { error } = await db.from(resource).delete().eq('id', id)
  if (error) return err(error.message)
  return json({ ok: true })
}

// ============ INVENTORY ACTIONS ============
async function reserveInventory(id, qty, customer_id, sales_order_id) {
  const db = supabaseAdmin()
  const { data: rec } = await db.from('inventory').select('*').eq('id', id).single()
  if (!rec) return err('Inventory not found', 404)
  const newReserved = Number(rec.reserved_sqm || 0) + Number(qty)
  if (newReserved > Number(rec.quantity_sqm)) return err('Cannot reserve more than available')
  const status = newReserved >= Number(rec.quantity_sqm) ? 'reserved' : rec.status
  const { data, error } = await db.from('inventory').update({
    reserved_sqm: newReserved, status,
    customer_id: customer_id || rec.customer_id, sales_order_id: sales_order_id || rec.sales_order_id,
    updated_at: new Date(),
  }).eq('id', id).select().single()
  if (error) return err(error.message)
  await db.from('inventory_movements').insert({
    inventory_id: id, product_id: rec.product_id, movement_type: 'Stock Reserved',
    quantity_sqm: qty, reference_type: 'sales_order', reference_id: sales_order_id || null, actor: 'user',
  })
  return json({ data })
}

async function adjustInventory(id, new_qty, reason) {
  const db = supabaseAdmin()
  const { data: rec } = await db.from('inventory').select('*').eq('id', id).single()
  if (!rec) return err('Not found', 404)
  const diff = Number(new_qty) - Number(rec.quantity_sqm)
  const { data, error } = await db.from('inventory').update({ quantity_sqm: new_qty, updated_at: new Date() }).eq('id', id).select().single()
  if (error) return err(error.message)
  await db.from('inventory_movements').insert({
    inventory_id: id, product_id: rec.product_id, movement_type: 'Stock Adjusted',
    quantity_sqm: diff, notes: reason || null, actor: 'user',
  })
  return json({ data })
}

// ============ SALES ORDER WIZARD (create + reserve in one shot) ============
async function createSalesOrder(body) {
  const db = supabaseAdmin()
  const { customer_id, currency = 'GBP', customer_po, notes, items, status = 'confirmed' } = body
  if (!customer_id) return err('customer_id required')
  if (!items?.length) return err('At least one line item required')

  // Generate order number
  const { count } = await db.from('sales_orders').select('id', { count: 'exact', head: true })
  const order_number = `SO-${new Date().getFullYear()}-${String((count || 0) + 1).padStart(4, '0')}`

  const total_sqm = items.reduce((a, i) => a + Number(i.quantity_sqm || 0), 0)
  const total_value = items.reduce((a, i) => a + Number(i.quantity_sqm || 0) * Number(i.price_per_sqm || 0), 0)

  const { data: so, error } = await db.from('sales_orders').insert({
    order_number, customer_id, currency, customer_po, notes, status, total_sqm, total_value,
  }).select().single()
  if (error) return err(error.message)

  const errors = []
  for (const it of items) {
    const qty = Number(it.quantity_sqm || 0)
    if (qty <= 0) continue

    const { data: item } = await db.from('sales_order_items').insert({
      sales_order_id: so.id, product_id: it.product_id, inventory_id: it.inventory_id || null,
      quantity_sqm: qty, price_per_sqm: it.price_per_sqm || 0,
      allocated_sqm: 0,
    }).select().single()

    // Auto-reserve from inventory if inventory_id provided
    if (it.inventory_id && status !== 'enquiry' && status !== 'quotation') {
      const { data: inv } = await db.from('inventory').select('*').eq('id', it.inventory_id).single()
      if (inv) {
        const availableToReserve = Number(inv.quantity_sqm) - Number(inv.reserved_sqm)
        const toReserve = Math.min(qty, availableToReserve)
        if (toReserve > 0) {
          const newReserved = Number(inv.reserved_sqm) + toReserve
          const newStatus = newReserved >= Number(inv.quantity_sqm) ? 'reserved' : inv.status
          await db.from('inventory').update({
            reserved_sqm: newReserved, status: newStatus,
            customer_id, sales_order_id: so.id, updated_at: new Date(),
          }).eq('id', it.inventory_id)
          await db.from('sales_order_items').update({ allocated_sqm: toReserve }).eq('id', item.id)
          await db.from('inventory_movements').insert({
            inventory_id: it.inventory_id, product_id: inv.product_id,
            movement_type: 'Stock Reserved', quantity_sqm: toReserve,
            reference_type: 'sales_order', reference_id: so.id,
            notes: `Auto-reserved for ${order_number}`,
          })
          if (toReserve < qty) errors.push(`${inv.stock_id}: only ${toReserve} SQM reservable (asked ${qty})`)
        } else {
          errors.push(`Inventory ${inv.stock_id} has no available stock to reserve`)
        }
      }
    }
  }

  return json({ data: so, warnings: errors })
}

// ============ INSIGHTS RECOMPUTE ============
async function recomputeInsights() {
  const db = supabaseAdmin()
  // Wipe existing auto-generated alerts
  await db.from('alerts').delete().eq('type', 'auto')

  const now = new Date()
  const alerts = []

  // 1. Slow-moving stock (available > 60 days, still available)
  const { data: inventory } = await db.from('inventory').select('*, products(name,sku,min_stock_level)')
  for (const r of inventory || []) {
    if (r.status === 'available') {
      const days = Math.floor((now - new Date(r.date_added)) / 86400000)
      if (days >= 60) {
        alerts.push({
          type: 'auto', severity: 'warning',
          message: `${r.products?.name || 'Product'} (${r.stock_id}, ${Number(r.quantity_sqm)} SQM) has been unsold for ${days} days`,
          entity_type: 'inventory', entity_id: r.id,
        })
      }
    }
  }

  // 2. Low stock (product below min_stock_level)
  const stockByProduct = {}
  for (const r of inventory || []) {
    if (r.status !== 'available') continue
    const pid = r.product_id
    if (!stockByProduct[pid]) stockByProduct[pid] = { product: r.products, total: 0 }
    stockByProduct[pid].total += Number(r.quantity_sqm) - Number(r.reserved_sqm || 0)
  }
  for (const [pid, v] of Object.entries(stockByProduct)) {
    const minLevel = Number(v.product?.min_stock_level || 0)
    if (minLevel > 0 && v.total < minLevel) {
      alerts.push({
        type: 'auto', severity: 'warning',
        message: `${v.product?.name} stock is low: ${Math.round(v.total)} SQM available (reorder level ${minLevel})`,
        entity_type: 'products', entity_id: pid,
      })
    }
  }

  // 3. Delayed shipments (ETA passed, not delivered/arrived/cancelled)
  const { data: shipments } = await db.from('shipments').select('*, customers(company_name)')
  for (const s of shipments || []) {
    if (!s.eta) continue
    const eta = new Date(s.eta)
    if (eta < now && !['delivered', 'arrived', 'cancelled'].includes(s.status)) {
      const overdueDays = Math.floor((now - eta) / 86400000)
      alerts.push({
        type: 'auto', severity: 'danger',
        message: `Container ${s.container_number || s.shipment_id} is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue (ETA ${s.eta})`,
        entity_type: 'shipments', entity_id: s.id,
      })
    }
    // Arriving this week
    if (eta >= now) {
      const daysUntil = Math.floor((eta - now) / 86400000)
      if (daysUntil <= 7 && s.status === 'in_transit') {
        alerts.push({
          type: 'auto', severity: 'info',
          message: `Container ${s.container_number || s.shipment_id} arriving in ${daysUntil} day${daysUntil !== 1 ? 's' : ''} (${s.customers?.company_name || ''})`,
          entity_type: 'shipments', entity_id: s.id,
        })
      }
    }
  }

  // 4. Overdue invoices
  const { data: invoices } = await db.from('invoices').select('*, customers(company_name,currency)')
  for (const inv of invoices || []) {
    if (!inv.due_date || inv.status === 'paid') continue
    const outstandingAmt = Number(inv.amount) - Number(inv.amount_paid)
    if (outstandingAmt <= 0) continue
    const due = new Date(inv.due_date)
    if (due < now) {
      const overdueDays = Math.floor((now - due) / 86400000)
      const cur = inv.customers?.currency || inv.currency || 'GBP'
      const fmtAmt = new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(outstandingAmt)
      alerts.push({
        type: 'auto', severity: 'danger',
        message: `Invoice ${inv.invoice_number} (${inv.customers?.company_name}) is ${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue \u2014 ${fmtAmt}`,
        entity_type: 'invoices', entity_id: inv.id,
      })
    }
  }

  // 5. Best margin insight (only if we have sold/delivered stock)
  const soldInv = (inventory || []).filter(r => ['sold', 'delivered'].includes(r.status))
  if (soldInv.length > 0) {
    const byProd = {}
    for (const r of soldInv) {
      const name = r.products?.name || 'Unknown'
      if (!byProd[name]) byProd[name] = { revenue: 0, cost: 0 }
      byProd[name].revenue += Number(r.quantity_sqm) * Number(r.selling_price_sqm)
      byProd[name].cost += Number(r.total_landed_cost)
    }
    const ranked = Object.entries(byProd).map(([n, v]) => ({
      name: n, margin: v.revenue > 0 ? ((v.revenue - v.cost) / v.revenue) * 100 : 0,
    })).sort((a, b) => b.margin - a.margin)
    if (ranked[0] && ranked[0].margin > 0) {
      alerts.push({
        type: 'auto', severity: 'info',
        message: `${ranked[0].name} generated the highest gross margin (${ranked[0].margin.toFixed(1)}%)`,
      })
    }
  }

  if (alerts.length > 0) await db.from('alerts').insert(alerts)
  return json({ ok: true, generated: alerts.length })
}

// ============ EXCEL PREVIEW (with per-row duplicate detection) ============
async function excelPreview(request) {
  const form = await request.formData()
  const file = form.get('file')
  const mapping = JSON.parse(form.get('mapping') || '{}')
  const sheet_name = form.get('sheet_name')
  if (!(file instanceof File)) return err('No file uploaded')
  const db = supabaseAdmin()

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[sheet_name || wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

  const { data: products } = await db.from('products').select('id,sku,name')
  const { data: existingInv } = await db.from('inventory').select('id,stock_id,batch_lot,product_id,quantity_sqm')
  const productsBySku = Object.fromEntries((products || []).map(p => [p.sku.toLowerCase(), p]))
  const productsByName = Object.fromEntries((products || []).map(p => [p.name.toLowerCase(), p]))
  const existingByKey = {}
  for (const i of (existingInv || [])) existingByKey[`${i.product_id}||${i.batch_lot || ''}`] = i

  const preview = rows.map((row, idx) => {
    const c = {}
    for (const [excelH, canon] of Object.entries(mapping)) if (canon) c[canon] = row[excelH]
    let product = null
    if (c.sku) product = productsBySku[String(c.sku).toLowerCase()]
    if (!product && c.product_name) product = productsByName[String(c.product_name).toLowerCase()]

    const errors = []
    const qty = Number(c.quantity_sqm)
    if (!qty || qty <= 0) errors.push('Missing or invalid quantity')
    if (!product && !c.sku && !c.product_name) errors.push('Missing product')

    let duplicate = null
    if (product && c.batch_lot) {
      const existing = existingByKey[`${product.id}||${c.batch_lot}`]
      if (existing) duplicate = existing
    }

    return {
      row_number: idx + 1,
      raw: row, canonical: c,
      product_matched: product ? { id: product.id, sku: product.sku, name: product.name } : null,
      product_will_be_created: !product && (c.sku || c.product_name) ? true : false,
      duplicate, errors,
      status: errors.length > 0 ? 'error' : duplicate ? 'duplicate' : 'ready',
      // default action for duplicates
      default_action: duplicate ? 'skip' : (errors.length > 0 ? 'skip' : 'create'),
    }
  })

  const summary = {
    total: preview.length,
    ready: preview.filter(p => p.status === 'ready').length,
    duplicates: preview.filter(p => p.status === 'duplicate').length,
    errors: preview.filter(p => p.status === 'error').length,
  }

  return json({ preview, summary })
}

// ============ EXCEL COMMIT (import with per-row actions) ============
async function excelCommit(request) {
  const form = await request.formData()
  const file = form.get('file')
  const mapping = JSON.parse(form.get('mapping') || '{}')
  const actions = JSON.parse(form.get('actions') || '{}') // { row_number: 'skip'|'create'|'update' }
  const sheet_name = form.get('sheet_name')
  if (!(file instanceof File)) return err('No file uploaded')
  const db = supabaseAdmin()

  const buf = Buffer.from(await file.arrayBuffer())
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[sheet_name || wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false })

  const { data: batch } = await db.from('import_batches').insert({
    file_name: file.name, batch_type: 'stock', total_rows: rows.length, status: 'processing',
  }).select().single()

  const { data: products } = await db.from('products').select('id,sku,name,standard_selling_price')
  const { data: suppliers } = await db.from('suppliers').select('id,code,name')
  const { data: existingInv } = await db.from('inventory').select('id,stock_id,batch_lot,product_id')
  const { data: whs } = await db.from('warehouses').select('id,code').limit(1)
  const warehouse = whs[0]

  const productsBySku = Object.fromEntries((products || []).map(p => [p.sku.toLowerCase(), p]))
  const productsByName = Object.fromEntries((products || []).map(p => [p.name.toLowerCase(), p]))
  const supplierByCode = Object.fromEntries((suppliers || []).map(s => [s.code.toLowerCase(), s]))
  const supplierByName = Object.fromEntries((suppliers || []).map(s => [s.name.toLowerCase(), s]))
  const existingByKey = {}
  for (const i of (existingInv || [])) existingByKey[`${i.product_id}||${i.batch_lot || ''}`] = i

  let stockCounter = (existingInv?.length || 0) + 1
  let success = 0, skipped = 0, updated = 0, failed = 0
  const errList = []

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx]
    const action = actions[String(idx + 1)] || 'create'
    if (action === 'skip') { skipped++; continue }

    try {
      const c = {}
      for (const [excelH, canon] of Object.entries(mapping)) if (canon) c[canon] = row[excelH]

      let product = null
      if (c.sku) product = productsBySku[String(c.sku).toLowerCase()]
      if (!product && c.product_name) product = productsByName[String(c.product_name).toLowerCase()]
      if (!product) {
        const sku = c.sku ? String(c.sku) : String(c.product_name).slice(0, 40).replace(/\s+/g, '-').toUpperCase()
        const name = c.product_name || c.sku
        if (!name) throw new Error('Missing product name/SKU')
        const { data: newP } = await db.from('products').insert({
          sku, name, category: c.category || null, colour: c.colour || null,
          finish: c.finish || null, size: c.size || null,
        }).select().single()
        product = newP; productsBySku[sku.toLowerCase()] = newP
      }

      let supplier_id = null
      if (c.supplier_code) {
        const s = supplierByCode[String(c.supplier_code).toLowerCase()] || supplierByName[String(c.supplier_code).toLowerCase()]
        if (s) supplier_id = s.id
        else {
          const code = 'SUP-' + Date.now().toString(36).toUpperCase().slice(-6)
          const { data: newS } = await db.from('suppliers').insert({ code, name: String(c.supplier_code) }).select().single()
          supplier_id = newS.id; supplierByCode[code.toLowerCase()] = newS
        }
      }

      const qtySqm = Number(c.quantity_sqm) || 0
      if (qtySqm <= 0) throw new Error('Quantity missing/invalid')

      const source = (c.source || (supplier_id ? 'outsourced' : 'own_production')).toString().toLowerCase().replace(/\s+/g, '_')
      const validSource = ['own_production', 'outsourced'].includes(source) ? source : (supplier_id ? 'outsourced' : 'own_production')
      const status = (c.status || 'available').toString().toLowerCase().replace(/\s+/g, '_')
      const validStatus = ['available', 'reserved', 'sold', 'delivered', 'damaged', 'in_transit', 'outsourced', 'on_hold'].includes(status) ? status : 'available'

      const payload = {
        product_id: product.id, warehouse_id: warehouse.id, batch_lot: c.batch_lot || null,
        quantity_sqm: qtySqm, pallets: Number(c.pallets) || 0, weight_mt: Number(c.weight_mt) || 0,
        source: validSource, supplier_id,
        supplier_cost: Number(c.supplier_cost) || 0,
        supplier_invoice_number: c.supplier_invoice_number || null,
        freight_cost: Number(c.freight_cost) || 0, duty_tax: Number(c.duty_tax) || 0,
        handling_cost: Number(c.handling_cost) || 0,
        selling_price_sqm: Number(c.selling_price_sqm) || Number(product.standard_selling_price) || 0,
        status: validStatus, notes: c.notes || null,
      }

      if (action === 'update') {
        const existing = existingByKey[`${product.id}||${c.batch_lot || ''}`]
        if (existing) {
          const { error: uErr } = await db.from('inventory').update({ ...payload, updated_at: new Date() }).eq('id', existing.id)
          if (uErr) throw new Error(uErr.message)
          updated++
          await db.from('import_rows').insert({ batch_id: batch.id, row_number: idx + 1, raw_data: row, status: 'updated' })
        } else {
          throw new Error('No existing record to update')
        }
      } else {
        const stock_id = 'STK-' + String(stockCounter++).padStart(5, '0')
        const { error: iErr } = await db.from('inventory').insert({ ...payload, stock_id })
        if (iErr) throw new Error(iErr.message)
        success++
        await db.from('import_rows').insert({ batch_id: batch.id, row_number: idx + 1, raw_data: row, status: 'success' })
      }
    } catch (e) {
      failed++
      errList.push({ row: idx + 1, error: e.message })
      await db.from('import_rows').insert({ batch_id: batch.id, row_number: idx + 1, raw_data: row, status: 'failed', error_message: e.message })
    }
  }

  await db.from('import_batches').update({
    status: 'completed', success_rows: success, failed_rows: failed, duplicate_rows: skipped,
  }).eq('id', batch.id)

  return json({ ok: true, batch_id: batch.id, total: rows.length, created: success, updated, skipped, failed, errors: errList.slice(0, 20) })
}

// ============ MAIN HANDLER ============
async function handleRoute(request, { params }) {
  const p = await params
  const path = p.path || []
  const method = request.method
  const url = new URL(request.url)

  try {
    // Health / setup
    if (path[0] === 'health') return await health()
    if (path[0] === 'seed' && method === 'POST') {
      if (path[1] === 'wipe') return await wipeDemo()
      return await seed()
    }
    if (path[0] === 'dashboard') return await dashboard()

    // Excel
    if (path[0] === 'excel') {
      if (path[1] === 'detect' && method === 'POST') return await excelDetect(request)
      if (path[1] === 'preview' && method === 'POST') return await excelPreview(request)
      if (path[1] === 'commit' && method === 'POST') return await excelCommit(request)
      if (path[1] === 'import' && method === 'POST') return await excelImport(request)
      if (path[1] === 'export' && method === 'GET') return await excelExport(path[2] || 'stock')
      if (path[1] === 'template' && method === 'GET') return await excelTemplate(path[2] || 'stock')
    }

    // Sales order wizard
    if (path[0] === 'sales-order' && method === 'POST') {
      const body = await request.json()
      return await createSalesOrder(body)
    }

    // Insights recompute
    if (path[0] === 'insights' && path[1] === 'recompute' && method === 'POST') {
      return await recomputeInsights()
    }

    // Inventory actions
    if (path[0] === 'inventory' && path[2] === 'reserve' && method === 'POST') {
      const body = await request.json()
      return await reserveInventory(path[1], body.quantity_sqm, body.customer_id, body.sales_order_id)
    }
    if (path[0] === 'inventory' && path[2] === 'adjust' && method === 'POST') {
      const body = await request.json()
      return await adjustInventory(path[1], body.quantity_sqm, body.reason)
    }

    // Global search
    if (path[0] === 'search' && method === 'GET') {
      const q = url.searchParams.get('q')?.trim()
      if (!q) return json({ results: [] })
      const db = supabaseAdmin()
      const like = `%${q}%`
      const [inv, ships, sos, invs, prods, custs] = await Promise.all([
        db.from('inventory').select('id,stock_id,batch_lot,products(name,sku)').or(`stock_id.ilike.${like},batch_lot.ilike.${like}`).limit(10),
        db.from('shipments').select('id,shipment_id,container_number,vessel').or(`shipment_id.ilike.${like},container_number.ilike.${like},vessel.ilike.${like}`).limit(10),
        db.from('sales_orders').select('id,order_number,customers(company_name)').ilike('order_number', like).limit(10),
        db.from('invoices').select('id,invoice_number,customers(company_name)').ilike('invoice_number', like).limit(10),
        db.from('products').select('id,sku,name').or(`sku.ilike.${like},name.ilike.${like}`).limit(10),
        db.from('customers').select('id,code,company_name').or(`code.ilike.${like},company_name.ilike.${like}`).limit(10),
      ])
      return json({
        inventory: inv.data || [], shipments: ships.data || [], sales_orders: sos.data || [],
        invoices: invs.data || [], products: prods.data || [], customers: custs.data || [],
      })
    }

    // Generic CRUD
    if (path.length >= 1 && ALLOWED.has(path[0])) {
      const resource = path[0]
      if (path.length === 1 && method === 'GET') return await listResource(resource, url)
      if (path.length === 1 && method === 'POST') { const body = await request.json(); return await createResource(resource, body) }
      if (path.length === 2 && method === 'GET') {
        const db = supabaseAdmin()
        const sel = SELECT_MAP[resource] || '*'
        const { data, error } = await db.from(resource).select(sel).eq('id', path[1]).single()
        if (error) return err(error.message)
        return json({ data })
      }
      if (path.length === 2 && (method === 'PATCH' || method === 'PUT')) { const body = await request.json(); return await updateResource(resource, path[1], body) }
      if (path.length === 2 && method === 'DELETE') return await deleteResource(resource, path[1])
    }

    return err(`Route /${path.join('/')} not found (${method})`, 404)
  } catch (e) {
    console.error('API Error:', e)
    return err(e.message || 'Internal server error', 500)
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const PATCH = handleRoute
export const DELETE = handleRoute
