const STORAGE_KEY = "sqlKnowledgeHub.items.v1";

const $ = (id) => document.getElementById(id);
const form = $("queryForm");
const queryList = $("queryList");
const emptyState = $("emptyState");
let items = loadItems();
let toastTimer;

function loadItems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not read saved items:", error);
    return [];
  }
}

function persistItems() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    return true;
  } catch (error) {
    showToast("Could not save. Export a backup and remove large items.");
    console.error(error);
    return false;
  }
}

function makeId() {
  return (window.crypto && crypto.randomUUID)
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getFormItem() {
  return {
    id: $("itemId").value || makeId(),
    title: $("titleInput").value.trim(),
    category: $("categoryInput").value,
    database: $("databaseInput").value,
    tags: $("tagsInput").value.split(",").map(tag => tag.trim()).filter(Boolean),
    description: $("descriptionInput").value.trim(),
    code: $("codeInput").value,
    favorite: $("favoriteInput").checked,
    updatedAt: new Date().toISOString()
  };
}

function resetForm() {
  form.reset();
  $("itemId").value = "";
  $("formHeading").textContent = "Add a saved item";
  $("saveBtn").textContent = "Save item";
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const item = getFormItem();
  if (!item.title) {
    showToast("Please enter a title.");
    $("titleInput").focus();
    return;
  }
  const index = items.findIndex(existing => existing.id === item.id);
  if (index >= 0) {
    items[index] = { ...items[index], ...item };
    showToast(persistItems() ? "Changes saved." : "Save failed.");
  } else {
    item.createdAt = item.updatedAt;
    items.unshift(item);
    showToast(persistItems() ? "Item saved to this browser." : "Save failed.");
  }
  resetForm();
  render();
});

$("resetFormBtn").addEventListener("click", resetForm);

function editItem(id) {
  const item = items.find(entry => entry.id === id);
  if (!item) return;
  $("itemId").value = item.id;
  $("titleInput").value = item.title || "";
  $("categoryInput").value = item.category || "Other";
  $("databaseInput").value = item.database || "General SQL";
  $("tagsInput").value = (item.tags || []).join(", ");
  $("descriptionInput").value = item.description || "";
  $("codeInput").value = item.code || "";
  $("favoriteInput").checked = Boolean(item.favorite);
  $("formHeading").textContent = "Edit saved item";
  $("saveBtn").textContent = "Update item";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function deleteItem(id) {
  const item = items.find(entry => entry.id === id);
  if (!item || !confirm(`Delete "${item.title}"? This cannot be undone unless you have a backup.`)) return;
  items = items.filter(entry => entry.id !== id);
  persistItems();
  render();
  showToast("Item deleted.");
}

function toggleFavorite(id) {
  items = items.map(item => item.id === id ? { ...item, favorite: !item.favorite } : item);
  persistItems();
  render();
}

async function copyCode(id) {
  const item = items.find(entry => entry.id === id);
  if (!item) return;
  const text = item.code || "";
  if (!text) {
    showToast("This item has no code to copy.");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    showToast("Code copied.");
  } catch {
    const temp = document.createElement("textarea");
    temp.value = text;
    document.body.appendChild(temp);
    temp.select();
    const success = document.execCommand("copy");
    temp.remove();
    showToast(success ? "Code copied." : "Copy failed. Select and copy the code manually.");
  }
}

function getFilteredItems() {
  const query = $("searchInput").value.trim().toLowerCase();
  const category = $("categoryFilter").value;
  const favoritesOnly = $("favoritesOnly").checked;
  return items.filter(item => {
    const searchable = [
      item.title, item.category, item.database, item.description, item.code,
      ...(item.tags || [])
    ].join(" ").toLowerCase();
    return (!query || searchable.includes(query))
      && (!category || item.category === category)
      && (!favoritesOnly || item.favorite);
  }).sort((a, b) => {
    if (Boolean(a.favorite) !== Boolean(b.favorite)) return a.favorite ? -1 : 1;
    return new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0);
  });
}

function renderCategoryFilter() {
  const select = $("categoryFilter");
  const current = select.value;
  const categories = [...new Set(items.map(item => item.category).filter(Boolean))].sort();
  select.innerHTML = '<option value="">All categories</option>' +
    categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
  if (categories.includes(current)) select.value = current;
}

