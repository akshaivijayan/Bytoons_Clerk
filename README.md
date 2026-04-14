# Bytoons Clerk

A dynamic PDF form autofill web app. Upload any PDF with form fields, review extracted fields, edit a JSON template, and download a clean filled PDF.

## Features
- Upload PDF forms (AcroForm)
- Extract field names and options
- Generate editable JSON templates
- Fill and download flattened PDFs
- Aurora-style animated background

## Setup
```bash
npm install
npm start
```

Then open http://localhost:3000

## Usage
1. Upload a PDF on the landing page.
2. Click **Fill The Form** to continue.
3. Edit the JSON template and click **Generate Filled PDF**.

## Tech
- Node.js + Express
- pdf-lib
- Multer

## Notes
- Uploaded files are stored in `uploads/` and should not be committed.
