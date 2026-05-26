import { createClient } from '@supabase/supabase-js'
import {
  Chart,
  LineController, BarController,
  LineElement, BarElement, PointElement,
  LinearScale, CategoryScale, TimeScale,
  Tooltip, Legend, Filler,
} from 'chart.js'

Chart.register(
  LineController, BarController,
  LineElement, BarElement, PointElement,
  LinearScale, CategoryScale,
  Tooltip, Legend, Filler,
)

// ── Supabase (clave pública — solo lectura) ─────────────────────────────────
const sb = createClient(
  'https://pcstcvdwqhpyjwsapxot.supabase.co',
  'sb_publishable_1oT-woCkBLwbudirft2KDA_Ql_YX1R-',
)

// ── Helpers ─────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id)

function dateAgo(days) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function fmt(n, decimals = 2) {
  if (n == null) return '—'
  return Number(n).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtPct(n) {
  if (n == null) return '—'
  return `${fmt(n, 1)}%`
}

function fmtMillones(n) {
  if (n == null) return '—'
  if (n >= 1e12) return `$${fmt(n / 1e12, 1)}B`
  if (n >= 1e9)  return `$${fmt(n / 1e9,  1)}M`
  if (n >= 1e6)  return `$${fmt(n / 1e6,  1)}K`
  return `$${fmt(n, 0)}`
}

const CHART_DEFAULTS = {
  plugins: {
    legend: { labels: { color: '#8b949e', font: { size: 12 } } },
    tooltip: {
      backgroundColor: '#161b22',
      borderColor: '#30363d',
      borderWidth: 1,
      titleColor: '#e6edf3',
      bodyColor: '#8b949e',
    },
  },
  scales: {
    x: {
      ticks: { color: '#8b949e', maxTicksLimit: 8 },
      grid: { color: 'rgba(48,54,61,.5)' },
    },
    y: {
      ticks: { color: '#8b949e' },
      grid: { color: 'rgba(48,54,61,.5)' },
    },
  },
}

function lineChart(canvasId, labels, datasets) {
  const ctx = $(canvasId).getContext('2d')
  return new Chart(ctx, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      ...CHART_DEFAULTS,
    },
  })
}

function barChart(canvasId, labels, datasets, opts = {}) {
  const ctx = $(canvasId).getContext('2d')
  return new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      indexAxis: opts.horizontal ? 'y' : 'x',
      ...CHART_DEFAULTS,
      ...(opts.extra ?? {}),
    },
  })
}

// ── Tab navigation ───────────────────────────────────────────────────────────
const tabs     = document.querySelectorAll('.tab')
const contents = document.querySelectorAll('.tab-content')
const loaded   = new Set()

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'))
    contents.forEach(c => c.classList.remove('active'))
    tab.classList.add('active')
    const id = tab.dataset.tab
    $(`${id}`).classList.add('active')
    if (!loaded.has(id)) { loaders[id](); loaded.add(id) }
  })
})

// ── DÓLAR ────────────────────────────────────────────────────────────────────
async function loadDolar() {
  const casas = ['oficial', 'blue', 'bolsa', 'contadoconliqui', 'cripto', 'mayorista']
  const colors = {
    oficial:         '#58a6ff',
    blue:            '#3fb950',
    bolsa:           '#bc8cff',
    contadoconliqui: '#ffa657',
    cripto:          '#d29922',
    mayorista:       '#8b949e',
  }
  const labels = {
    oficial: 'Oficial', blue: 'Blue', bolsa: 'Bolsa/MEP',
    contadoconliqui: 'CCL', cripto: 'Cripto', mayorista: 'Mayorista',
  }

  const { data } = await sb
    .from('argentinadatos_cotizaciones_dolar')
    .select('casa, fecha, compra, venta')
    .in('casa', casas)
    .gte('fecha', dateAgo(90))
    .order('fecha', { ascending: true })

  if (!data?.length) return

  // Cards con valor actual por casa
  const latest = {}
  for (const r of data) {
    if (!latest[r.casa] || r.fecha > latest[r.casa].fecha) latest[r.casa] = r
  }

  const cardColors = { oficial: 'blue', blue: 'green', bolsa: 'purple', contadoconliqui: 'orange', cripto: 'yellow', mayorista: 'muted' }
  $('cards-dolar').innerHTML = casas.map(c => {
    const r = latest[c]
    if (!r) return ''
    return `
      <div class="card">
        <div class="label">${labels[c]}</div>
        <div class="value">$${fmt(r.venta, 0)}</div>
        <div class="sub">Compra: $${fmt(r.compra, 0)}</div>
      </div>`
  }).join('')

  // Agrupar por fecha
  const dateSet = [...new Set(data.map(r => r.fecha))].sort()
  const byDate  = {}
  for (const r of data) {
    if (!byDate[r.fecha]) byDate[r.fecha] = {}
    byDate[r.fecha][r.casa] = r.venta
  }

  const mainCasas = ['blue', 'oficial', 'bolsa', 'contadoconliqui']
  lineChart('chart-dolar', dateSet, mainCasas.map(casa => ({
    label: labels[casa],
    data: dateSet.map(f => byDate[f]?.[casa] ?? null),
    borderColor: colors[casa],
    backgroundColor: colors[casa] + '20',
    fill: false,
    tension: 0.3,
    pointRadius: 0,
    borderWidth: 2,
    spanGaps: true,
  })))
}

