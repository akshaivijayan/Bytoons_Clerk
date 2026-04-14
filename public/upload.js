const statusTextEl = document.getElementById('statusText');
const messageEl = document.getElementById('message');
const fileInput = document.getElementById('pdfFile');
const fillBtn = document.getElementById('fillBtn');
const landingBox = document.querySelector('.landing-box');

function setStatus(text) {
  if (statusTextEl) statusTextEl.textContent = text;
}

function setMessage(text, tone = 'info') {
  messageEl.textContent = text;
  messageEl.className = `message ${tone}`;
}

fileInput.addEventListener('change', () => {
  const hasFile = !!fileInput.files[0];
  fillBtn.disabled = !hasFile;
  if (hasFile) {
    setMessage('PDF selected. Click "Fill The Form" to continue.', 'info');
  } else {
    setMessage('');
  }
});

landingBox.addEventListener('click', (event) => {
  if (event.target.closest('#fillBtn')) return;
  fileInput.click();
});

landingBox.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});

fillBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    setMessage('Please choose a PDF file first.', 'error');
    return;
  }

  setStatus('Uploading...');
  setMessage('');
  fillBtn.disabled = true;

  const formData = new FormData();
  formData.append('pdf', file);

  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    const contentType = res.headers.get('content-type') || '';
    let data = null;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      const text = await res.text();
      throw new Error(`Upload failed (${res.status}). ${text.slice(0, 120)}`);
    }

    if (!res.ok) throw new Error(data.error || 'Upload failed');

    setStatus('Uploaded');
    setMessage('Upload successful. Redirecting...', 'success');
    window.location.href = `/fill.html?fileId=${encodeURIComponent(data.fileId)}`;
  } catch (err) {
    setStatus('Error');
    setMessage(err.message, 'error');
    fillBtn.disabled = false;
  }
});
