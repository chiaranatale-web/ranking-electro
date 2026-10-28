(function () {
  'use strict';
  const clock = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' });
  const currentDay = () => clock.format(new Date());
  const status = document.createElement('p');
  status.className = 'preview-note';
  document.querySelector('.header').appendChild(status);
  const loaded = {};
  const snapshot = document.querySelector('.header > p')?.textContent.match(/Generado:\s*([^·]+)/)?.[1]?.trim() || 'sin fecha identificada';
  const number = value => value == null ? '—' : Math.round(Number(value)).toLocaleString('es-AR');
  const dateLabel = date => date.slice(8,10) + '/' + date.slice(5,7);
  const stocks = new Map();

  function validate(payload, kind) {
    if (payload.schema_version !== 1 || payload.kind !== kind || !Array.isArray(payload.rows) || !payload.rows.length) throw Error('Formato de actualización inválido');
    if (!Number.isFinite(Date.parse(payload.generated_at))) throw Error('Fecha de actualización inválida');
    for (const date of Object.values(payload.dates || {})) if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw Error('Período inválido');
    if (!payload.dates?.hoy || !payload.dates?.ayer || !payload.dates?.week_start) throw Error('Faltan fechas');
    if (payload.dates.hoy > currentDay() || (kind === 'hoy' && payload.dates.hoy !== currentDay())) throw Error('La fecha de Hoy no corresponde al día actual');
    const periods = kind === 'hoy' ? ['hoy'] : ['ayer', '7d'];
    const seen = new Set();
    for (const row of payload.rows) {
      const key = [row.period, row.panel, row.item_id].join('/');
      if (!periods.includes(row.period) || seen.has(key) || !/^\d+$/.test(String(row.item_id)) || !document.getElementById('panel-' + row.panel)) throw Error('Ranking inválido');
      seen.add(key);
      if (typeof row.nsi !== 'number' || row.nsi < 1 || typeof row.nmv !== 'number') throw Error('Faltan métricas de ventas');
      for (const field of ['nsi','nmv','precio']) if (row[field] != null && (typeof row[field] !== 'number' || !Number.isFinite(row[field]) || row[field] < 0)) throw Error('Métrica inválida');
      if (row.stock != null && (!Number.isFinite(Number(row.stock)) || Number(row.stock) < 0)) throw Error('Stock inválido');
    }
    if (periods.some(period => !payload.rows.some(row => row.period === period && row.panel === 'grp-total'))) throw Error('Falta el ranking de Total MLA');
  }

  function attribute(label, row) {
    const patterns = { Litros: /([\d.,]+)\s*(?:litros?|lts?\.?|l\b)/i, Pulgadas: /(\d{2,3})\s*(?:pulgadas?|["”])/i, Capacidad: /([\d.,]+)\s*(?:kgs?|kilos?)/i, Frigorias: /(\d[\d.]*)\s*(?:frigor[ií]as?|frig)/i };
    const match = patterns[label]?.exec(row.title || '');
    return match ? match[1] + ({Litros:' L',Pulgadas:'″',Capacidad:' kg',Frigorias:' frig.'}[label] || '') : '—';
  }

  function render(payload) {
    const periods = payload.kind === 'hoy' ? ['hoy'] : ['7d', 'ayer'];
    if (payload.kind === 'daily') {
      stocks.clear();
      payload.rows.forEach(row => { if (row.stock != null) stocks.set(String(row.item_id), row.stock); });
    }
    document.querySelectorAll('.cat-panel:not(#panel-hotsale)').forEach(panel => {
      const key = panel.id.replace('panel-', '');
      periods.forEach(period => {
        const table = document.getElementById('tbl-' + key + '-' + period);
        if (!table) return;
        const sort = panel.querySelector('.cat-sort-btn.active')?.dataset.sort === 'nmv' ? 'nmv' : 'nsi';
        const rows = payload.rows.filter(row => row.panel === key && row.period === period).sort((a,b) => b[sort]-a[sort] || b.nsi-a.nsi || Number(a.item_id)-Number(b.item_id));
        const body = document.createElement('tbody');
        rows.forEach((row,index) => {
          const tr = document.createElement('tr');
          tr.dataset.nsi = row.nsi; tr.dataset.nmv = row.nmv;
          table.querySelectorAll('thead th').forEach(th => {
            const td = document.createElement('td');
            td.className = th.className;
            const label = th.textContent.trim();
            let value;
            if (label === '#') value = index + 1;
            else if (label === 'Item ID') { value = 'MLA' + row.item_id; td.className = 'col-id'; }
            else if (label === 'Titulo') { value = row.title || '—'; td.className = 'col-titulo'; }
            else if (label === 'Brand') value = row.brand || '—';
            else if (label === 'Seller') value = row.seller || '—';
            else if (label === 'Subcombo') value = row.subcombo || '—';
            else if (label === 'Precio') value = row.precio == null ? '—' : '$ ' + number(row.precio);
            else if (label === 'Stock disp.') value = number(row.stock ?? stocks.get(String(row.item_id)));
            else if (label.startsWith('vs ')) value = '—';
            else if (th.classList.contains('hs-val')) value = (sort === 'nmv' ? '$ ' : '') + number(row[sort]);
            else if (/Categor[ií]a|Tipo/.test(label)) value = row.categoria || '—';
            else value = attribute(label, row);
            td.textContent = value;
            tr.appendChild(td);
          });
          body.appendChild(tr);
        });
        if (!rows.length) {
          const tr = body.insertRow(); const td = tr.insertCell();
          td.colSpan = table.querySelectorAll('thead th').length; td.className = 'empty'; td.textContent = 'Sin ventas para este período';
        }
        table.tBodies[0].replaceWith(body);
        const metric = table.querySelector('thead .hs-val'); if (metric) metric.textContent = sort === 'nmv' ? 'NMV ($)' : 'NSI (u.)';
        const download = table.closest('.day-panel')?.querySelector('.dl-btn');
        if (download) download.onclick = () => dlCSV(table.id, key + '_' + period + '_' + payload.dates[period === '7d' ? 'ayer' : period] + '.csv');
        const button = Array.from(panel.querySelectorAll('.day-btn')).find(btn => btn.getAttribute('onclick')?.includes("'" + period + "'"));
        const tag = button?.querySelector('.date-tag');
        if (tag) tag.textContent = period === '7d' ? dateLabel(payload.dates.week_start) + '–' + dateLabel(payload.dates.ayer) : dateLabel(payload.dates[period]);
      });
    });
    loaded[payload.kind] = payload;
    document.querySelector('.header > p').textContent = 'Top 50 ítems por NSI · MercadoLibre Argentina';
    const previewNote = document.querySelector('.cat-tabs + .preview-note');
    if (previewNote) previewNote.textContent = loaded.daily && loaded.hoy ? 'Datos actualizados según los horarios indicados. Hot Sale: archivo histórico.' : 'Actualización parcial. Los períodos sin actualización conservan el snapshot ' + snapshot + '.';
    status.textContent = ['daily', 'hoy'].map(kind => loaded[kind] ? (kind === 'daily' ? 'Diario: ' : 'Hoy: ') + new Date(loaded[kind].generated_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires'}) : (kind === 'daily' ? 'Diario' : 'Hoy') + ': sin actualización conectada').join(' · ');
  }

  async function load(kind) {
    try {
      const response = await fetch('data/' + kind + '.json', {cache:'no-store'});
      if (!response.ok) throw Error('Actualización no disponible');
      const payload = await response.json(); validate(payload, kind); render(payload);
    } catch (error) {
      console.info('Ranking ' + kind + ': ' + error.message);
      if (!loaded[kind]) status.textContent = 'Vista previa: la conexión de actualizaciones está pendiente. Snapshot ' + snapshot + '.';
    }
  }
  load('daily').then(() => load('hoy'));
  setInterval(() => load('hoy'), 30 * 60 * 1000);
})();
