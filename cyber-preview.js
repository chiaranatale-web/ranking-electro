(function () {
  'use strict';
  const panel = document.getElementById('panel-hotsale');
  if (!panel) return;
  const start = '2026-11-02', end = '2026-11-11';
  const dayDate = day => '2026-11-' + String(day + 1).padStart(2, '0');
  const label = date => date.slice(8) + '/' + date.slice(5, 7);
  const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const number = value => value == null ? '—' : Math.round(value).toLocaleString('es-AR');
  const mainButton = document.querySelector('[data-cat="hotsale"]');
  if (mainButton) mainButton.textContent = 'Cyber Monday';
  panel.querySelector('.hs-period-title').textContent = 'Cyber Monday · 02/11–11/11/2026';
  const note = document.createElement('p');
  note.className = 'preview-note';
  panel.querySelector('.hs-period-bar').after(note);
  const template = panel.querySelector('#hsd-acum');
  // Remove every historical row before cloning the structure for the new event.
  template.querySelectorAll('tbody').forEach(body => body.replaceChildren());
  template.querySelectorAll('.hs-cat-btn').forEach(button => {
    button.classList.toggle('active', button.dataset.hscat === 'grp-total');
    button.style.color = ''; button.style.borderBottomColor = 'transparent';
  });
  template.querySelectorAll('.hs-cat-panel').forEach(category => category.classList.toggle('active', category.id === 'hsd-acum-grp-total'));
  panel.querySelectorAll('.hs-day-panel:not(#hsd-acum)').forEach(node => node.remove());
  const bar = panel.querySelector('.hs-day-bar');
  bar.querySelectorAll('[data-hsday]:not([data-hsday="acum"])').forEach(node => node.remove());
  for (let day = 1; day <= 10; day++) {
    const key = 'd' + day;
    const button = document.createElement('button');
    button.className = 'hs-day-btn'; button.dataset.hsday = key;
    button.setAttribute('onclick', 'switchHSDay(this)');
    button.textContent = 'D' + day + ' ';
    const tag = document.createElement('span'); tag.className = 'date-tag'; tag.textContent = label(dayDate(day));
    button.append(tag); bar.append(button);
    const copy = template.cloneNode(true);
    copy.id = 'hsd-' + key; copy.classList.remove('active');
    copy.querySelectorAll('[id]').forEach(node => { node.id = node.id.replace('acum', key); });
    copy.querySelectorAll('[onclick]').forEach(node => { node.setAttribute('onclick', node.getAttribute('onclick').replaceAll('acum', key)); });
    panel.append(copy);
  }
  panel.querySelectorAll('.hs-cat-tabs').forEach(tabs => {
    const menu = document.createElement('details'); menu.className = 'category-more';
    const summary = document.createElement('summary'); summary.textContent = 'Categorías';
    const list = document.createElement('div'); list.className = 'category-menu';
    tabs.querySelectorAll('.hs-cat-btn').forEach(button => {
      if (button.dataset.hscat.startsWith('grp-')) return;
      list.append(button); button.addEventListener('click', () => { menu.open = false; summary.textContent = button.textContent; });
    });
    menu.append(summary, list); tabs.querySelector('.tab-separator')?.remove(); tabs.append(menu);
  });
  let latest;
  const emptyMessage = key => {
    if (today() < start) return 'Aún no comenzó. Cyber Monday: 2 al 11 de noviembre de 2026.';
    if (key !== 'acum' && dayDate(Number(key.slice(1))) >= today()) return dayDate(Number(key.slice(1))) === today() ? 'Día en curso. Se publicará al cierre, en la actualización diaria de las 09:00.' : 'Este día aún no comenzó.';
    if (!latest?.event?.through_date || (key !== 'acum' && dayDate(Number(key.slice(1))) > latest.event.through_date)) return 'Actualización de Cyber Monday pendiente.';
    return 'Sin ventas para este período y categoría.';
  };
  function render(payload) {
    if (payload) latest = payload;
    const metric = panel.querySelector('.sort-btn.active')?.dataset.sort || 'nsi';
    panel.querySelectorAll('.hs-day-panel').forEach(dayPanel => {
      const key = dayPanel.id.replace('hsd-', '');
      const period = 'cyber_' + key;
      dayPanel.querySelectorAll('.hs-cat-panel').forEach(categoryPanel => {
        const category = categoryPanel.id.replace('hsd-' + key + '-', '');
        const table = categoryPanel.querySelector('table');
        const rows = (latest?.rows || []).filter(row => row.period === period && row.panel === category)
          .sort((a,b) => window.RankingComparison.compare(a,b,metric));
        const body = document.createElement('tbody');
        rows.forEach((row,index) => {
          const tr = body.insertRow(); tr.dataset.nsi = row.nsi; tr.dataset.nmv = row.nmv;
          table.querySelectorAll('thead th').forEach(th => {
            const td = tr.insertCell(); td.className = th.className;
            const heading = th.textContent.trim();
            let value = '—';
            if (heading === '#') value = index + 1;
            else if (heading === 'Item ID') value = 'MLA' + row.item_id;
            else if (heading === 'Titulo') value = row.title;
            else if (heading === 'Brand') value = row.brand;
            else if (heading === 'Seller') value = row.seller;
            else if (heading === 'Subcombo') value = row.subcombo;
            else if (/Categor[ií]a|Tipo/.test(heading)) value = row.categoria;
            else if (heading.startsWith('Precio')) value = '$ ' + number(row.precio);
            else if (heading === 'Stock disp.') value = number(row.stock);
            else if (th.classList.contains('hs-val')) value = (metric === 'nmv' ? '$ ' : '') + number(row[metric]);
            td.textContent = value || '—';
          });
        });
        if (!rows.length) { const td = body.insertRow().insertCell(); td.colSpan = table.querySelectorAll('th').length; td.className = 'empty'; td.textContent = emptyMessage(key); }
        table.tBodies[0].replaceWith(body);
        const download = categoryPanel.querySelector('.dl-btn');
        if (download) { download.removeAttribute('onclick'); download.onclick = () => dlCSV(table.id, 'CyberMonday2026_' + key + '_' + category + '.csv'); download.disabled = !rows.length; }
        const heading = table.querySelector('.hs-val'); if (heading) heading.textContent = metric === 'nsi' ? 'NSI (u.)' : 'NMV ($)';
      });
    });
    note.textContent = today() < start ? 'Aún no comenzó · 2 al 11 de noviembre de 2026, inclusive.' :
      latest?.event?.through_date ? 'Días cerrados hasta el ' + label(latest.event.through_date) + ' · actualización diaria a las 09:00 (Argentina).' : 'Actualización de Cyber Monday pendiente.';
  }
  window.CyberMonday = { render };
  const originalDay = window.switchHSDay;
  window.switchHSDay = function (button) { originalDay(button); render(); };
  const originalSort = window.sortHS;
  window.sortHS = function (button) { originalSort(button); render(); };
  render();
})();
