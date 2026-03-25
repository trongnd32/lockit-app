export function showModal(html) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-overlay" onclick="closeModal(event)">${html}</div>`;
}

export function closeModal(e) {
  if (!e || e.target.classList.contains('modal-overlay')) {
    document.getElementById('modal-root').innerHTML = '';
  }
}

export function closeModalForce() {
  document.getElementById('modal-root').innerHTML = '';
}

window.showModal = showModal;
window.closeModal = closeModal;
window.closeModalForce = closeModalForce;
