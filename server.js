const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const fssync = require('fs');
const multer = require('multer');
const {
  PDFDocument,
  PDFTextField,
  PDFCheckBox,
  PDFRadioGroup,
  PDFDropdown,
  PDFOptionList,
  PDFButton,
  PDFSignature,
  StandardFonts,
} = require('pdf-lib');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fssync.existsSync(UPLOAD_DIR)) {
  fssync.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const uploads = new Map(); // fileId -> { path, originalName, createdAt }

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

function getFieldType(field) {
  if (field instanceof PDFTextField) return 'text';
  if (field instanceof PDFCheckBox) return 'checkbox';
  if (field instanceof PDFRadioGroup) return 'radio';
  if (field instanceof PDFDropdown) return 'dropdown';
  if (field instanceof PDFOptionList) return 'option-list';
  if (field instanceof PDFButton) return 'button';
  if (field instanceof PDFSignature) return 'signature';
  return 'unknown';
}

function extractFieldValue(field, type) {
  try {
    if (type === 'text') return field.getText();
    if (type === 'checkbox') return field.isChecked();
    if (type === 'radio') return field.getSelected();
    if (type === 'dropdown' || type === 'option-list') return field.getSelected();
  } catch (err) {
    return undefined;
  }
  return undefined;
}

function truthy(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return ['true', 'yes', 'y', 'on', '1', 'checked'].includes(v);
  }
  return false;
}

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

async function loadPdfById(fileId) {
  const entry = uploads.get(fileId);
  if (!entry) {
    const err = new Error('Unknown fileId');
    err.status = 404;
    throw err;
  }
  const bytes = await fs.readFile(entry.path);
  return PDFDocument.load(bytes);
}

app.post('/api/upload', upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF uploaded' });
    }
    const fileId = generateId();
    uploads.set(fileId, {
      path: req.file.path,
      originalName: req.file.originalname,
      createdAt: Date.now(),
    });
    res.json({ fileId, filename: req.file.originalname });
  } catch (err) {
    res.status(500).json({ error: 'Upload failed', detail: err.message });
  }
});

app.use((err, req, res, next) => {
  if (!err) return next();
  const status = err.status || 400;
  res.status(status).json({ error: err.message || 'Upload failed' });
});

app.get('/api/fields', async (req, res) => {
  try {
    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

    const pdfDoc = await loadPdfById(fileId);
    const form = pdfDoc.getForm();
    const fields = form.getFields().map((field) => {
      const type = getFieldType(field);
      const entry = {
        name: field.getName(),
        type,
      };

      if (type === 'dropdown' || type === 'option-list' || type === 'radio') {
        try {
          entry.options = field.getOptions();
        } catch (err) {
          entry.options = [];
        }
      }

      return entry;
    });

    res.json({ count: fields.length, fields });
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Failed to read form fields', detail: err.message });
  }
});

app.get('/api/template', async (req, res) => {
  try {
    const { fileId } = req.query;
    if (!fileId) return res.status(400).json({ error: 'Missing fileId' });

    const pdfDoc = await loadPdfById(fileId);
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    const template = {};

    for (const field of fields) {
      const type = getFieldType(field);
      const name = field.getName();
      const currentValue = extractFieldValue(field, type);
      if (currentValue !== undefined && currentValue !== null && currentValue !== '') {
        template[name] = currentValue;
      } else if (type === 'checkbox') {
        template[name] = false;
      } else {
        template[name] = '';
      }
    }

    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(JSON.stringify(template, null, 2));
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Failed to load template', detail: err.message });
  }
});

app.post('/api/fill', async (req, res) => {
  try {
    const { fileId, values, flatten } = req.body || {};
    if (!fileId) {
      return res.status(400).json({ error: 'Missing "fileId" in request body.' });
    }
    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Missing or invalid "values" object in request body.' });
    }

    const pdfDoc = await loadPdfById(fileId);
    const form = pdfDoc.getForm();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const fields = form.getFields();
    const fieldByName = new Map(fields.map((f) => [f.getName(), f]));

    for (const [name, value] of Object.entries(values)) {
      const field = fieldByName.get(name);
      if (!field) continue;

      const type = getFieldType(field);
      try {
        if (type === 'text') {
          field.setText(value == null ? '' : String(value));
        } else if (type === 'checkbox') {
          if (truthy(value)) field.check();
          else field.uncheck();
        } else if (type === 'radio') {
          field.select(String(value));
        } else if (type === 'dropdown' || type === 'option-list') {
          field.select(String(value));
        }
      } catch (err) {
        // ignore individual field errors
      }
    }

    form.updateFieldAppearances(font);
    if (truthy(flatten)) {
      form.flatten();
    }

    const pdfBytes = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="filled.pdf"');
    res.status(200).send(Buffer.from(pdfBytes));
  } catch (err) {
    res.status(err.status || 500).json({ error: 'Failed to fill PDF', detail: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`PDF form filler running at http://localhost:${PORT}`);
});
