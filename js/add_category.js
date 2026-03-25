import { db } from './store.js';
import { closeModalForce, showModal } from './modal.js';
import { renderTable } from './render.js';
import { setStatus } from './utils.js';

export function openAddCategory() {
  showModal(`
    <div class="modal modal-sm" onclick="event.stopPropagation()">
      <div class="modal-title">Add Category</div>
      <div class="form-group" style="margin-top:12px">
        <label class="form-label">Category Name</label>
        <input type="text" class="form-input" id="new-cat-name" placeholder="e.g. skills, dialogue, items..." autofocus>
      </div>
      <div class="modal-actions">
        <button class="btn btn-ghost" onclick="closeModalForce()">Cancel</button>
        <button class="btn btn-primary" onclick="addCategory()">Add</button>
      </div>
    </div>
  `);
  setTimeout(() => document.getElementById('new-cat-name')?.focus(), 50);
}

export function addCategory() {
  const name = document.getElementById('new-cat-name').value.trim().toLowerCase().replace(/\s+/g,'_');
  if (!name) return;
  db.categories.add(name);
  closeModalForce();
  renderTable();
  setStatus(`Category added: ${name}`);
}

window.openAddCategory = openAddCategory;
window.addCategory = addCategory;
