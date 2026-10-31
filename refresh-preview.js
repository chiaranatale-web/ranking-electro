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
  const comparison = window.RankingComparison;

  function updateMovement(tr, index, metric) {
    const td = tr.querySelector('.ranking-change');
    if (!td) return;
    const previous = tr.dataset[metric === 'nmv' ? 'previousRankNmv' : 'previousRankNsi'];
    const change = comparison.movement(index + 1, previous, tr.dataset.comparisonAvailable === 'true');
    const badge = document.createElement('span');
    badge.className = change.className;
    badge.textContent = change.text;
    td.replaceChildren(badge);
    td.title = change.title + ' · ' + tr.dataset.comparisonLabel;
  }

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
      for (const field of ['previous_rank_nsi', 'previous_rank_nmv']) {
        if (row[field] != null && (!Number.isInteger(row[field]) || row[field] < 1 || row[field] > 50)) throw Error('Ranking anterior inválido');
      }
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
        const rows = payload.rows.filter(row => row.panel === key && row.period === period).sort((a,b) => comparison.compare(a,b,sort));
        const daily = payload.kind === 'hoy' ? loaded.daily : null;
        const referenceAvailable = !!daily && daily.dates.hoy === payload.dates.hoy &&
          comparison.previousDay(daily.dates.ayer, payload.dates.hoy);
        const reference = referenceAvailable ? daily.rows.filter(row => row.panel === key && row.period === 'ayer') : [];
        const previousRanks = { nsi: comparison.ranks(reference, 'nsi'), nmv: comparison.ranks(reference, 'nmv') };
        const body = document.createElement('tbody');
        rows.forEach((row,index) => {
          const tr = document.createElement('tr');
          tr.dataset.nsi = row.nsi; tr.dataset.nmv = row.nmv;
          tr.dataset.itemId = row.item_id;
          tr.dataset.comparisonAvailable = String(payload.kind === 'hoy' ? referenceAvailable : row.comparison_available === true);
          tr.dataset.previousRankNsi = (payload.kind === 'hoy' ? previousRanks.nsi.get(String(row.item_id)) : row.previous_rank_nsi) ?? '';
          tr.dataset.previousRankNmv = (payload.kind === 'hoy' ? previousRanks.nmv.get(String(row.item_id)) : row.previous_rank_nmv) ?? '';
          tr.dataset.comparisonLabel = payload.kind === 'hoy' ? 'vs. ayer al cierre' : period === 'ayer' ? 'vs. anteayer' : 'vs. ventana de 7 días desplazada un día';
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
            else if (label.startsWith('vs ')) { value = ''; td.classList.add('ranking-change'); }
            else if (th.classList.contains('hs-val')) value = (sort === 'nmv' ? '$ ' : '') + number(row[sort]);
            else if (/Categor[ií]a|Tipo/.test(label)) value = row.categoria || '—';
            else value = attribute(label, row);
            td.textContent = value;
            tr.appendChild(td);
          });
          updateMovement(tr, index, sort);
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
    if (previewNote) previewNote.textContent = loaded.daily?.dates.hoy !== currentDay() ? 'Actualización diaria pendiente: Ayer y Últ. 7 días conservan las fechas indicadas en sus solapas.' : loaded.daily && loaded.hoy ? 'Datos actualizados según los horarios indicados. Hot Sale: archivo histórico.' : 'Actualización parcial. Los períodos sin actualización conservan el snapshot ' + snapshot + '.';
    status.textContent = ['daily', 'hoy'].map(kind => loaded[kind] ? (kind === 'daily' ? 'Diario: ' : 'Hoy: ') + new Date(loaded[kind].generated_at).toLocaleString('es-AR',{timeZone:'America/Argentina/Buenos_Aires',hourCycle:'h23'}) + (loaded[kind].dates.hoy !== currentDay() ? ' (atrasado)' : '') : (kind === 'daily' ? 'Diario' : 'Hoy') + ': sin actualización conectada').join(' · ');
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
  setInterval(() => load('daily').then(() => load('hoy')), 30 * 60 * 1000);

  // The original tab handler resets the active metric to NSI. Re-sort the
  // visible table too, so a previously selected NMV view cannot retain it.
  const originalSwitchDay = window.switchDay;
  const originalSortCatPanel = window.sortCatPanel;
  window.sortCatPanel = function (button, category) {
    originalSortCatPanel(button, category);
    const body = document.querySelector('#panel-' + category + ' .day-panel.active tbody');
    if (!body) return;
    const rows = Array.from(body.querySelectorAll('tr[data-comparison-available]'));
    rows.sort((a,b) => comparison.compare(a.dataset, b.dataset, button.dataset.sort));
    rows.forEach((tr,index) => {
      tr.querySelector('.col-rank').textContent = index + 1;
      tr.style.background = index % 2 ? '#fafafa' : '#fff';
      updateMovement(tr, index, button.dataset.sort);
      body.appendChild(tr);
    });
  };
  window.switchDay = function (button, category, day) {
    originalSwitchDay(button, category, day);
    const nsi = document.querySelector('#panel-' + category + ' .cat-sort-btn[data-sort="nsi"]');
    if (nsi) sortCatPanel(nsi, category);
  };
})();