function render() {
  renderCategoryFilter();
  $("totalCount").textContent = items.length;
  $("favoriteCount").textContent = items.filter(item => item.favorite).length;
  $("categoryCount").textContent = new Set(items.map(item => item.category).filter(Boolean)).size;

  const filtered = getFilteredItems();
  $("resultsLabel").textContent = `${filtered.length} ${filtered.length === 1 ? "item" : "items"}`;
  queryList.innerHTML = filtered.map(item => {
    const tags = (item.tags || []).map(tag => `<span class="pill tag">${escapeHTML(tag)}</span>`).join("");
    const description = item.description ? `<p class="description">${escapeHTML(item.description)}</p>` : "";
    const code = item.code ? `<pre class="code-block"><code>${escapeHTML(item.code)}</code></pre>` : "";
    return `
      <article class="query-card">
        <div class="card-top">
          <div>
            <h3 class="card-title">${escapeHTML(item.title)}</h3>
            <div class="meta">
              <span class="pill">${escapeHTML(item.category || "Other")}</span>
              <span class="pill database">${escapeHTML(item.database || "General SQL")}</span>
              ${tags}
            </div>
          </div>
          <button class="icon-button ${item.favorite ? "is-favorite" : ""}" data-action="favorite" data-id="${escapeHTML(item.id)}" title="${item.favorite ? "Remove favorite" : "Add favorite"}" aria-label="Toggle favorite">${item.favorite ? "★" : "☆"}</button>
        </div>
        ${description}
        ${code}
        <div class="card-actions">
          ${item.code ? `<button class="button button-secondary" data-action="copy" data-id="${escapeHTML(item.id)}">Copy code</button>` : ""}
          <button class="button button-secondary" data-action="edit" data-id="${escapeHTML(item.id)}">Edit</button>
          <button class="button button-quiet" data-action="delete" data-id="${escapeHTML(item.id)}">Delete</button>
        </div>
      </article>`;
  }).join("");
  emptyState.classList.toggle("visible", filtered.length === 0);
  if (filtered.length === 0) {
    emptyState.querySelector("h3").textContent = items.length ? "No matching items" : "No saved items yet";
    emptyState.querySelector("p").textContent = items.length
      ? "Try another search or category filter."
      : "Add your first query using the form. You can also load a sample to try the features.";
  }
}

queryList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  if (action === "edit") editItem(id);
  if (action === "delete") deleteItem(id);
  if (action === "favorite") toggleFavorite(id);
  if (action === "copy") copyCode(id);
});

$("searchInput").addEventListener("input", render);
$("categoryFilter").addEventListener("change", render);
$("favoritesOnly").addEventListener("change", render);

$("exportBtn").addEventListener("click", () => {
  const backup = {
    app: "SQL Knowledge Hub",
    version: 1,
    exportedAt: new Date().toISOString(),
    items
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `sql-knowledge-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showToast("Backup exported.");
});

$("importBtn").addEventListener("click", () => $("importFile").click());
$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    const imported = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(imported)) throw new Error("This file does not contain a list of saved items.");
    const validItems = imported.filter(item => item && typeof item.title === "string");
    if (!validItems.length && imported.length) throw new Error("No valid items were found.");
    if (!confirm(`Import ${validItems.length} items? Choose OK to merge them with your current library.`)) return;
    const existingIds = new Set(items.map(item => item.id));
    for (const item of validItems) {
      const safeItem = {
        id: item.id && !existingIds.has(item.id) ? item.id : makeId(),
        title: String(item.title).slice(0, 120),
        category: String(item.category || "Other"),
        database: String(item.database || "General SQL"),
        tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
        description: String(item.description || ""),
        code: String(item.code || ""),
        favorite: Boolean(item.favorite),
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      };
      items.push(safeItem);
      existingIds.add(safeItem.id);
    }
    persistItems();
    render();
    showToast(`Imported ${validItems.length} items.`);
  } catch (error) {
    alert(`Could not import backup: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

$("sampleBtn").addEventListener("click", () => {
  $("titleInput").value = "Find duplicate values";
  $("categoryInput").value = "SQL Queries";
  $("databaseInput").value = "General SQL";
  $("tagsInput").value = "duplicates, GROUP BY, HAVING";
  $("descriptionInput").value = "Find values that appear more than once. Replace CustomerCode with the column you need to check.";
  $("codeInput").value = `SELECT CustomerCode, COUNT(*) AS DuplicateCount\nFROM Customers\nGROUP BY CustomerCode\nHAVING COUNT(*) > 1;`;
  $("favoriteInput").checked = true;
  showToast("Sample loaded. Click Save item to keep it.");
});

render();
