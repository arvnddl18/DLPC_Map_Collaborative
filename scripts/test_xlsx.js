import XLSX from 'xlsx';

const wb = XLSX.readFile('Book1.xlsx');
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Book1.xlsx total rows:', rows.length);

const headers = rows[0];
let latCol = headers.indexOf('DP/NAP LAT');
let lngCol = headers.indexOf('DP/NAP LONG');
let idCol = headers.indexOf('DP');
let nameCol = headers.indexOf('Location');

console.log('Mapped columns:', { latCol, lngCol, idCol, nameCol });
console.log('Sample parsed NAP:', {
  id: rows[1][idCol],
  lat: rows[1][latCol],
  lng: rows[1][lngCol],
  name: rows[1][nameCol]?.slice(0, 50)
});
