/**
 * DLPC_Map_Collaborative - Google Apps Script Bundle Builder
 * Inlines CSS and client JavaScript into a standalone Index.html file
 * suitable for native deployment via Google Apps Script HtmlService.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_DIR = path.join(__dirname, '..', 'client');
const GAS_DIR = __dirname;
const OUT_FILE = path.join(GAS_DIR, 'Index.html');

console.log('Building Google Apps Script Index.html bundle...');

let html = fs.readFileSync(path.join(CLIENT_DIR, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(CLIENT_DIR, 'css', 'app.css'), 'utf-8');

// Replace external stylesheet with inline style
html = html.replace('<link rel="stylesheet" href="css/app.css">', `<style>\n${css}\n</style>`);

// Embed GAS Template parameters injection script
const gasInitScript = `
<script>
  window.DLPC_CONFIG = {
    MAP_ID: "<?= mapId ?>",
    SHARE_TOKEN: "<?= token ?>",
    MODE: "<?= mode ?>",
    API_URL: "<?= ScriptApp.getService().getUrl() ?>"
  };
</script>
`;

html = html.replace('</head>', `${gasInitScript}\n</head>`);

// Write out bundled file
fs.writeFileSync(OUT_FILE, html, 'utf-8');
console.log(`Successfully generated GAS bundle at: ${OUT_FILE}`);
