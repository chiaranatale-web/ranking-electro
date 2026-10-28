(function () {
  var tabs = document.querySelector('.cat-tabs');
  if (!tabs) return;

  var categoryButtons = Array.from(tabs.querySelectorAll('.tab-btn:not(.grp-btn)'));
  if (!categoryButtons.length) return;

  var menu = document.createElement('details');
  menu.className = 'category-more';
  var summary = document.createElement('summary');
  var title = document.createElement('span');
  var count = document.createElement('span');
  count.className = 'category-count';
  count.textContent = categoryButtons.length;
  title.textContent = 'Categorías';
  summary.append(title, count);
  menu.appendChild(summary);

  var list = document.createElement('div');
  list.className = 'category-menu';
  categoryButtons.forEach(function (button) {
    list.appendChild(button);
    button.addEventListener('click', function () {
      menu.open = false;
      var label = button.textContent.trim();
      title.textContent = label || 'Categorías';
      count.textContent = 'Cambiar';
      count.setAttribute('aria-label', 'Cambiar categoría');
    });
  });
  menu.appendChild(list);

  var separator = tabs.querySelector('.tab-separator');
  if (separator) separator.replaceWith(menu);
  else tabs.appendChild(menu);

  var note = document.createElement('div');
  note.className = 'preview-note';
  var snapshot = document.querySelector('.header p')?.textContent.match(/Generado:\s*([^·]+)/)?.[1]?.trim();
  note.textContent = 'Vista previa de diseño · snapshot ' + (snapshot || 'sin fecha identificada');
  tabs.insertAdjacentElement('afterend', note);

  var total = tabs.querySelector('.grp-btn[data-cat="grp-total"]');
  if (total) total.click();
})();
