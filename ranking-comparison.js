(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.RankingComparison = api;
})(typeof window === 'undefined' ? globalThis : window, function () {
  'use strict';
  function compare(a, b, metric) {
    const other = metric === 'nmv' ? 'nsi' : 'nmv';
    return Number(b[metric]) - Number(a[metric]) || Number(b[other]) - Number(a[other]) ||
      Number(a.item_id ?? a.itemId) - Number(b.item_id ?? b.itemId);
  }
  function ranks(rows, metric) {
    return new Map(rows.slice().sort((a, b) => compare(a, b, metric))
      .map((row, index) => [String(row.item_id), index + 1]));
  }
  function previousDay(reference, day) {
    return /^\d{4}-\d{2}-\d{2}$/.test(reference || '') && /^\d{4}-\d{2}-\d{2}$/.test(day || '') &&
      Date.parse(day + 'T00:00:00Z') - Date.parse(reference + 'T00:00:00Z') === 86400000;
  }
  function movement(currentRank, previousRank, available) {
    if (!available) return { text: '—', className: 'eq', title: 'Comparación no disponible para este período' };
    if (previousRank == null || previousRank === '') {
      return { text: 'NEW', className: 'badge-new', title: 'Entró al Top 50 respecto del ranking anterior' };
    }
    const delta = Number(previousRank) - Number(currentRank);
    if (!delta) return { text: '—', className: 'eq', title: 'Sin cambio de posición' };
    return { text: (delta > 0 ? '▲ ' : '▼ ') + Math.abs(delta), className: delta > 0 ? 'up' : 'dn',
      title: (delta > 0 ? 'Subió ' : 'Bajó ') + Math.abs(delta) + ' posiciones' };
  }
  return { compare, ranks, previousDay, movement };
});
