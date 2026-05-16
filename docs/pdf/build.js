#!/usr/bin/env node
/**
 * Convierte los .md de docs/ a PDFs estilizados.
 * Pipeline: marked (MD -> HTML) + plantilla CSS + Edge headless print-to-pdf.
 * Uso: node docs/pdf/build.js
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let marked;
try {
    marked = require('marked');
} catch {
    console.error('Falta marked. Instalando localmente...');
    execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-save', 'marked@12'], {
        cwd: __dirname,
        stdio: 'inherit',
    });
    marked = require('marked');
}

const EDGE_CANDIDATES = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];
const browser = EDGE_CANDIDATES.find((p) => fs.existsSync(p));
if (!browser) throw new Error('No se encontro Edge ni Chrome.');

const docsDir = path.resolve(__dirname, '..');
const outDir = __dirname;

const FILES = [
    { md: 'BITACORA.md', pdf: 'BITACORA.pdf', titulo: 'Cuaderno de Bitácora', subtitulo: 'TFG DAM — Stockly' },
    { md: 'ROADMAP.md', pdf: 'ROADMAP.pdf', titulo: 'Roadmap del Proyecto', subtitulo: 'TFG DAM — Stockly' },
    { md: 'mobile.md', pdf: 'manual-movil.pdf', titulo: 'Manual — Versión Móvil', subtitulo: 'TFG DAM — Stockly' },
    { md: 'hosting.md', pdf: 'manual-hosting.pdf', titulo: 'Manual — Despliegue y Hosting', subtitulo: 'TFG DAM — Stockly' },
];

const css = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
body {
    font-family: 'Segoe UI', 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.55;
    color: #1f2937;
    max-width: 760px;
    margin: 0 auto;
    padding: 2.5em 1em 3em;
    font-size: 11pt;
}
.cover {
    page-break-after: always;
    text-align: center;
    padding-top: 28vh;
}
.cover h1 {
    font-size: 36pt;
    margin: 0 0 .25em;
    color: #0f172a;
    border: none;
}
.cover .sub {
    font-size: 14pt;
    color: #64748b;
    margin-bottom: 3em;
}
.cover .meta {
    font-size: 10pt;
    color: #94a3b8;
}
h1, h2, h3, h4 {
    color: #0f172a;
    margin-top: 1.6em;
    margin-bottom: .5em;
    line-height: 1.25;
    page-break-after: avoid;
}
h1 { font-size: 22pt; border-bottom: 2px solid #e2e8f0; padding-bottom: .25em; }
h2 { font-size: 16pt; border-bottom: 1px solid #e2e8f0; padding-bottom: .2em; }
h3 { font-size: 13pt; }
h4 { font-size: 11pt; color: #334155; }
p { margin: .6em 0; }
a { color: #2563eb; text-decoration: none; }
ul, ol { margin: .5em 0 .8em 1.5em; }
li { margin: .15em 0; }
code {
    font-family: 'Cascadia Mono', 'Consolas', 'Courier New', monospace;
    background: #f1f5f9;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: .9em;
    color: #be185d;
}
pre {
    background: #0f172a;
    color: #e2e8f0;
    padding: .9em 1em;
    border-radius: 6px;
    overflow-x: auto;
    font-size: 9pt;
    line-height: 1.45;
    page-break-inside: avoid;
}
pre code { background: transparent; color: inherit; padding: 0; }
blockquote {
    border-left: 4px solid #94a3b8;
    background: #f8fafc;
    margin: 1em 0;
    padding: .5em 1em;
    color: #475569;
}
table {
    border-collapse: collapse;
    width: 100%;
    margin: 1em 0;
    font-size: 9.5pt;
    page-break-inside: avoid;
}
th, td {
    border: 1px solid #cbd5e1;
    padding: .35em .6em;
    text-align: left;
    vertical-align: top;
}
th { background: #f1f5f9; font-weight: 600; }
tr:nth-child(even) td { background: #fafafa; }
hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.6em 0; }
img { max-width: 100%; }
.footer-meta {
    text-align: center;
    color: #94a3b8;
    font-size: 9pt;
    margin-top: 2em;
    border-top: 1px solid #e2e8f0;
    padding-top: 1em;
}
@page { margin: 18mm 14mm; size: A4; }
`;

const today = new Date().toISOString().slice(0, 10);

for (const f of FILES) {
    const mdPath = path.join(docsDir, f.md);
    if (!fs.existsSync(mdPath)) {
        console.warn(`[skip] ${f.md} no existe`);
        continue;
    }
    const md = fs.readFileSync(mdPath, 'utf8');
    const body = marked.parse(md, { gfm: true, breaks: false });

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>${f.titulo}</title>
<style>${css}</style>
</head>
<body>
<div class="cover">
    <h1>${f.titulo}</h1>
    <div class="sub">${f.subtitulo}</div>
    <div class="meta">Adrián Bravo Santos · Miguel Ángel Florido<br>Generado el ${today}</div>
</div>
${body}
<div class="footer-meta">Stockly · TFG DAM 2025-2026</div>
</body>
</html>`;

    const htmlFile = path.join(outDir, f.pdf.replace(/\.pdf$/, '.html'));
    const pdfFile = path.join(outDir, f.pdf);
    fs.writeFileSync(htmlFile, html, 'utf8');

    console.log(`[render] ${f.md} -> ${f.pdf}`);
    execFileSync(
        browser,
        [
            '--headless=new',
            '--disable-gpu',
            '--no-pdf-header-footer',
            '--run-all-compositor-stages-before-draw',
            '--virtual-time-budget=10000',
            `--print-to-pdf=${pdfFile}`,
            'file:///' + htmlFile.replace(/\\/g, '/'),
        ],
        { stdio: 'inherit' }
    );
}

console.log('\n[OK] PDFs generados en', outDir);
