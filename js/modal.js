// ── Modal helpers ────────────────────────────────────────────────────────────

function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="closeModal(event)">${html}</div>`;
}

function closeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay')) {
    document.getElementById('modal-root').innerHTML = '';
  }
}

function closeModalForce() {
  document.getElementById('modal-root').innerHTML = '';
}
