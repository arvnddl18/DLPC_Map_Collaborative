/**
 * DLPC_Map_Collaborative - NAP Streaming Parser Web Worker
 * Ultra-fast chunked parser for large CSV (300MB+) and XLSX spreadsheets.
 * Applies high-speed streaming geographic filter capturing all Davao Region and Davao City records.
 */

// Bounding box for Region XI (Davao Region: Davao City, Davao del Sur, Davao del Norte, Davao Oriental, Davao de Oro, Davao Occidental)
const DAVAO_BOUNDS = {
  minLat: 5.35,
  maxLat: 8.00,
  minLng: 125.10,
  maxLng: 126.65
};

const DAVAO_TERMS = [
  'DAVAO', 'DVO_', ';DVO_', 'PANABO', 'TAGUM', 'DIGOS', 'SAMAL', 'MATI',
  'DAVAO DEL SUR', 'DAVAO DEL NORTE', 'DAVAO ORIENTAL', 'DAVAO DE ORO', 'DAVAO OCCIDENTAL',
  'CARMEN', 'STO. TOMAS', 'SANTO TOMAS', 'DUJALI', 'BANSALAN', 'STA. CRUZ', 'SANTA CRUZ',
  'MALITA', 'COMPOSTELA', 'MONKAYO', 'NABUNTURAN', 'BAGANGA'
];

self.onmessage = async function(e) {
  const { file, fileType } = e.data;

  try {
    if (fileType === 'csv') {
      await parseCsvStream(file);
    } else {
      await parseXlsxFile(file);
    }
  } catch (err) {
    self.postMessage({ type: 'ERROR', error: err.message });
  }
};

/**
 * Streaming CSV parser with chunked line processing.
 */
async function parseCsvStream(file) {
  const chunkSize = 1024 * 1024 * 4; // 4MB chunks
  let offset = 0;
  let leftover = '';
  let lineCount = 0;
  let headerIndex = -1;
  let colMap = null;
  let delimiter = ';';

  const validRecords = [];
  let davaoCityCount = 0;
  let invalidCount = 0;
  const fileSize = file.size;

  while (offset < fileSize) {
    const slice = file.slice(offset, offset + chunkSize);
    const text = await slice.text();
    const fullText = leftover + text;
    const lines = fullText.split(/\r?\n/);

    // Save unfinished line for next chunk
    leftover = lines.pop() || '';
    offset += chunkSize;

    for (let i = 0; i < lines.length; i++) {
      const rawLine = lines[i].trim();
      if (!rawLine) continue;
      lineCount++;

      // Detect header row if standard format
      if (headerIndex === -1 && (rawLine.includes('NAP ID') || rawLine.includes('Latitude') || rawLine.includes('DP/NAP LAT'))) {
        delimiter = rawLine.includes(';') ? ';' : ',';
        const cleanHeader = rawLine.replace(/,+$/, '').trim();
        const headers = splitLine(cleanHeader, delimiter);
        colMap = buildColumnMapping(headers);
        headerIndex = lineCount;
        continue;
      }

      if (headerIndex === -1 && lineCount <= 6) {
        // Skip preamble metadata rows
        continue;
      }

      // Clean line: remove Excel trailing commas and outer quotes
      let cleanLine = rawLine.replace(/,+$/, '').trim();
      if (cleanLine.startsWith('"') && cleanLine.endsWith('"')) {
        cleanLine = cleanLine.slice(1, -1);
      }

      // Fast-path: parse telecom facility summary report format with ;lat;lng;
      const telecomRecord = parseTelecomSummaryLine(cleanLine);
      if (telecomRecord) {
        validRecords.push(telecomRecord);
        if (telecomRecord.isDavaoCity) davaoCityCount++;
        continue;
      }

      // Fallback path: standard CSV column-mapped parsing
      if (colMap && colMap.latCol !== -1 && colMap.lngCol !== -1) {
        const cols = splitLine(cleanLine, delimiter);
        const latVal = parseFloat(cols[colMap.latCol]);
        const lngVal = parseFloat(cols[colMap.lngCol]);

        const hasValidCoords = !isNaN(latVal) && !isNaN(lngVal) &&
          latVal >= DAVAO_BOUNDS.minLat && latVal <= DAVAO_BOUNDS.maxLat &&
          lngVal >= DAVAO_BOUNDS.minLng && lngVal <= DAVAO_BOUNDS.maxLng;

        if (hasValidCoords) {
          const upperLine = cleanLine.toUpperCase();
          const napId = cols[colMap.idCol] ? cols[colMap.idCol].trim() : `NAP-${validRecords.length + 1}`;
          const name = cols[colMap.nameCol] ? cols[colMap.nameCol].trim() : napId;
          const address = cols[colMap.addressCol] ? cols[colMap.addressCol].trim() : '';
          const status = cols[colMap.statusCol] ? cols[colMap.statusCol].trim() : 'In Service';
          const capacity = parseInt(cols[colMap.capacityCol] || 8, 10);
          const available = parseInt(cols[colMap.availableCol] || capacity, 10);
          const city = extractCity(address, upperLine, latVal, lngVal);

          let region = 'Davao South';
          if (upperLine.includes('DEL NORTE') || upperLine.includes('NORTH') || upperLine.includes('TAGUM') || 
              upperLine.includes('PANABO') || upperLine.includes('CARMEN') || latVal > 7.15) {
            region = 'Davao North';
          }

          const isDavaoCity = isDavaoCityRecord(city, upperLine, latVal, lngVal);
          if (isDavaoCity) davaoCityCount++;

          validRecords.push({
            id: napId,
            name: name,
            latitude: latVal,
            longitude: lngVal,
            address: cleanAddress(address) || `${city}, Davao`,
            city: city,
            region: region,
            status: status,
            capacity: isNaN(capacity) ? 8 : capacity,
            availablePorts: isNaN(available) ? 8 : available,
            isDavaoCity: isDavaoCity,
            metadata: {
              olt: cols[colMap.oltCol] || '',
              locationType: cols[colMap.typeCol] || ''
            }
          });
        } else {
          invalidCount++;
        }
      }
    }

    // Report progress periodically
    self.postMessage({
      type: 'PROGRESS',
      rowsScanned: lineCount,
      davaoMatched: validRecords.length,
      davaoCityCount: davaoCityCount,
      percent: Math.min(100, Math.round((offset / fileSize) * 100))
    });
  }

  self.postMessage({
    type: 'COMPLETE',
    validRecords: validRecords,
    totalScanned: lineCount,
    davaoCount: validRecords.length,
    davaoCityCount: davaoCityCount,
    invalidCount: invalidCount
  });
}

