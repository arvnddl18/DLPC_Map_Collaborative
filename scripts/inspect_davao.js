const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: fs.createReadStream('NAP Facility Summary Report-06-05-2026 14-39.csv', { encoding: 'utf-8' }),
  crlfDelay: Infinity
});

let totalLines = 0;
let davaoMatches = 0;
let davaoCity = 0;
let davaoSouth = 0;
let davaoNorth = 0;
let dvoPrefix = 0;
let samples = [];

rl.on('line', (line) => {
  totalLines++;
  const upper = line.toUpperCase();
  const isDvo = upper.includes('DAVAO') || upper.includes('DVO_');
  if (isDvo) {
    davaoMatches++;
    if (upper.includes('DAVAO CITY')) davaoCity++;
    if (upper.includes('SOUTH') || upper.includes('DEL SUR') || upper.includes('DAVAO DEL SUR')) davaoSouth++;
    if (upper.includes('NORTH') || upper.includes('DEL NORTE') || upper.includes('DAVAO DEL NORTE')) davaoNorth++;
    if (upper.includes('DVO_')) dvoPrefix++;
    if (samples.length < 5) samples.push({ lineNum: totalLines, line: line.slice(0, 300) });
  }
});

rl.on('close', () => {
  console.log('Total lines in CSV:', totalLines);
  console.log('Total Davao matches:', davaoMatches);
  console.log('Davao City:', davaoCity);
  console.log('Davao South / Del Sur:', davaoSouth);
  console.log('Davao North / Del Norte:', davaoNorth);
  console.log('DVO prefix:', dvoPrefix);
  console.log('Samples:', JSON.stringify(samples, null, 2));
});
