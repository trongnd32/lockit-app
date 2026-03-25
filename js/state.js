export let state = {
  activeCategory: '__ALL__',
  sortCol: null,
  sortDir: 'asc',
  filters: {},
  globalSearch: '',
  editingId: null,
  hiddenCols: new Set(),
  colWidths: {},   // col key -> px width
};