/**
 * Telecom Facility Summary Report line extractor.
 * Handles embedded address semicolons, trailing commas, and unescaped quotes.
 */
function parseTelecomSummaryLine(cleanLine) {
  const coordMatch = cleanLine.match(/;(\d{1,2}\.\d+);(\d{2,3}\.\d+);/);
  if (!coordMatch) return null;

  const lat = parseFloat(coordMatch[1]);
  const lng = parseFloat(coordMatch[2]);
  if (isNaN(lat) || isNaN(lng)) return null;

  // Geographic boundary check for Region XI
  if (lat < DAVAO_BOUNDS.minLat || lat > DAVAO_BOUNDS.maxLat ||
      lng < DAVAO_BOUNDS.minLng || lng > DAVAO_BOUNDS.maxLng) {
    return null;
  }

  const prefix = cleanLine.slice(0, coordMatch.index);
  const suffix = cleanLine.slice(coordMatch.index + coordMatch[0].length);

  const prefixParts = prefix.split(';');
  const suffixParts = suffix.split(';');

  const name = (prefixParts[0] || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  const id = (prefixParts[1] || '').replace(/^["'\s]+|["'\s]+$/g, '').trim() || name;
  const status = (prefixParts[2] || 'In Service').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  const locationType = (prefixParts[3] || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  const building = (prefixParts[4] || '').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  const rawAddress = prefixParts.slice(6).join('; ');

  const olt = (suffixParts[2] || '').trim();
  const totalPorts = parseInt(suffixParts[4] || 8, 10);
  const availablePorts = parseInt(suffixParts[9] || totalPorts, 10);

  const upper = cleanLine.toUpperCase();
  const city = extractCity(rawAddress, upper, lat, lng);

  let region = 'Davao South';
  if (upper.includes('DEL NORTE') || upper.includes('NORTH') || upper.includes('TAGUM') || 
      upper.includes('PANABO') || upper.includes('CARMEN') || upper.includes('DUJALI') || 
      upper.includes('COMPOSTELA') || upper.includes('DAVAO DE ORO') || lat > 7.15) {
    region = 'Davao North';
  }

  const isDavaoCity = isDavaoCityRecord(city, upper, lat, lng);

  return {
    id: id,
    name: name || id,
    latitude: lat,
    longitude: lng,
    address: cleanAddress(rawAddress) || building || `${city}, Davao`,
    city: city,
    region: region,
    status: status || 'In Service',
    capacity: isNaN(totalPorts) ? 8 : totalPorts,
    availablePorts: isNaN(availablePorts) ? 8 : availablePorts,
    isDavaoCity: isDavaoCity,
    metadata: {
      olt: olt,
      locationType: locationType,
      building: building
    }
  };
}

/**
 * XLSX file parser using client-side SheetJS.
 */
async function parseXlsxFile(file) {
  const buffer = await file.arrayBuffer();

  importScripts('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  const wb = XLSX.read(buffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  if (rows.length === 0) throw new Error('Excel sheet is empty.');

  // Find header row
  let headerRowIdx = 0;
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const rowStr = (rows[r] || []).join(' ').toUpperCase();
    if (rowStr.includes('LAT') || rowStr.includes('NAP') || rowStr.includes('DP')) {
      headerRowIdx = r;
      break;
    }
  }

  const headers = rows[headerRowIdx] || [];
  const colMap = buildColumnMapping(headers);
  const validRecords = [];
  let davaoCityCount = 0;
  let invalidCount = 0;

  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;

    const rowStr = row.join(' ').toUpperCase();
    const latVal = parseFloat(row[colMap.latCol]);
    const lngVal = parseFloat(row[colMap.lngCol]);

    const hasValidCoords = !isNaN(latVal) && !isNaN(lngVal) &&
      latVal >= DAVAO_BOUNDS.minLat && latVal <= DAVAO_BOUNDS.maxLat &&
      lngVal >= DAVAO_BOUNDS.minLng && lngVal <= DAVAO_BOUNDS.maxLng;

    if (!hasValidCoords) {
      invalidCount++;
      continue;
    }

    const napId = String(row[colMap.idCol] || `NAP-${validRecords.length + 1}`).trim();
    const name = String(row[colMap.nameCol] || napId).trim();
    const address = String(row[colMap.addressCol] || '').trim();
    const city = extractCity(address, rowStr, latVal, lngVal);

    let region = 'Davao South';
    if (rowStr.includes('DEL NORTE') || rowStr.includes('NORTH') || rowStr.includes('TAGUM') || 
        rowStr.includes('PANABO') || rowStr.includes('CARMEN') || latVal > 7.15) {
      region = 'Davao North';
    }

    const isDavaoCity = isDavaoCityRecord(city, rowStr, latVal, lngVal);
    if (isDavaoCity) davaoCityCount++;

    validRecords.push({
      id: napId,
      name: name,
      latitude: latVal,
      longitude: lngVal,
      address: cleanAddress(address) || `${city}, Davao`,
      city: city,
      region: region,
      status: String(row[colMap.statusCol] || 'In Service').trim(),
      capacity: parseInt(row[colMap.capacityCol] || 8, 10),
      availablePorts: parseInt(row[colMap.availableCol] || 8, 10),
      isDavaoCity: isDavaoCity,
      metadata: {
        olt: String(row[colMap.oltCol] || ''),
        locationType: String(row[colMap.typeCol] || '')
      }
    });

    if (r % 500 === 0) {
      self.postMessage({
        type: 'PROGRESS',
        rowsScanned: r,
        davaoMatched: validRecords.length,
        davaoCityCount: davaoCityCount,
        percent: Math.round((r / rows.length) * 100)
      });
    }
  }

  self.postMessage({
    type: 'COMPLETE',
    validRecords: validRecords,
    totalScanned: rows.length,
    davaoCount: validRecords.length,
    davaoCityCount: davaoCityCount,
    invalidCount: invalidCount
  });
}

function buildColumnMapping(headers) {
  const map = {
    idCol: -1,
    nameCol: -1,
    latCol: -1,
    lngCol: -1,
    addressCol: -1,
    statusCol: -1,
    capacityCol: -1,
    availableCol: -1,
    oltCol: -1,
    typeCol: -1
  };

  headers.forEach((h, idx) => {
    const clean = String(h || '').trim().toUpperCase();
    if (map.latCol === -1 && (clean === 'LATITUDE' || clean.includes('NAP LAT') || clean === 'DP/NAP LAT' || clean === 'LAT')) map.latCol = idx;
    if (map.lngCol === -1 && (clean === 'LONGITUDE' || clean.includes('NAP LONG') || clean === 'DP/NAP LONG' || clean === 'LNG' || clean === 'LONG')) map.lngCol = idx;
    if (map.idCol === -1 && (clean === 'NAP ID' || clean === 'DP' || clean === 'DPDENIRO' || clean === 'ID')) map.idCol = idx;
    if (map.nameCol === -1 && (clean === 'LOCATION' || clean === 'NAME' || clean.includes('BULDING SERVED') || clean.includes('BUILDING'))) map.nameCol = idx;
    if (map.addressCol === -1 && (clean.includes('ADDRESS') || clean === 'LOCATION' || clean.includes('BULDING SERVED'))) map.addressCol = idx;
    if (map.statusCol === -1 && (clean.includes('STATUS') || clean === 'SELL STATUS')) map.statusCol = idx;
    if (map.capacityCol === -1 && (clean.includes('PORTS TOTAL') || clean.includes('S_TOTAL') || clean.includes('CAPACITY'))) map.capacityCol = idx;
    if (map.availableCol === -1 && (clean.includes('AVAILABLE') || clean.includes('S_SP'))) map.availableCol = idx;
    if (map.oltCol === -1 && (clean.includes('OLT'))) map.oltCol = idx;
    if (map.typeCol === -1 && (clean.includes('LOCATION TYPE') || clean.includes('TECH'))) map.typeCol = idx;
  });

  // Safe defaults if columns weren't matched
  if (map.latCol === -1) map.latCol = 7;
  if (map.lngCol === -1) map.lngCol = 8;
  if (map.idCol === -1) map.idCol = 1;
  if (map.nameCol === -1) map.nameCol = 0;
  if (map.addressCol === -1) map.addressCol = 6;

  return map;
}

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

function cleanAddress(addr) {
  if (!addr) return '';
  return addr.replace(/""/g, '"')
             .replace(/ZipCode:\s*[^;]*;\s*/gi, '')
             .replace(/State:\s*[^;]*;\s*/gi, '')
             .replace(/City:\s*[^;]*;\s*/gi, '')
             .replace(/Location:\s*/gi, '')
             .replace(/Additional Address Information:\s*/gi, '')
             .replace(/^["'\s;,]+|["'\s;,]+$/g, '')
             .replace(/\s*;\s*$/, '')
             .trim();
}

function extractCity(addr, fullLine, lat, lng) {
  if (addr) {
    const cityMatch = addr.match(/City:\s*([^;"]+)[;"]/i);
    if (cityMatch && cityMatch[1].trim()) {
      const c = cityMatch[1].trim();
      if (/davao\s*city/i.test(c)) return 'Davao City';
      if (/tagum/i.test(c)) return 'Tagum City';
      if (/panabo/i.test(c)) return 'Panabo City';
      if (/digos/i.test(c)) return 'Digos City';
      if (/mati/i.test(c)) return 'Mati City';
      if (/samal|igacos/i.test(c)) return 'IGACOS (Samal)';
      return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase();
    }
  }

  const upper = fullLine.toUpperCase();
  if (upper.includes('DAVAO CITY')) return 'Davao City';
  if (upper.includes('TAGUM')) return 'Tagum City';
  if (upper.includes('PANABO')) return 'Panabo City';
  if (upper.includes('DIGOS')) return 'Digos City';
  if (upper.includes('SAMAL') || upper.includes('IGACOS')) return 'IGACOS (Samal)';
  if (upper.includes('MATI')) return 'Mati City';
  if (upper.includes('CARMEN')) return 'Carmen';
  if (upper.includes('BANSALAN')) return 'Bansalan';
  if (upper.includes('STA. CRUZ') || upper.includes('SANTA CRUZ')) return 'Sta. Cruz';

  // Coordinate fallback for Davao City
  if (lat && lng && lat >= 6.95 && lat <= 7.35 && lng >= 125.35 && lng <= 125.70) {
    return 'Davao City';
  }
  return 'Davao City';
}

function isDavaoCityRecord(city, upperLine, lat, lng) {
  const isOtherLoc = /tagum|panabo|digos|mati|samal|carmen|baganga|monkayo|bansalan|malita|sta\. cruz|santa cruz|compostela/i.test(city || '');
  if (isOtherLoc) return false;
  return /davao\s*city/i.test(city || '') ||
         (upperLine && upperLine.includes('DAVAO CITY')) ||
         (lat >= 6.95 && lat <= 7.35 && lng >= 125.35 && lng <= 125.68);
}

