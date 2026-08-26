'use client'
import { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  LayoutDashboard, Boxes, Ship, ShoppingCart, Factory, Users, Package,
  FileSpreadsheet, FileBarChart, Settings, Search, Upload, Download, Plus,
  AlertTriangle, TrendingUp, TrendingDown, Container as ContainerIcon, PoundSterling,
  CheckCircle2, Clock, ChevronRight, X, Filter, Database, Trash2, Sparkles,
  ArrowUpRight, ArrowDownRight, MapPin, Calendar, Building2, Truck,
} from 'lucide-react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stock', label: 'Stock Master', icon: Boxes },
  { id: 'shipments', label: 'Shipment Tracker', icon: Ship },
  { id: 'sales', label: 'Sales / Orders', icon: ShoppingCart },
  { id: 'suppliers', label: 'Suppliers', icon: Factory },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'excel', label: 'Excel Import', icon: FileSpreadsheet },
  { id: 'reports', label: 'Reports', icon: FileBarChart },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const fmt = (n, cur = 'GBP') => new Intl.NumberFormat('en-GB', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Number(n || 0))
const num = (n) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 }).format(Number(n || 0))
const numDec = (n) => new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(Number(n || 0))
const dateFmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const statusColor = (s) => ({
  available: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  reserved: 'bg-amber-100 text-amber-800 border-amber-200',
  sold: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-slate-200 text-slate-700 border-slate-300',
  in_transit: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  damaged: 'bg-red-100 text-red-800 border-red-200',
  outsourced: 'bg-purple-100 text-purple-800 border-purple-200',
  on_hold: 'bg-slate-100 text-slate-700 border-slate-200',
  planned: 'bg-slate-100 text-slate-700 border-slate-200',
  production: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ready: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  booked: 'bg-blue-100 text-blue-800 border-blue-200',
  loaded: 'bg-blue-100 text-blue-800 border-blue-200',
  departed: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  arrived: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  customs: 'bg-orange-100 text-orange-800 border-orange-200',
  delayed: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
  confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  processing: 'bg-blue-100 text-blue-800 border-blue-200',
  enquiry: 'bg-slate-100 text-slate-700 border-slate-200',
  quotation: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  partially_delivered: 'bg-amber-100 text-amber-800 border-amber-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-200',
  unpaid: 'bg-slate-200 text-slate-700 border-slate-300',
  overdue: 'bg-red-100 text-red-800 border-red-200',
}[s] || 'bg-slate-100 text-slate-700 border-slate-200')

function Badge({ children, className = '' }) {
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-md border ${className}`}>{children}</span>
}

function StatusBadge({ status }) {
  return <Badge className={statusColor(status)}>{String(status || '').replace(/_/g, ' ')}</Badge>
}

function Card({ children, className = '', onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md hover:border-slate-300 transition' : ''} ${className}`}
    >{children}</div>
  )
}