// ── ÍNDICES ──────────────────────────────────────────────────────────────────
async function loadIndices() {
  const [{ data: inflacion }, { data: riesgo }, { data: uva }] = await Promise.all([
    sb.from('argentinadatos_indices')
      .select('fecha, valor').eq('tipo', 'inflacion_mensual')
      .order('fecha', { ascending: false }).limit(24),
    sb.from('argentinadatos_indices')
      .select('fecha, valor').eq('tipo', 'riesgo_pais')
      .gte('fecha', dateAgo(180)).order('fecha', { ascending: true }),
    sb.from('argentinadatos_indices')
      .select('fecha, valor').eq('tipo', 'uva')
      .gte('fecha', dateAgo(365)).order('fecha', { ascending: true }),
  ])

  if (inflacion?.length) {
    const sorted = [...inflacion].reverse()
    barChart('chart-inflacion',
      sorted.map(r => r.fecha.slice(0, 7)),
      [{
        label: 'Inflación %',
        data: sorted.map(r => r.valor),
        backgroundColor: sorted.map(r => r.valor > 10 ? '#f8514980' : '#3fb95080'),
        borderColor:     sorted.map(r => r.valor > 10 ? '#f85149'   : '#3fb950'),
        borderWidth: 1,
      }]
    )
  }

  if (riesgo?.length) {
    lineChart('chart-riesgo',
      riesgo.map(r => r.fecha),
      [{
        label: 'Puntos básicos',
        data: riesgo.map(r => r.valor),
        borderColor: '#d29922',
        backgroundColor: '#d2992220',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    )
  }

  if (uva?.length) {
    lineChart('chart-uva',
      uva.map(r => r.fecha),
      [{
        label: 'UVA',
        data: uva.map(r => r.valor),
        borderColor: '#bc8cff',
        backgroundColor: '#bc8cff20',
        fill: true,
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      }]
    )
  }
}

// ── TASAS ────────────────────────────────────────────────────────────────────
async function loadTasas() {
  const [{ data: pf }, { data: rend }] = await Promise.all([
    sb.from('argentinadatos_tasas_plazo_fijo')
      .select('entidad, tna_clientes, tna_no_clientes, fecha')
      .order('fecha', { ascending: false })
      .order('tna_clientes', { ascending: false })
      .limit(60),
    sb.from('argentinadatos_rendimientos')
      .select('entidad, moneda, apy, fecha')
      .eq('moneda', 'ARS')
      .order('fecha', { ascending: false })
      .limit(100),
  ])

  // Dedup plazo fijo — queda solo el dato más reciente por entidad
  const latestPF = {}
  for (const r of (pf ?? [])) {
    if (!latestPF[r.entidad]) latestPF[r.entidad] = r
  }
  const pfRows = Object.values(latestPF).sort((a, b) => b.tna_clientes - a.tna_clientes)

  // Top 15 para chart
  const top15 = pfRows.slice(0, 15)
  barChart('chart-pf',
    top15.map(r => r.entidad.split(' ').slice(0, 3).join(' ')),
    [{
      label: 'TNA Clientes',
      data: top15.map(r => +(r.tna_clientes * 100).toFixed(2)),
      backgroundColor: '#58a6ff80',
      borderColor: '#58a6ff',
      borderWidth: 1,
    }],
    { horizontal: true }
  )

  // Tabla completa
  $('tabla-pf').innerHTML = pfRows.map(r => `
    <tr>
      <td>${r.entidad}</td>
      <td><strong>${fmtPct(r.tna_clientes * 100)}</strong></td>
      <td>${fmtPct(r.tna_no_clientes * 100)}</td>
    </tr>`).join('')

  // Rendimientos ARS
  const latestRend = {}
  for (const r of (rend ?? [])) {
    if (!latestRend[r.entidad]) latestRend[r.entidad] = r
  }
  const rendRows = Object.values(latestRend).sort((a, b) => b.apy - a.apy)

  if (rendRows.length) {
    barChart('chart-rendimientos',
      rendRows.map(r => r.entidad),
      [{
        label: 'APY %',
        data: rendRows.map(r => +(r.apy * 100).toFixed(2)),
        backgroundColor: '#3fb95080',
        borderColor: '#3fb950',
        borderWidth: 1,
      }],
      { horizontal: true }
    )
  }
}

// ── FCI ──────────────────────────────────────────────────────────────────────
async function loadFci() {
  // Catálogo de mercado de dinero (con patrimonio en metadata)
  const { data: fondos } = await sb
    .from('argentinadatos_fci_fondos')
    .select('nombre, tipo, sociedad, metadata')
    .eq('tipo', 'Mercado de Dinero')
    .limit(200)

  if (!fondos?.length) return

  // Ordenar por patrimonio desc
  const sorted = fondos
    .filter(f => f.metadata?.patrimonio)
    .sort((a, b) => (b.metadata.patrimonio ?? 0) - (a.metadata.patrimonio ?? 0))

  // Cards resumen
  const totalPatrimonio = sorted.reduce((s, f) => s + (f.metadata?.patrimonio ?? 0), 0)
  const totalFondos     = fondos.length

  $('cards-fci').innerHTML = `
    <div class="card">
      <div class="label">Fondos Mercado de Dinero</div>
      <div class="value">${totalFondos}</div>
    </div>
    <div class="card">
      <div class="label">Patrimonio total</div>
      <div class="value" style="font-size:18px">${fmtMillones(totalPatrimonio)}</div>
    </div>
    <div class="card">
      <div class="label">Fondo más grande</div>
      <div class="value" style="font-size:14px; line-height:1.4">${sorted[0]?.nombre ?? '—'}</div>
      <div class="sub">${fmtMillones(sorted[0]?.metadata?.patrimonio)}</div>
    </div>`

  // Tabla top 25
  $('tabla-fci').innerHTML = sorted.slice(0, 25).map((f, i) => {
    const r = f.metadata?.rendimientos ?? {}
    return `
      <tr>
        <td style="color:var(--muted)">${i + 1}</td>
        <td>${f.nombre}</td>
        <td style="color:var(--muted);font-size:12px">${f.sociedad ?? '—'}</td>
        <td>${fmtMillones(f.metadata?.patrimonio)}</td>
        <td class="${r.ultimos7Dias > 0 ? 'up' : ''}">${r.ultimos7Dias != null ? fmtPct(r.ultimos7Dias) : '—'}</td>
        <td class="${r.unMes > 0 ? 'up' : ''}">${r.unMes != null ? fmtPct(r.unMes) : '—'}</td>
      </tr>`
  }).join('')
}

// ── Sync log ─────────────────────────────────────────────────────────────────
async function loadSyncInfo() {
  const { data } = await sb
    .from('argentinadatos_sync_log')
    .select('endpoint, started_at, status, rows_upserted')
    .order('started_at', { ascending: false })
    .limit(1)

  const el = $('last-sync')
  if (data?.[0]) {
    const d = new Date(data[0].started_at)
    el.textContent = `Último sync: ${d.toLocaleDateString('es-AR')} ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
  } else {
    el.textContent = ''
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const loaders = { dolar: loadDolar, indices: loadIndices, tasas: loadTasas, fci: loadFci }

loaded.add('dolar')
loadDolar()
loadSyncInfo()
