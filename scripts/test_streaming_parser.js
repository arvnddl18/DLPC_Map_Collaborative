/**
 * Test Streaming Parser Script for DLPC Davao NAP Facility Report
 * Measures execution time and filters for Davao South and Davao North records.
 */

import fs from 'fs';
import readline from 'readline';

const CSV_PATH = './NAP Facility Summary Report-06-05-2026 14-39.csv';

console.log('Testing Streaming Parser on:', CSV_PATH);
const startTime = Date.now();

const DAVAO_TERMS = [
  'DAVAO', 'DVO_', 'PANABO', 'TAGUM', 'DIGOS', 'SAMAL', 'MATI',
  'DAVAO DEL SUR', 'DAVAO DEL NORTE', 'DAVAO ORIENTAL', 'DAVAO DE ORO'
];

const DAVAO_BOUNDS = {
  minLat: 6.30,
  maxLat: 7.95,
  minLng: 125.10,
  maxLng: 126.65
};

const rl = readline.createInterface({
  input: fs.createReadStream(CSV_PATH, { encoding: 'utf-8' }),
  crlfDelay: Infinity
});

let totalRows = 0;
let davaoRecords = [];
let headerFound = false;
let latCol = 7, lngCol = 8, idCol = 1, nameCol = 0, addrCol = 6;

function splitLine(line, delimiter) {
  const regex = new RegExp(`(?:^|\\${delimiter})(?:"([^"]*(?:""[^"]*)*)"|([^\\${delimiter}]*))`, 'g');
  const result = [];
  let match;
  while ((match = regex.exec(line)) !== null) {
    if (match.index === regex.lastIndex) regex.lastIndex++;
    let val = match[1] !== undefined ? match[1].replace(/""/g, '"') : match[2];
    result.push(val !== undefined ? val : '');
  }
  return result;
}

rl.on('line', (line) => {
  totalRows++;
  if (!headerFound) {
    if (line.includes('NAP ID') && (line.includes('Latitude') || line.includes('LAT'))) {
      headerFound = true;
    }
    return;
  }

  const upper = line.toUpperCase();
  const hasKeyword = DAVAO_TERMS.some(t => upper.includes(t));
  if (!hasKeyword) return; // Discard non-Davao immediately

  const cols = splitLine(line, ';');
  const lat = parseFloat(cols[latCol]);
  const lng = parseFloat(cols[lngCol]);

  if (!isNaN(lat) && !isNaN(lng) &&
      lat >= DAVAO_BOUNDS.minLat && lat <= DAVAO_BOUNDS.maxLat &&
      lng >= DAVAO_BOUNDS.minLng && lng <= DAVAO_BOUNDS.maxLng) {
    
    let region = 'Davao South';
    if (upper.includes('DEL NORTE') || upper.includes('NORTH') || lat > 7.15) {
      region = 'Davao North';
    }

    davaoRecords.push({
      id: cols[idCol] || `NAP-${davaoRecords.length}`,
      name: cols[nameCol] || '',
      latitude: lat,
      longitude: lng,
      region: region
    });
  }
});

rl.on('close', () => {
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`Stream parsed ${totalRows.toLocaleString()} rows in ${elapsed.toFixed(2)} seconds!`);
  console.log(`Extracted ${davaoRecords.length.toLocaleString()} Davao South & Davao North records.`);
  console.log('Sample extracted Davao record:', davaoRecords[0]);
  console.log('Throughput:', Math.round(totalRows / elapsed).toLocaleString(), 'rows/sec');
});