function KpiCard({ label, value, sub, icon: Icon, tone = 'slate', onClick, trend }) {
  const toneMap = {
    slate: 'bg-slate-50 text-slate-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    indigo: 'bg-indigo-50 text-indigo-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
  }
  return (
    <Card className="p-5" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{value}</div>
          {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
        </div>
        {Icon && <div className={`p-2 rounded-lg ${toneMap[tone]}`}><Icon className="w-5 h-5" /></div>}
      </div>
      {trend != null && (
        <div className={`text-xs mt-2 flex items-center gap-1 ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
          {Math.abs(trend).toFixed(1)}%
        </div>
      )}
    </Card>
  )
}

async function api(path, opts = {}) {
  const res = await fetch(`/api${path}`, { ...opts, headers: opts.body instanceof FormData ? undefined : { 'Content-Type': 'application/json', ...(opts.headers || {}) } })
  if (!res.ok) {
    const t = await res.text()
    try { const j = JSON.parse(t); throw new Error(j.error || 'API error') } catch (e) { throw new Error(t || 'API error') }
  }
  return res.json()
}

// ============ DASHBOARD ============
function Dashboard({ go, data }) {
  if (!data) return <div className="p-6">Loading dashboard…</div>
  const s = data.stock, sl = data.sales, p = data.profitability, sh = data.shipments, r = data.receivables
  const sourceData = [
    { name: 'Own Production', value: data.source_split.own },
    { name: 'Outsourced', value: data.source_split.outsourced },
  ]
  const COLORS = ['#0ea5e9', '#a855f7']
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Stock" value={`${num(s.total_sqm)} SQM`} sub={`${num(s.total_pallets)} pallets`} icon={Boxes} tone="slate" onClick={() => go('stock', {})} />
        <KpiCard label="Available" value={`${num(s.available_sqm)} SQM`} icon={CheckCircle2} tone="emerald" onClick={() => go('stock', { status: 'available' })} />
        <KpiCard label="Reserved" value={`${num(s.reserved_sqm)} SQM`} icon={Clock} tone="amber" onClick={() => go('stock', { status: 'reserved' })} />
        <KpiCard label="In Transit" value={`${num(s.in_transit_sqm)} SQM`} sub={`${sh.in_transit} containers`} icon={ContainerIcon} tone="indigo" onClick={() => go('stock', { status: 'in_transit' })} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Stock Value (Landed)" value={fmt(s.stock_value)} sub={`Potential: ${fmt(s.potential_value)}`} icon={PoundSterling} tone="blue" />
        <KpiCard label="Monthly Sales" value={fmt(sl.month)} sub={`Year: ${fmt(sl.year)}`} icon={TrendingUp} tone="emerald" onClick={() => go('sales', {})} />
        <KpiCard label="Gross Profit" value={fmt(p.gross_profit)} sub={`Margin ${numDec(p.gross_margin)}%`} icon={Sparkles} tone="purple" />
        <KpiCard label="Outstanding" value={fmt(r.outstanding)} sub={`Overdue ${fmt(r.overdue)}`} icon={AlertTriangle} tone="red" onClick={() => go('sales', { view: 'invoices' })} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <Card className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Sales Trend — Last 6 Months</h3>
            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Auto-calculated from Sales Orders</Badge>
          </div>
          <div style={{ height: 280 }}>
            <ResponsiveContainer>
              <LineChart data={sl.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Line type="monotone" dataKey="sales" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-3">Stock Source</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={sourceData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} label={(e) => `${num(e.value)}`}>
                  {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Shipments</h3>
            <button onClick={() => go('shipments', {})} className="text-xs text-indigo-600 hover:underline">View all <ChevronRight className="inline w-3 h-3" /></button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { l: 'Production', v: sh.production, k: 'production' },
              { l: 'Ready', v: sh.ready, k: 'ready' },
              { l: 'In Transit', v: sh.in_transit, k: 'in_transit' },
              { l: 'Arriving This Week', v: sh.arriving_this_week, k: 'arriving' },
              { l: 'Delayed', v: sh.delayed, k: 'delayed', danger: true },
              { l: 'Delivered', v: sh.delivered, k: 'delivered' },
            ].map(x => (
              <div key={x.l} onClick={() => go('shipments', { status: x.k })} className={`p-3 rounded-lg border cursor-pointer hover:shadow-sm ${x.danger && x.v > 0 ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`text-2xl font-bold ${x.danger && x.v > 0 ? 'text-red-700' : 'text-slate-900'}`}>{x.v}</div>
                <div className="text-xs text-slate-600 mt-1">{x.l}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Receivables Ageing</h3>
          <div style={{ height: 200 }}>
            <ResponsiveContainer>
              <BarChart data={Object.entries(r.ageing).map(([k, v]) => ({ bucket: k, amount: Math.round(v) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bucket" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} tickFormatter={(v) => `£${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => fmt(v)} />
                <Bar dataKey="amount" fill="#f59e0b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4">Top Products by Stock Value</h3>
          <div className="space-y-2">
            {data.top_products.map(p => (
              <div key={p.name} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0 border-slate-100">
                <div className="flex-1 truncate pr-3 text-slate-700">{p.name}</div>
                <div className="text-slate-500 mr-4">{num(p.sqm)} SQM</div>
                <div className="font-semibold text-slate-900 w-24 text-right">{fmt(p.value)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-500" /> Management Insights</h3>
          <div className="space-y-2">
            {data.alerts.length === 0 && <div className="text-sm text-slate-500">No alerts</div>}
            {data.alerts.map(a => {
              const clickable = a.entity_type && a.entity_id
              const target = a.entity_type === 'shipments' ? 'shipments' : a.entity_type === 'invoices' ? 'sales' : a.entity_type === 'inventory' ? 'stock' : a.entity_type === 'products' ? 'products' : null
              return (
                <div
                  key={a.id}
                  onClick={() => clickable && target && go(target, { highlight_id: a.entity_id, entity_type: a.entity_type })}
                  className={`p-3 rounded-lg text-sm border-l-4 flex items-center justify-between gap-2 ${clickable ? 'cursor-pointer hover:shadow-sm transition' : ''} ${a.severity === 'danger' ? 'bg-red-50 border-red-400 text-red-800' : a.severity === 'warning' ? 'bg-amber-50 border-amber-400 text-amber-800' : 'bg-indigo-50 border-indigo-400 text-indigo-800'}`}
                >
                  <span className="flex-1">{a.message}</span>
                  {clickable && target && <ChevronRight className="w-4 h-4 opacity-60" />}
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}

// ============ STOCK MASTER ============
function StockMaster({ initialFilter, refresh }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(initialFilter?.status || 'all')
  const [source, setSource] = useState('all')
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (status !== 'all') q.set('status', status)
      if (source !== 'all') q.set('source', source)
      const { data } = await api(`/inventory?${q}`)
      setRows(data)
      // auto-open drill-down if requested
      if (initialFilter?.highlight_id && initialFilter?.entity_type === 'inventory') {
        const found = data.find(r => r.id === initialFilter.highlight_id)
        if (found) setSelected(found)
      }
    } catch (e) { toast.error(e.message) }
    setLoading(false)
  }
  useEffect(() => { load() }, [status, source, refresh])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  const totalSqm = filtered.reduce((a, r) => a + Number(r.quantity_sqm || 0), 0)
  const totalValue = filtered.reduce((a, r) => a + Number(r.total_landed_cost || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Stock Master</h2>
          <p className="text-sm text-slate-500">{num(filtered.length)} records · {num(totalSqm)} SQM · {fmt(totalValue)} landed value</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowAdd(true)} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"><Plus className="w-4 h-4" /> Add Stock</button>
          <a href="/api/excel/export/stock" className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" /> Export Excel</a>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search stock ID, batch, product, supplier…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="all">All Status</option>
            {['available', 'reserved', 'sold', 'delivered', 'in_transit', 'damaged', 'on_hold'].map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="px-3 py-2 text-sm border border-slate-300 rounded-lg">
            <option value="all">All Sources</option>
            <option value="own_production">Own Production</option>
            <option value="outsourced">Outsourced</option>
          </select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                {['Stock ID', 'Date', 'Product', 'Batch', 'SQM', 'Reserved', 'Pallets', 'Source', 'Supplier', 'Landed', '£/SQM', 'Sell/SQM', 'Status'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={13} className="px-3 py-10 text-center text-slate-500">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={13} className="px-3 py-10 text-center text-slate-500">No stock records</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} onClick={() => setSelected(r)} className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer">
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-700">{r.stock_id}</td>
                  <td className="px-3 py-2.5 text-slate-600">{dateFmt(r.date_added)}</td>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-slate-900">{r.products?.name}</div>
                    <div className="text-xs text-slate-500">{r.products?.sku} · {r.products?.colour} · {r.products?.size}</div>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{r.batch_lot || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-900 font-semibold">{num(r.quantity_sqm)}</td>
                  <td className="px-3 py-2.5 text-amber-700">{num(r.reserved_sqm)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{r.pallets || 0}</td>
                  <td className="px-3 py-2.5"><Badge className={r.source === 'own_production' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-purple-50 text-purple-700 border-purple-200'}>{r.source === 'own_production' ? 'Own' : 'Outsourced'}</Badge></td>
                  <td className="px-3 py-2.5 text-slate-600 truncate max-w-[140px]">{r.suppliers?.name || '—'}</td>
                  <td className="px-3 py-2.5 text-slate-900">{fmt(r.total_landed_cost)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{numDec(r.cost_per_sqm)}</td>
                  <td className="px-3 py-2.5 text-slate-600">{numDec(r.selling_price_sqm)}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && <StockDetail row={selected} onClose={() => setSelected(null)} onChange={load} />}
      {showAdd && <AddResourceModal resource="inventory" onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load() }} />}
    </div>
  )
}

function StockDetail({ row, onClose, onChange }) {
  const [reserving, setReserving] = useState(false)
  const [qty, setQty] = useState('')
  const [adjustQty, setAdjustQty] = useState('')
  const [movements, setMovements] = useState([])

  useEffect(() => {
    api(`/inventory_movements?`).then(({ data }) => {
      setMovements((data || []).filter(m => m.inventory_id === row.id).slice(0, 20))
    })
  }, [row.id])

  const doReserve = async () => {
    if (!qty || Number(qty) <= 0) return toast.error('Enter quantity')
    try {
      await api(`/inventory/${row.id}/reserve`, { method: 'POST', body: JSON.stringify({ quantity_sqm: Number(qty) }) })
      toast.success('Reserved')
      setReserving(false); setQty(''); onChange()
    } catch (e) { toast.error(e.message) }
  }
  const doAdjust = async () => {
    if (!adjustQty) return toast.error('Enter new quantity')
    try {
      await api(`/inventory/${row.id}/adjust`, { method: 'POST', body: JSON.stringify({ quantity_sqm: Number(adjustQty), reason: 'Manual adjustment' }) })
      toast.success('Adjusted'); setAdjustQty(''); onChange()
    } catch (e) { toast.error(e.message) }
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/40" />
      <div className="relative w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-slate-500">{row.stock_id}</div>
            <div className="text-lg font-bold text-slate-900">{row.products?.name}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-3">
            {[
              ['SKU', row.products?.sku], ['Size', row.products?.size], ['Finish', row.products?.finish],
              ['Colour', row.products?.colour], ['Batch/Lot', row.batch_lot], ['Source', row.source],
              ['Quantity SQM', num(row.quantity_sqm)], ['Reserved SQM', num(row.reserved_sqm)],
              ['Pallets', row.pallets], ['Weight MT', row.weight_mt],
              ['Supplier', row.suppliers?.name], ['Customer', row.customers?.company_name],
            ].map(([k, v]) => (
              <div key={k} className="text-sm"><div className="text-xs text-slate-500">{k}</div><div className="font-medium text-slate-900">{v || '—'}</div></div>
            ))}
          </div>

          <Card className="p-4 bg-slate-50 border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Cost Breakdown</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Supplier Cost: <span className="font-semibold">{fmt(row.supplier_cost)}</span></div>
              <div>Production: <span className="font-semibold">{fmt(row.production_cost)}</span></div>
              <div>Freight: <span className="font-semibold">{fmt(row.freight_cost)}</span></div>
              <div>Duty/Tax: <span className="font-semibold">{fmt(row.duty_tax)}</span></div>
              <div>Handling: <span className="font-semibold">{fmt(row.handling_cost)}</span></div>
              <div>Other: <span className="font-semibold">{fmt(row.other_costs)}</span></div>
              <div className="col-span-2 pt-2 border-t border-slate-300 mt-1">Total Landed: <span className="font-bold text-slate-900">{fmt(row.total_landed_cost)}</span> · Cost/SQM: <span className="font-bold">{numDec(row.cost_per_sqm)}</span></div>
            </div>
          </Card>

          <div className="flex gap-2">
            <button onClick={() => setReserving(!reserving)} className="flex-1 px-3 py-2 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600">Reserve Stock</button>
            <button onClick={() => setAdjustQty(String(row.quantity_sqm))} className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50">Adjust Qty</button>
          </div>
          {reserving && (
            <div className="flex gap-2">
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="SQM to reserve" className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <button onClick={doReserve} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Confirm</button>
            </div>
          )}
          {adjustQty !== '' && (
            <div className="flex gap-2">
              <input type="number" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              <button onClick={doAdjust} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg">Save</button>
            </div>
          )}

          <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Stock Movement History</h4>
            <div className="space-y-1">
              {movements.map(m => (
                <div key={m.id} className="text-xs p-2 bg-slate-50 rounded flex justify-between">
                  <span className="font-medium">{m.movement_type}</span>
                  <span className="text-slate-600">{num(m.quantity_sqm)} SQM</span>
                  <span className="text-slate-500">{dateFmt(m.created_at)}</span>
                </div>
              ))}
              {movements.length === 0 && <div className="text-xs text-slate-500">No movements yet</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============ EXCEL IMPORT ============
function ExcelImport({ onImported }) {
  const [file, setFile] = useState(null)
  const [detected, setDetected] = useState(null)
  const [sheetIdx, setSheetIdx] = useState(0)
  const [mapping, setMapping] = useState({})
  const [preview, setPreview] = useState(null)
  const [actions, setActions] = useState({})
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)
  const [templates, setTemplates] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [showSaveTpl, setShowSaveTpl] = useState(false)
  const inputRef = useRef()

  const CANONICAL_FIELDS = ['sku', 'product_name', 'category', 'colour', 'finish', 'size', 'batch_lot', 'quantity_sqm', 'pallets', 'weight_mt', 'source', 'supplier_code', 'supplier_cost', 'supplier_invoice_number', 'freight_cost', 'duty_tax', 'handling_cost', 'selling_price_sqm', 'status', 'customer_code', 'warehouse_location', 'notes']

  // Load templates from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('arvicon_mapping_templates') || '[]')
      setTemplates(stored)
    } catch (e) { setTemplates([]) }
  }, [])

  const saveTemplate = () => {
    if (!templateName.trim()) return toast.error('Template name required')
    const existing = templates.filter(t => t.name !== templateName)
    const newList = [...existing, { name: templateName, mapping, created_at: new Date().toISOString() }]
    localStorage.setItem('arvicon_mapping_templates', JSON.stringify(newList))
    setTemplates(newList)
    setShowSaveTpl(false); setTemplateName('')
    toast.success(`Template "${templateName}" saved`)
  }
  const loadTemplate = (name) => {
    const t = templates.find(x => x.name === name)
    if (!t) return
    setMapping(t.mapping)
    toast.success(`Applied template "${name}"`)
  }
  const deleteTemplate = (name) => {
    const newList = templates.filter(t => t.name !== name)
    localStorage.setItem('arvicon_mapping_templates', JSON.stringify(newList))
    setTemplates(newList)
    toast.success(`Deleted template "${name}"`)
  }

  const onUpload = async (f) => {
    setFile(f); setDetected(null); setResult(null); setPreview(null); setActions({})
    const fd = new FormData(); fd.append('file', f)
    try {
      const res = await api('/excel/detect', { method: 'POST', body: fd })
      setDetected(res); setSheetIdx(0)
      setMapping(res.sheets[0].detected_mapping)
      toast.success(`Detected ${res.sheets.length} sheet(s)`)
    } catch (e) { toast.error(e.message) }
  }

  const doPreview = async () => {
    if (!file || !detected) return
    const fd = new FormData()
    fd.append('file', file); fd.append('mapping', JSON.stringify(mapping))
    fd.append('sheet_name', detected.sheets[sheetIdx].name)
    try {
      const res = await api('/excel/preview', { method: 'POST', body: fd })
      setPreview(res)
      const initActions = {}
      for (const r of res.preview) initActions[String(r.row_number)] = r.default_action
      setActions(initActions)
      toast.success(`${res.summary.ready} ready · ${res.summary.duplicates} duplicates · ${res.summary.errors} errors`)
    } catch (e) { toast.error(e.message) }
  }

  const doCommit = async () => {
    if (!file || !preview) return
    setImporting(true)
    const fd = new FormData()
    fd.append('file', file); fd.append('mapping', JSON.stringify(mapping))
    fd.append('sheet_name', detected.sheets[sheetIdx].name)
    fd.append('actions', JSON.stringify(actions))
    try {
      const res = await api('/excel/commit', { method: 'POST', body: fd })
      setResult(res)
      toast.success(`Created ${res.created} · Updated ${res.updated} · Skipped ${res.skipped}`)
      onImported?.()
    } catch (e) { toast.error(e.message) }
    setImporting(false)
  }

  const setAllDuplicates = (action) => {
    const n = { ...actions }
    for (const r of preview.preview) if (r.status === 'duplicate') n[String(r.row_number)] = action
    setActions(n)
  }

  const currentSheet = detected?.sheets[sheetIdx]

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Excel Import Center</h2>
        <p className="text-sm text-slate-500">Upload → Detect → Map → Preview → Validate → Confirm → Import</p>
      </div>

      <div className="flex gap-2">
        <a href="/api/excel/template/stock" className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Stock Template</a>
        <a href="/api/excel/template/shipment" className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Shipment Template</a>
        <a href="/api/excel/template/sales" className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-1.5"><Download className="w-3.5 h-3.5" /> Sales Template</a>
      </div>

      {!detected && (
        <Card className="p-10 border-dashed border-2">
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => e.target.files[0] && onUpload(e.target.files[0])} />
          <div className="text-center">
            <Upload className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <div className="text-slate-900 font-semibold">Drop your Excel file here</div>
            <div className="text-sm text-slate-500 mb-4">.xlsx, .xls or .csv — max 50MB</div>
            <button onClick={() => inputRef.current.click()} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">Choose File</button>
          </div>
        </Card>
      )}

      {detected && !preview && !result && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">{detected.file_name}</div>
                <div className="text-xs text-slate-500">{detected.sheets.length} sheet(s) · Auto-detected type: <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200">{currentSheet.detected_type}</Badge></div>
              </div>
              <button onClick={() => { setDetected(null); setFile(null) }} className="text-sm text-slate-500 hover:text-slate-900">× Cancel</button>
            </div>
            {detected.sheets.length > 1 && (
              <div className="mt-3 flex gap-2">
                {detected.sheets.map((s, i) => (
                  <button key={i} onClick={() => { setSheetIdx(i); setMapping(s.detected_mapping) }} className={`px-3 py-1.5 text-sm rounded-lg ${i === sheetIdx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>{s.name} ({s.row_count})</button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-900">Column Mapping ({currentSheet.row_count} rows)</h3>
              <div className="flex items-center gap-2">
                {templates.length > 0 && (
                  <select onChange={(e) => e.target.value && loadTemplate(e.target.value)} defaultValue="" className="text-xs px-2 py-1 border border-slate-300 rounded">
                    <option value="">Load Template…</option>
                    {templates.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                )}
                <button onClick={() => setShowSaveTpl(!showSaveTpl)} className="text-xs px-2 py-1 bg-slate-100 border border-slate-200 rounded hover:bg-slate-200">💾 Save as Template</button>
              </div>
            </div>
            {showSaveTpl && (
              <div className="mb-3 p-3 bg-indigo-50 rounded flex gap-2 items-center">
                <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Template name (e.g. Weekly Kandla Import)" className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded" />
                <button onClick={saveTemplate} className="px-3 py-1 text-sm bg-indigo-600 text-white rounded">Save</button>
                <button onClick={() => setShowSaveTpl(false)} className="px-2 py-1 text-sm text-slate-500">Cancel</button>
              </div>
            )}
            {templates.length > 0 && (
              <div className="mb-3 flex gap-1 flex-wrap">
                {templates.map(t => (
                  <div key={t.name} className="text-xs px-2 py-1 bg-slate-100 rounded flex items-center gap-1">
                    <button onClick={() => loadTemplate(t.name)} className="hover:underline">{t.name}</button>
                    <button onClick={() => deleteTemplate(t.name)} className="text-red-500 hover:text-red-700 ml-1">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {currentSheet.headers.map(h => (
                <div key={h} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 truncate px-2 py-1.5 bg-slate-100 rounded font-mono text-xs">{h}</div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                  <select value={mapping[h] || ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })} className="flex-1 px-2 py-1.5 text-xs border border-slate-300 rounded">
                    <option value="">-- Skip --</option>
                    {CANONICAL_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-slate-900 mb-3">Data Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead className="bg-slate-50">
                  <tr>{currentSheet.headers.map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-slate-600">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {currentSheet.sample.map((r, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      {currentSheet.headers.map(h => <td key={h} className="px-2 py-1.5 text-slate-700">{String(r[h] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <button onClick={doPreview} className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold">
            Preview & Validate ({currentSheet.row_count} rows)
          </button>
        </div>
      )}

      {preview && !result && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex items-center gap-4 justify-between flex-wrap">
              <div className="flex gap-4">
                <div><div className="text-2xl font-bold">{preview.summary.total}</div><div className="text-xs text-slate-500">Total</div></div>
                <div><div className="text-2xl font-bold text-emerald-700">{preview.summary.ready}</div><div className="text-xs text-emerald-600">Ready</div></div>
                <div><div className="text-2xl font-bold text-amber-700">{preview.summary.duplicates}</div><div className="text-xs text-amber-600">Duplicates</div></div>
                <div><div className="text-2xl font-bold text-red-700">{preview.summary.errors}</div><div className="text-xs text-red-600">Errors</div></div>
              </div>
              {preview.summary.duplicates > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500">All duplicates:</span>
                  <button onClick={() => setAllDuplicates('skip')} className="px-2 py-1 bg-slate-100 rounded hover:bg-slate-200">Skip</button>
                  <button onClick={() => setAllDuplicates('update')} className="px-2 py-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200">Update Existing</button>
                  <button onClick={() => setAllDuplicates('create')} className="px-2 py-1 bg-emerald-100 text-emerald-800 rounded hover:bg-emerald-200">Create New</button>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    <th className="px-2 py-2 text-left">Status</th>
                    <th className="px-2 py-2 text-left">Product</th>
                    <th className="px-2 py-2 text-left">Batch</th>
                    <th className="px-2 py-2 text-right">SQM</th>
                    <th className="px-2 py-2 text-left">Notes</th>
                    <th className="px-2 py-2 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map(r => (
                    <tr key={r.row_number} className={`border-t border-slate-100 ${r.status === 'error' ? 'bg-red-50' : r.status === 'duplicate' ? 'bg-amber-50' : ''}`}>
                      <td className="px-2 py-2 text-slate-500">{r.row_number}</td>
                      <td className="px-2 py-2">
                        {r.status === 'ready' && <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Ready</Badge>}
                        {r.status === 'duplicate' && <Badge className="bg-amber-100 text-amber-800 border-amber-200">Duplicate</Badge>}
                        {r.status === 'error' && <Badge className="bg-red-100 text-red-800 border-red-200">Error</Badge>}
                      </td>
                      <td className="px-2 py-2">
                        {r.product_matched ? <span className="font-medium">{r.product_matched.name}</span> : r.product_will_be_created ? <span className="text-indigo-700">Will create: {r.canonical.sku || r.canonical.product_name}</span> : <span className="text-red-600">Not found</span>}
                      </td>
                      <td className="px-2 py-2 font-mono">{r.canonical.batch_lot || '—'}</td>
                      <td className="px-2 py-2 text-right">{r.canonical.quantity_sqm || '—'}</td>
                      <td className="px-2 py-2 text-slate-600">
                        {r.errors.length > 0 && <span className="text-red-600">{r.errors.join('; ')}</span>}
                        {r.duplicate && <span className="text-amber-700">Duplicate of {r.duplicate.stock_id} ({r.duplicate.quantity_sqm} SQM)</span>}
                      </td>
                      <td className="px-2 py-2">
                        {r.status === 'error' ? <span className="text-slate-400">Skip</span> : (
                          <select value={actions[String(r.row_number)] || 'create'} onChange={(e) => setActions({ ...actions, [String(r.row_number)]: e.target.value })} className="text-xs px-1.5 py-0.5 border border-slate-300 rounded">
                            <option value="skip">Skip</option>
                            <option value="create">Create New</option>
                            {r.duplicate && <option value="update">Update Existing</option>}
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex gap-2">
            <button onClick={() => setPreview(null)} className="px-4 py-3 bg-white border border-slate-300 rounded-lg">← Back to Mapping</button>
            <button onClick={doCommit} disabled={importing} className="flex-1 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
              {importing ? 'Importing…' : `Confirm Import (${Object.values(actions).filter(a => a !== 'skip').length} rows)`}
            </button>
          </div>
        </div>
      )}

      {result && (
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div>
              <div className="text-lg font-bold text-slate-900">Import Complete</div>
              <div className="text-sm text-slate-500">Batch ID: {result.batch_id}</div>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3">
            <div className="p-3 bg-slate-50 rounded"><div className="text-2xl font-bold">{result.total}</div><div className="text-xs text-slate-500">Total</div></div>
            <div className="p-3 bg-emerald-50 rounded"><div className="text-2xl font-bold text-emerald-700">{result.created}</div><div className="text-xs text-emerald-600">Created</div></div>
            <div className="p-3 bg-blue-50 rounded"><div className="text-2xl font-bold text-blue-700">{result.updated || 0}</div><div className="text-xs text-blue-600">Updated</div></div>
            <div className="p-3 bg-amber-50 rounded"><div className="text-2xl font-bold text-amber-700">{result.skipped || 0}</div><div className="text-xs text-amber-600">Skipped</div></div>
            <div className="p-3 bg-red-50 rounded"><div className="text-2xl font-bold text-red-700">{result.failed}</div><div className="text-xs text-red-600">Failed</div></div>
          </div>
          {result.errors?.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold text-slate-700 mb-2">Errors</h4>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {result.errors.map((e, i) => <div key={i} className="text-xs text-red-700 bg-red-50 p-2 rounded">Row {e.row}: {e.error}</div>)}
              </div>
            </div>
          )}
          <button onClick={() => { setDetected(null); setResult(null); setFile(null); setPreview(null); setActions({}) }} className="mt-4 px-4 py-2 text-sm bg-slate-100 rounded-lg hover:bg-slate-200">Import Another File</button>
        </Card>
      )}
    </div>
  )
}

// ============ GENERIC RESOURCE LIST (Products, Customers, Suppliers, Sales, Shipments) ============
function ResourceTable({ resource, columns, title, subtitle, filterField, exportPath, addable }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const reload = () => {
    setLoading(true)
    api(`/${resource}`).then(({ data }) => setRows(data)).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { reload() }, [resource])

  const filtered = useMemo(() => {
    if (!search) return rows
    const q = search.toLowerCase()
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(q))
  }, [rows, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">{filtered.length} record(s){subtitle && ` · ${subtitle}`}</p>
        </div>
        <div className="flex gap-2">
          {addable && <button onClick={() => setShowAdd(true)} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-1.5"><Plus className="w-4 h-4" /> New {RESOURCE_TITLES[addable] || 'Record'}</button>}
          {exportPath && <a href={`/api/excel/export/${exportPath}`} className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" /> Export</a>}
        </div>
      </div>
      <Card className="p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg" />
        </div>
      </Card>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>{columns.map(c => <th key={c.key} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">{c.label}</th>)}</tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">Loading…</td></tr>}
              {!loading && filtered.length === 0 && <tr><td colSpan={columns.length} className="px-3 py-10 text-center text-slate-500">No records</td></tr>}
              {filtered.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                  {columns.map(c => <td key={c.key} className="px-3 py-2.5">{c.render ? c.render(r) : r[c.key] || '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {showAdd && <AddResourceModal resource={addable} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); reload() }} />}
    </div>
  )
}

// ============ SETTINGS ============
function SettingsView({ health, onReload }) {
  const [seeding, setSeeding] = useState(false)
  const [wiping, setWiping] = useState(false)

  const [sql, setSql] = useState('')
  useEffect(() => { fetch('/schema.sql').then(r => r.text()).then(setSql).catch(() => {}) }, [])

  const seed = async () => {
    setSeeding(true)
    try { await api('/seed', { method: 'POST' }); toast.success('Demo data seeded'); onReload() } catch (e) { toast.error(e.message) }
    setSeeding(false)
  }
  const wipe = async () => {
    if (!confirm('Delete all DEMO data? Real data will be preserved.')) return
    setWiping(true)
    try { await api('/seed/wipe', { method: 'POST' }); toast.success('Demo data removed'); onReload() } catch (e) { toast.error(e.message) }
    setWiping(false)
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <h2 className="text-xl font-bold text-slate-900">Settings</h2>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Database Health</h3>
        <div className="space-y-1 text-sm">
          {health && Object.entries(health.tables).map(([t, s]) => (
            <div key={t} className="flex items-center justify-between">
              <span className="font-mono">{t}</span>
              {s.ok ? <span className="text-emerald-600">✓ {s.count} rows</span> : <span className="text-red-600">✗ {s.error}</span>}
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold text-slate-900 mb-3">Demo Data</h3>
        <p className="text-sm text-slate-500 mb-3">Seed realistic natural-stone demo (products, customers, suppliers, inventory, shipments, sales orders, invoices) or wipe existing demo records.</p>
        <div className="flex gap-2">
          <button onClick={seed} disabled={seeding} className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg disabled:opacity-50">{seeding ? 'Seeding…' : 'Seed Demo Data'}</button>
          <button onClick={wipe} disabled={wiping} className="px-4 py-2 text-sm bg-white border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50">{wiping ? 'Wiping…' : 'Delete Demo Data'}</button>
        </div>
      </Card>
    </div>
  )
}

// ============ SETUP (when schema missing) ============
function SetupScreen({ health, onRecheck }) {
  const [sql, setSql] = useState('')
  useEffect(() => { fetch('/schema.sql').then(r => r.text()).then(setSql).catch(() => setSql('-- schema not found')) }, [])
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full space-y-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-slate-900">Arvicon — One-time Setup</div>
          <p className="text-slate-500 mt-1">Run the SQL below in Supabase SQL Editor to create the schema.</p>
        </div>
        <Card className="p-5">
          <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700">
            <li>Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-indigo-600 underline">Supabase Dashboard</a></li>
            <li>Select your project → click <b>SQL Editor</b> in the left sidebar</li>
            <li>Click <b>New query</b>, paste the SQL below, and click <b>Run</b></li>
            <li>Come back here and click <b>Re-check</b></li>
          </ol>
        </Card>
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-200 bg-slate-50">
            <div className="text-sm font-semibold">supabase-schema.sql</div>
            <button onClick={() => { navigator.clipboard.writeText(sql); toast.success('SQL copied') }} className="text-xs px-3 py-1 bg-indigo-600 text-white rounded">Copy SQL</button>
          </div>
          <pre className="p-4 bg-slate-900 text-slate-100 text-xs overflow-auto max-h-96">{sql}</pre>
        </Card>
        <button onClick={onRecheck} className="w-full py-3 bg-emerald-600 text-white rounded-lg font-semibold">Re-check Database</button>
        {health && (
          <div className="text-xs text-slate-500 text-center">
            Missing tables: {Object.entries(health.tables).filter(([, v]) => !v.ok).map(([k]) => k).join(', ') || 'none'}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ SHIPMENT TIMELINE ============
const SHIP_STEPS = [
  { key: 'production', label: 'Production' },
  { key: 'ready', label: 'Ready' },
  { key: 'loaded', label: 'Loaded' },
  { key: 'departed', label: 'Departed' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'arrived', label: 'Arrived' },
  { key: 'delivered', label: 'Delivered' },
]
function ShipmentTimeline({ status, delayed, onStepClick, disabled }) {
  const currentIdx = SHIP_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-center w-full">
      {SHIP_STEPS.map((s, i) => {
        const done = i <= currentIdx
        const active = i === currentIdx
        const barDone = i < currentIdx
        const isClickable = onStepClick && !disabled && i !== currentIdx
        const isNext = i === currentIdx + 1
        return (
          <div key={s.key} className="flex-1 flex items-center min-w-0">
            <div className="flex flex-col items-center relative">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); isClickable && onStepClick(s.key) }}
                disabled={!isClickable}
                title={isClickable ? `Move to ${s.label}` : s.label}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2 transition
                  ${done ? (delayed && active ? 'bg-red-500 border-red-500 text-white' : active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-emerald-500 border-emerald-500 text-white') : 'bg-white border-slate-300 text-slate-400'}
                  ${isClickable ? 'cursor-pointer hover:scale-110 hover:shadow-md' : 'cursor-default'}
                  ${isNext && isClickable ? 'ring-2 ring-indigo-300 ring-offset-1 animate-pulse' : ''}
                `}
              >
                {done ? '\u2713' : i + 1}
              </button>
              <div className={`text-[10px] mt-1 whitespace-nowrap absolute top-6 ${active ? 'font-semibold text-slate-900' : 'text-slate-500'}`}>{s.label}</div>
            </div>
            {i < SHIP_STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${barDone ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
          </div>
        )
      })}
    </div>
  )
}

function ShipmentCards({ initialFilter }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'all')
  const [updatingId, setUpdatingId] = useState(null)

  const load = () => {
    setLoading(true)
    api('/shipments').then(({ data }) => setRows(data)).catch(e => toast.error(e.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const updateStatus = async (shipment, newStatus) => {
    const currentIdx = SHIP_STEPS.findIndex(s => s.key === shipment.status)
    const newIdx = SHIP_STEPS.findIndex(s => s.key === newStatus)
    const isBackward = newIdx < currentIdx
    const confirmMsg = isBackward
      ? `Move ${shipment.container_number || shipment.shipment_id} BACK to "${newStatus.replace('_', ' ')}"? This is unusual.`
      : `Move ${shipment.container_number || shipment.shipment_id} to "${newStatus.replace('_', ' ')}"?`
    if (!confirm(confirmMsg)) return

    setUpdatingId(shipment.id)
    const today = new Date().toISOString().slice(0, 10)
    const payload = { status: newStatus }
    // auto-timestamp key transitions
    if (newStatus === 'departed' && !shipment.actual_departure) payload.actual_departure = today
    if (newStatus === 'arrived' && !shipment.actual_arrival) payload.actual_arrival = today
    if (newStatus === 'delivered' && !shipment.actual_arrival) payload.actual_arrival = today

    try {
      await api(`/shipments/${shipment.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
      // Log to audit_logs
      await api('/audit_logs', {
        method: 'POST',
        body: JSON.stringify({
          actor: 'user',
          action: 'shipment_status_update',
          table_name: 'shipments',
          record_id: shipment.id,
          before_data: { status: shipment.status },
          after_data: payload,
        }),
      }).catch(() => {})
      toast.success(`${shipment.container_number || shipment.shipment_id} → ${newStatus.replace('_', ' ')}`)
      load()
    } catch (e) { toast.error(e.message) }
    setUpdatingId(null)
  }

  const filtered = useMemo(() => {
    let r = rows
    if (statusFilter === 'delayed') {
      const now = new Date()
      r = r.filter(x => x.eta && new Date(x.eta) < now && !['delivered', 'arrived', 'cancelled'].includes(x.status))
    } else if (statusFilter === 'arriving') {
      const now = new Date()
      r = r.filter(x => {
        if (!x.eta) return false
        const eta = new Date(x.eta); const wk = new Date(); wk.setDate(wk.getDate() + 7)
        return eta >= now && eta <= wk
      })
    } else if (statusFilter !== 'all') r = r.filter(x => x.status === statusFilter)
    if (search) { const q = search.toLowerCase(); r = r.filter(x => JSON.stringify(x).toLowerCase().includes(q)) }
    return r
  }, [rows, statusFilter, search])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Shipment Tracker</h2>
          <p className="text-sm text-slate-500">{filtered.length} shipment(s) · <span className="text-indigo-600">Click any timeline step to move a container forward</span></p>
        </div>
        <a href="/api/excel/export/shipments" className="px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg hover:bg-slate-50 flex items-center gap-2"><Download className="w-4 h-4" /> Export Excel</a>
      </div>

      <Card className="p-4">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search container, vessel, customer…" className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg" />
          </div>
          {['all', 'production', 'ready', 'loaded', 'in_transit', 'arriving', 'delayed', 'delivered'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-xs rounded-lg ${statusFilter === s ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}>{s.replace('_', ' ')}</button>
          ))}
        </div>
      </Card>

      {loading && <Card className="p-10 text-center text-slate-500">Loading…</Card>}
      {!loading && filtered.length === 0 && <Card className="p-10 text-center text-slate-500">No shipments</Card>}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map(s => {
          const now = new Date()
          const delayed = s.eta && new Date(s.eta) < now && !['delivered', 'arrived', 'cancelled'].includes(s.status)
          const daysUntil = s.eta ? Math.ceil((new Date(s.eta) - now) / 86400000) : null
          const isUpdating = updatingId === s.id
          return (
            <Card key={s.id} className={`p-4 ${delayed ? 'border-red-200' : ''} ${isUpdating ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-500">{s.shipment_id}</span>
                    <span className="font-bold text-slate-900">{s.container_number || '(no container)'}</span>
                    <StatusBadge status={s.status} />
                    {delayed && <Badge className="bg-red-100 text-red-800 border-red-200">DELAYED</Badge>}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">{s.vessel} · {s.shipping_line}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                    <MapPin className="w-3 h-3" /> {s.origin} <ChevronRight className="w-3 h-3" /> {s.destination}
                  </div>
                </div>
                <div className="text-right text-xs text-slate-600 shrink-0">
                  <div><span className="text-slate-400">Customer:</span> <span className="font-medium">{s.customers?.company_name || '—'}</span></div>
                  <div className="mt-0.5"><span className="text-slate-400">ETD:</span> {dateFmt(s.etd)}{s.actual_departure && <span className="text-emerald-600 ml-1">(dep {dateFmt(s.actual_departure)})</span>}</div>
                  <div className={delayed ? 'text-red-600 font-semibold' : ''}><span className="text-slate-400">ETA:</span> {dateFmt(s.eta)} {daysUntil != null && (daysUntil < 0 ? ` (${-daysUntil}d overdue)` : daysUntil <= 7 ? ` (in ${daysUntil}d)` : '')}{s.actual_arrival && <span className="text-emerald-600 ml-1">(arr {dateFmt(s.actual_arrival)})</span>}</div>
                  <div className="mt-0.5"><span className="text-slate-400">Cargo:</span> {num(s.total_sqm)} SQM · {s.pallets || 0} pallets</div>
                </div>
              </div>
              <div className="mt-6 pb-4 px-2">
                <ShipmentTimeline
                  status={s.status}
                  delayed={delayed}
                  disabled={isUpdating || ['delivered', 'cancelled'].includes(s.status)}
                  onStepClick={(newStatus) => updateStatus(s, newStatus)}
                />
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ============ SALES ORDER WIZARD ============
function SalesOrderWizard({ onClose, onCreated }) {
  const [customers, setCustomers] = useState([])
  const [inventory, setInventory] = useState([])
  const [customerId, setCustomerId] = useState('')
  const [customerPO, setCustomerPO] = useState('')
  const [orderStatus, setOrderStatus] = useState('confirmed')
  const [items, setItems] = useState([{ inventory_id: '', product_id: '', quantity_sqm: '', price_per_sqm: '' }])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    Promise.all([api('/customers'), api('/inventory?status=available')]).then(([c, i]) => {
      setCustomers(c.data); setInventory(i.data)
    })
  }, [])

  const customer = customers.find(c => c.id === customerId)

  const pickInventory = (idx, invId) => {
    const inv = inventory.find(x => x.id === invId)
    if (!inv) return
    const newItems = [...items]
    newItems[idx] = {
      inventory_id: invId, product_id: inv.product_id,
      quantity_sqm: String(Number(inv.quantity_sqm) - Number(inv.reserved_sqm || 0)),
      price_per_sqm: String(inv.selling_price_sqm || inv.products?.standard_selling_price || 0),
      _inv: inv,
    }
    setItems(newItems)
  }
  const updateItem = (idx, field, val) => {
    const n = [...items]; n[idx] = { ...n[idx], [field]: val }; setItems(n)
  }
  const addItem = () => setItems([...items, { inventory_id: '', product_id: '', quantity_sqm: '', price_per_sqm: '' }])
  const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx))

  const totalSqm = items.reduce((a, i) => a + Number(i.quantity_sqm || 0), 0)
  const totalValue = items.reduce((a, i) => a + Number(i.quantity_sqm || 0) * Number(i.price_per_sqm || 0), 0)
  const totalCost = items.reduce((a, i) => a + (i._inv ? (Number(i.quantity_sqm || 0) * Number(i._inv.cost_per_sqm || 0)) : 0), 0)
  const grossProfit = totalValue - totalCost
  const grossMargin = totalValue > 0 ? (grossProfit / totalValue) * 100 : 0
  const currency = customer?.currency || 'GBP'

  const submit = async () => {
    if (!customerId) return toast.error('Select a customer')
    const validItems = items.filter(i => Number(i.quantity_sqm) > 0 && Number(i.price_per_sqm) > 0)
    if (validItems.length === 0) return toast.error('Add at least one line item')
    setBusy(true)
    try {
      const res = await api('/sales-order', {
        method: 'POST',
        body: JSON.stringify({
          customer_id: customerId, currency, customer_po: customerPO, status: orderStatus,
          items: validItems.map(i => ({
            inventory_id: i.inventory_id || null, product_id: i.product_id,
            quantity_sqm: Number(i.quantity_sqm), price_per_sqm: Number(i.price_per_sqm),
          })),
        }),
      })
      toast.success(`Order ${res.data.order_number} created`)
      if (res.warnings?.length > 0) toast.warning(res.warnings.join('; '))
      onCreated()
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative w-full max-w-3xl bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-slate-500">Create</div>
            <div className="text-lg font-bold text-slate-900">Sales Order Wizard</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-5">
          <Card className="p-4">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">1. Customer</h4>
            <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
              <option value="">-- Select Customer --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.code} — {c.company_name} ({c.country}, {c.currency})</option>)}
            </select>
            {customer && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><div className="text-slate-500">Payment Terms</div><div className="font-medium">{customer.payment_terms}</div></div>
                <div><div className="text-slate-500">Currency</div><div className="font-medium">{customer.currency}</div></div>
                <div><div className="text-slate-500">Credit Limit</div><div className="font-medium">{fmt(customer.credit_limit, customer.currency)}</div></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="text-xs text-slate-500">Customer PO Number</label>
                <input value={customerPO} onChange={(e) => setCustomerPO(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Order Status</label>
                <select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  {['enquiry', 'quotation', 'confirmed', 'processing'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-700">2. Line Items (auto-reserves stock)</h4>
              <button onClick={addItem} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700">+ Add line</button>
            </div>
            <div className="space-y-3">
              {items.map((it, i) => {
                const inv = inventory.find(x => x.id === it.inventory_id)
                const avail = inv ? Number(inv.quantity_sqm) - Number(inv.reserved_sqm || 0) : 0
                const over = Number(it.quantity_sqm || 0) > avail
                return (
                  <div key={i} className="p-3 bg-slate-50 rounded-lg space-y-2">
                    <div className="flex gap-2">
                      <select value={it.inventory_id} onChange={(e) => pickInventory(i, e.target.value)} className="flex-1 px-2 py-1.5 text-sm border border-slate-300 rounded">
                        <option value="">-- Pick from available stock --</option>
                        {inventory.map(x => (
                          <option key={x.id} value={x.id}>
                            {x.stock_id} — {x.products?.name} ({x.products?.size}) — {num(Number(x.quantity_sqm) - Number(x.reserved_sqm || 0))} SQM available
                          </option>
                        ))}
                      </select>
                      <button onClick={() => removeItem(i)} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                    </div>
                    {inv && (
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <label className="text-slate-500">Quantity (SQM)</label>
                          <input type="number" value={it.quantity_sqm} onChange={(e) => updateItem(i, 'quantity_sqm', e.target.value)} className={`w-full px-2 py-1 border rounded ${over ? 'border-red-400 bg-red-50' : 'border-slate-300'}`} />
                          <div className={`text-[10px] mt-0.5 ${over ? 'text-red-600' : 'text-slate-500'}`}>{over ? `Max ${avail} available` : `${avail} SQM available`}</div>
                        </div>
                        <div>
                          <label className="text-slate-500">Price/SQM</label>
                          <input type="number" value={it.price_per_sqm} onChange={(e) => updateItem(i, 'price_per_sqm', e.target.value)} className="w-full px-2 py-1 border border-slate-300 rounded" />
                          <div className="text-[10px] mt-0.5 text-slate-500">Cost/SQM: {numDec(inv.cost_per_sqm)}</div>
                        </div>
                        <div>
                          <label className="text-slate-500">Line Total</label>
                          <div className="px-2 py-1 font-semibold">{fmt(Number(it.quantity_sqm || 0) * Number(it.price_per_sqm || 0), currency)}</div>
                          <div className="text-[10px] mt-0.5 text-emerald-700">Margin: {inv.cost_per_sqm && Number(it.price_per_sqm) > 0 ? `${(((Number(it.price_per_sqm) - Number(inv.cost_per_sqm)) / Number(it.price_per_sqm)) * 100).toFixed(1)}%` : '—'}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-3">3. Live Totals</h4>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div><div className="text-xs text-slate-500">Total SQM</div><div className="text-lg font-bold">{num(totalSqm)}</div></div>
              <div><div className="text-xs text-slate-500">Revenue</div><div className="text-lg font-bold text-slate-900">{fmt(totalValue, currency)}</div></div>
              <div><div className="text-xs text-slate-500">Landed Cost</div><div className="text-lg font-bold text-slate-700">{fmt(totalCost, currency)}</div></div>
              <div><div className="text-xs text-slate-500">Gross Profit</div><div className="text-lg font-bold text-emerald-700">{fmt(grossProfit, currency)}<span className="text-xs ml-1 font-normal">({numDec(grossMargin)}%)</span></div></div>
            </div>
          </Card>

          <button onClick={submit} disabled={busy} className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
            {busy ? 'Creating…' : `Create Order & Auto-Reserve Stock`}
          </button>
          <div className="text-xs text-slate-500 text-center">Confirmed/processing orders will automatically reserve inventory from the linked stock records and update the dashboard.</div>
        </div>
      </div>
    </div>
  )
}

// ============ ADD RESOURCE MODAL (manual entries) ============
const FIELD_SPECS = {
  products: [
    { k: 'sku', label: 'SKU', required: true },
    { k: 'name', label: 'Product Name', required: true },
    { k: 'category', label: 'Category', type: 'select', options: ['Sandstone', 'Limestone', 'Granite', 'Marble', 'Slate', 'Porcelain', 'Stone Veneer'] },
    { k: 'material', label: 'Material' },
    { k: 'colour', label: 'Colour' },
    { k: 'finish', label: 'Finish', type: 'select', options: ['Natural', 'Honed', 'Polished', 'Flamed', 'Bush-hammered', 'Tumbled', 'Matte'] },
    { k: 'size', label: 'Size (e.g. 600x400x25mm)' },
    { k: 'thickness_mm', label: 'Thickness (mm)', type: 'number' },
    { k: 'grade', label: 'Grade' },
    { k: 'unit', label: 'Unit', default: 'SQM' },
    { k: 'standard_cost', label: 'Standard Cost', type: 'number' },
    { k: 'standard_selling_price', label: 'Standard Selling Price', type: 'number' },
    { k: 'min_stock_level', label: 'Min Stock Level (SQM)', type: 'number' },
  ],
  customers: [
    { k: 'code', label: 'Customer Code', required: true },
    { k: 'company_name', label: 'Company Name', required: true },
    { k: 'contact_person', label: 'Contact Person' },
    { k: 'email', label: 'Email' },
    { k: 'phone', label: 'Phone' },
    { k: 'country', label: 'Country' },
    { k: 'payment_terms', label: 'Payment Terms', default: 'Net 30' },
    { k: 'credit_limit', label: 'Credit Limit', type: 'number' },
    { k: 'currency', label: 'Currency', type: 'select', options: ['GBP', 'USD', 'EUR', 'INR'], default: 'GBP' },
  ],
  suppliers: [
    { k: 'code', label: 'Supplier Code', required: true },
    { k: 'name', label: 'Supplier Name', required: true },
    { k: 'contact_person', label: 'Contact Person' },
    { k: 'email', label: 'Email' },
    { k: 'phone', label: 'Phone' },
    { k: 'country', label: 'Country' },
    { k: 'payment_terms', label: 'Payment Terms', default: 'Net 45' },
  ],
  inventory: [
    { k: 'product_id', label: 'Product', required: true, type: 'resource_select', resource: 'products', displayKey: 'name', secondaryKey: 'sku' },
    { k: 'batch_lot', label: 'Batch / Lot Number' },
    { k: 'quantity_sqm', label: 'Quantity (SQM)', type: 'number', required: true },
    { k: 'pallets', label: 'Pallets', type: 'number' },
    { k: 'weight_mt', label: 'Weight (MT)', type: 'number' },
    { k: 'source', label: 'Source', type: 'select', options: ['own_production', 'outsourced'], default: 'outsourced' },
    { k: 'supplier_id', label: 'Supplier', type: 'resource_select', resource: 'suppliers', displayKey: 'name', secondaryKey: 'code', optional: true },
    { k: 'supplier_cost', label: 'Supplier Cost (total)', type: 'number' },
    { k: 'production_cost', label: 'Production Cost', type: 'number' },
    { k: 'freight_cost', label: 'Freight Cost', type: 'number' },
    { k: 'duty_tax', label: 'Duty / Tax', type: 'number' },
    { k: 'handling_cost', label: 'Handling Cost', type: 'number' },
    { k: 'selling_price_sqm', label: 'Selling Price per SQM', type: 'number' },
    { k: 'status', label: 'Status', type: 'select', options: ['available', 'reserved', 'in_transit', 'damaged', 'on_hold'], default: 'available' },
    { k: 'warehouse_location', label: 'Warehouse Location / Rack' },
    { k: 'notes', label: 'Notes' },
  ],
}
const RESOURCE_TITLES = { products: 'Product', customers: 'Customer', suppliers: 'Supplier', inventory: 'Stock Record' }

function AddResourceModal({ resource, onClose, onCreated }) {
  const spec = FIELD_SPECS[resource]
  const [form, setForm] = useState(() => {
    const init = {}
    for (const f of spec) if (f.default) init[f.k] = f.default
    return init
  })
  const [resourceData, setResourceData] = useState({})
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const rsFields = spec.filter(f => f.type === 'resource_select')
    Promise.all(rsFields.map(f => api(`/${f.resource}`).then(r => [f.resource, r.data]))).then(pairs => {
      setResourceData(Object.fromEntries(pairs))
    })
  }, [resource])

  const submit = async () => {
    for (const f of spec) if (f.required && !form[f.k]) return toast.error(`${f.label} is required`)
    setBusy(true)
    try {
      // clean payload: only include non-empty fields, cast numbers
      const payload = {}
      for (const f of spec) {
        let v = form[f.k]
        if (v === undefined || v === '' || v === null) continue
        if (f.type === 'number') v = Number(v)
        payload[f.k] = v
      }
      // inventory needs warehouse_id
      if (resource === 'inventory') {
        const { data: whs } = await api('/warehouses')
        payload.warehouse_id = whs[0]?.id
        // Generate stock_id
        const { data: existing } = await api('/inventory')
        payload.stock_id = 'STK-' + String((existing?.length || 0) + 1).padStart(5, '0')
      }
      await api(`/${resource}`, { method: 'POST', body: JSON.stringify(payload) })
      toast.success(`${RESOURCE_TITLES[resource]} created`)
      onCreated()
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-slate-900/50" />
      <div className="relative w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <div className="text-xs text-slate-500">Create</div>
            <div className="text-lg font-bold text-slate-900">New {RESOURCE_TITLES[resource]}</div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-3">
          {spec.map(f => (
            <div key={f.k}>
              <label className="text-xs font-medium text-slate-600">{f.label}{f.required && <span className="text-red-500 ml-1">*</span>}</label>
              {f.type === 'select' ? (
                <select value={form[f.k] || ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="">-- select --</option>
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : f.type === 'resource_select' ? (
                <select value={form[f.k] || ''} onChange={(e) => setForm({ ...form, [f.k]: e.target.value })} className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg">
                  <option value="">-- select --</option>
                  {(resourceData[f.resource] || []).map(r => (
                    <option key={r.id} value={r.id}>{r[f.displayKey]}{f.secondaryKey && r[f.secondaryKey] ? ` (${r[f.secondaryKey]})` : ''}</option>
                  ))}
                </select>
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={form[f.k] ?? ''}
                  onChange={(e) => setForm({ ...form, [f.k]: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
                />
              )}
            </div>
          ))}
          <button onClick={submit} disabled={busy} className="w-full py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 font-semibold">
            {busy ? 'Creating…' : `Create ${RESOURCE_TITLES[resource]}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ============ MAIN APP ============
function App() {
  const [view, setView] = useState('dashboard')
  const [viewFilter, setViewFilter] = useState({})
  const [health, setHealth] = useState(null)
  const [dashData, setDashData] = useState(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [globalSearch, setGlobalSearch] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [showWizard, setShowWizard] = useState(false)

  const checkHealth = async () => {
    try { const h = await api('/health'); setHealth(h); return h } catch (e) { toast.error(e.message); return null }
  }
  const loadDash = async () => {
    try { const d = await api('/dashboard'); setDashData(d) } catch (e) { }
  }

  useEffect(() => {
    (async () => {
      const h = await checkHealth()
      if (h?.ready) loadDash()
    })()
  }, [refreshKey])

  useEffect(() => {
    if (view === 'dashboard' && health?.ready) loadDash()
  }, [view, health])

  const go = (v, filter = {}) => { setView(v); setViewFilter(filter) }
  const bumpRefresh = () => setRefreshKey(k => k + 1)

  // Global search
  useEffect(() => {
    if (!globalSearch.trim()) { setSearchResults(null); return }
    const t = setTimeout(async () => {
      try { const r = await api(`/search?q=${encodeURIComponent(globalSearch)}`); setSearchResults(r) } catch (e) {}
    }, 300)
    return () => clearTimeout(t)
  }, [globalSearch])

  if (health && !health.ready) return <SetupScreen health={health} onRecheck={() => setRefreshKey(k => k + 1)} />
  if (!health) return <div className="min-h-screen flex items-center justify-center text-slate-500">Connecting to Supabase…</div>

  const isEmpty = (dashData?.stock?.total_sqm || 0) === 0 && view === 'dashboard'

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold">A</div>
            <div>
              <div className="font-bold">Arvicon</div>
              <div className="text-xs text-slate-400">Ops & Inventory</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {NAV.map(n => {
            const Icon = n.icon
            const active = view === n.id
            return (
              <button key={n.id} onClick={() => go(n.id)} className={`w-full flex items-center gap-2.5 px-5 py-2.5 text-sm text-left transition ${active ? 'bg-slate-800 text-white border-l-2 border-indigo-500' : 'text-slate-300 hover:bg-slate-800/50'}`}>
                <Icon className="w-4 h-4" />
                {n.label}
              </button>
            )
          })}
        </nav>
        <div className="px-5 py-3 border-t border-slate-800 text-xs text-slate-500">
          Arvicon International · UK
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search anything: SKU, container, invoice, customer…" className="w-full pl-9 pr-3 py-2 text-sm bg-slate-100 rounded-lg focus:outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500" />
            {searchResults && globalSearch && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-30 max-h-96 overflow-y-auto">
                {['inventory', 'shipments', 'sales_orders', 'invoices', 'products', 'customers'].map(k => searchResults[k]?.length > 0 && (
                  <div key={k} className="px-3 py-2 border-b last:border-0 border-slate-100">
                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">{k.replace('_', ' ')}</div>
                    {searchResults[k].map(r => (
                      <div key={r.id} className="text-sm py-1 hover:bg-slate-50 rounded px-1 cursor-pointer" onClick={() => { go(k === 'sales_orders' ? 'sales' : k === 'inventory' ? 'stock' : k); setGlobalSearch('') }}>
                        {r.stock_id || r.shipment_id || r.order_number || r.invoice_number || r.sku || r.code} — {r.container_number || r.products?.name || r.customers?.company_name || r.name || r.company_name}
                      </div>
                    ))}
                  </div>
                ))}
                {Object.values(searchResults).every(v => Array.isArray(v) && v.length === 0) && <div className="px-3 py-4 text-sm text-slate-500">No results</div>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowWizard(true)} className="px-3 py-2 text-sm bg-indigo-600 text-white rounded-lg flex items-center gap-1.5 hover:bg-indigo-700"><Plus className="w-4 h-4" /> New Sales Order</button>
            {isEmpty && (
              <button onClick={async () => { await api('/seed', { method: 'POST' }); toast.success('Demo data seeded'); bumpRefresh() }} className="px-3 py-2 text-sm bg-emerald-600 text-white rounded-lg flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Seed Demo Data</button>
            )}
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">AV</div>
          </div>
        </header>

        {showWizard && <SalesOrderWizard onClose={() => setShowWizard(false)} onCreated={() => { setShowWizard(false); bumpRefresh(); go('sales', {}) }} />}

        <main className="flex-1 overflow-auto p-6">
          {view === 'dashboard' && <Dashboard go={go} data={dashData} />}
          {view === 'stock' && <StockMaster initialFilter={viewFilter} refresh={refreshKey} />}
          {view === 'shipments' && <ShipmentCards initialFilter={viewFilter} />}
          {view === 'sales' && <ResourceTable
            resource="sales_orders" title="Sales / Orders" exportPath="sales"
            columns={[
              { key: 'order_number', label: 'Order #', render: r => <span className="font-mono text-xs">{r.order_number}</span> },
              { key: 'order_date', label: 'Date', render: r => dateFmt(r.order_date) },
              { key: 'customer', label: 'Customer', render: r => <div><div className="font-medium">{r.customers?.company_name}</div><div className="text-xs text-slate-500">{r.customers?.country}</div></div> },
              { key: 'total_sqm', label: 'SQM', render: r => num(r.total_sqm) },
              { key: 'total_value', label: 'Value', render: r => fmt(r.total_value, r.currency || 'GBP') },
              { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
            ]}
          />}
          {view === 'suppliers' && <ResourceTable
            resource="suppliers" title="Suppliers" addable="suppliers"
            columns={[
              { key: 'code', label: 'Code', render: r => <span className="font-mono text-xs">{r.code}</span> },
              { key: 'name', label: 'Supplier', render: r => <div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.contact_person}</div></div> },
              { key: 'country', label: 'Country' },
              { key: 'email', label: 'Email', render: r => <span className="text-xs">{r.email}</span> },
              { key: 'phone', label: 'Phone' },
              { key: 'payment_terms', label: 'Terms' },
            ]}
          />}
          {view === 'customers' && <ResourceTable
            resource="customers" title="Customers" addable="customers"
            columns={[
              { key: 'code', label: 'Code', render: r => <span className="font-mono text-xs">{r.code}</span> },
              { key: 'company_name', label: 'Customer', render: r => <div><div className="font-medium">{r.company_name}</div><div className="text-xs text-slate-500">{r.contact_person}</div></div> },
              { key: 'country', label: 'Country' },
              { key: 'currency', label: 'Currency' },
              { key: 'payment_terms', label: 'Terms' },
              { key: 'credit_limit', label: 'Credit Limit', render: r => fmt(r.credit_limit, r.currency) },
            ]}
          />}
          {view === 'products' && <ResourceTable
            resource="products" title="Product Master" addable="products"
            columns={[
              { key: 'sku', label: 'SKU', render: r => <span className="font-mono text-xs">{r.sku}</span> },
              { key: 'name', label: 'Product', render: r => <div><div className="font-medium">{r.name}</div><div className="text-xs text-slate-500">{r.category} · {r.colour} · {r.finish}</div></div> },
              { key: 'size', label: 'Size' },
              { key: 'standard_cost', label: 'Std Cost', render: r => numDec(r.standard_cost) },
              { key: 'standard_selling_price', label: 'Std Sell', render: r => numDec(r.standard_selling_price) },
              { key: 'min_stock_level', label: 'Min Stock', render: r => num(r.min_stock_level) },
              { key: 'active', label: 'Active', render: r => r.active ? <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge> : <Badge className="bg-slate-100 text-slate-500 border-slate-200">Inactive</Badge> },
            ]}
          />}
          {view === 'excel' && <ExcelImport onImported={bumpRefresh} />}
          {view === 'reports' && <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">Reports</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { t: 'Stock Master', d: 'All inventory records with cost & value', p: 'stock' },
                { t: 'Shipments', d: 'All shipments with route, ETA, status, costs', p: 'shipments' },
                { t: 'Sales Orders', d: 'All sales orders with customer & value', p: 'sales' },
                { t: 'Invoices & Outstanding', d: 'All invoices, payments and outstanding', p: 'invoices' },
              ].map(r => (
                <Card key={r.p} className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">{r.t}</div>
                      <div className="text-sm text-slate-500 mt-0.5">{r.d}</div>
                    </div>
                    <a href={`/api/excel/export/${r.p}`} className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-1"><Download className="w-3.5 h-3.5" /> Export</a>
                  </div>
                </Card>
              ))}
            </div>
          </div>}
          {view === 'settings' && <SettingsView health={health} onReload={bumpRefresh} />}
        </main>
      </div>
    </div>
  )
}

export default App
