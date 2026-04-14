const fieldListEl = document.getElementById('fieldList');
const statusTextEl = document.getElementById('statusText');
const loadBtn = document.getElementById('loadFields');
const loadTemplateBtn = document.getElementById('loadTemplate');
const searchInput = document.getElementById('fieldSearch');
const jsonInput = document.getElementById('jsonInput');
const fillBtn = document.getElementById('fillBtn');
const clearBtn = document.getElementById('clearBtn');
const flattenToggle = document.getElementById('flatten');
const messageEl = document.getElementById('message');

const params = new URLSearchParams(window.location.search);
const fileId = params.get('fileId');

let allFields = [];

function setStatus(text) {
  statusTextEl.textContent = text;
}

function setMessage(text, tone = 'info') {
  messageEl.textContent = text;
  messageEl.className = `message ${tone}`;
}

function renderFields(list) {
  fieldListEl.innerHTML = '';
  if (!list.length) {
    fieldListEl.innerHTML = '<div class="empty">No fields loaded.</div>';
    return;
  }
  for (const field of list) {
    const item = document.createElement('div');
    item.className = 'field-item';
    item.innerHTML = `
      <div>
        <div class="field-name">${field.name}</div>
        <div class="field-type">${field.type}${field.options?.length ? ` · ${field.options.join(', ')}` : ''}</div>
      </div>
      <button class="copy" data-name="${field.name}">Copy</button>
    `;
    fieldListEl.appendChild(item);
  }

  fieldListEl.querySelectorAll('.copy').forEach((btn) => {
    btn.addEventListener('click', () => {
      const name = btn.getAttribute('data-name');
      navigator.clipboard.writeText(name).then(() => {
        setMessage(`Copied field name: ${name}`, 'success');
      });
    });
  });
}

async function loadFields() {
  if (!fileId) {
    setStatus('Error');
    setMessage('Missing fileId. Please upload a PDF first.', 'error');
    return;
  }
  setStatus('Loading...');
  setMessage('');
  try {
    const res = await fetch(`/api/fields?fileId=${encodeURIComponent(fileId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load fields');
    allFields = data.fields || [];
    renderFields(allFields);
    setStatus('Loaded');
  } catch (err) {
    setStatus('Error');
    setMessage(err.message, 'error');
  }
}

async function loadTemplate() {
  if (!fileId) {
    setStatus('Error');
    setMessage('Missing fileId. Please upload a PDF first.', 'error');
    return;
  }
  setStatus('Loading template...');
  setMessage('');
  try {
    const res = await fetch(`/api/template?fileId=${encodeURIComponent(fileId)}`);
    if (!res.ok) throw new Error('Template not available');
    const data = await res.json();
    jsonInput.value = JSON.stringify(data, null, 2);
    setStatus('Template loaded');
    setMessage('Template JSON loaded. Fill in your values and generate the PDF.', 'success');
  } catch (err) {
    setStatus('Error');
    setMessage('Failed to load template JSON.', 'error');
  }
}

loadBtn.addEventListener('click', loadFields);
loadTemplateBtn.addEventListener('click', loadTemplate);

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim().toLowerCase();
  if (!term) {
    renderFields(allFields);
    return;
  }
  const filtered = allFields.filter((field) => field.name.toLowerCase().includes(term));
  renderFields(filtered);
});

clearBtn.addEventListener('click', () => {
  jsonInput.value = '{}';
  setMessage('Cleared JSON payload.', 'info');
});

fillBtn.addEventListener('click', async () => {
  if (!fileId) {
    setStatus('Error');
    setMessage('Missing fileId. Please upload a PDF first.', 'error');
    return;
  }
  setStatus('Filling...');
  setMessage('');
  let payload;
  try {
    payload = JSON.parse(jsonInput.value);
  } catch (err) {
    setStatus('Error');
    setMessage('Invalid JSON. Please fix the JSON payload.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/fill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileId, values: payload, flatten: flattenToggle.checked }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to fill PDF');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'filled.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    setStatus('Done');
    setMessage('PDF generated successfully.', 'success');
  } catch (err) {
    setStatus('Error');
    setMessage(err.message, 'error');
  }
});

renderFields([]);
loadFields();
loadTemplate();
