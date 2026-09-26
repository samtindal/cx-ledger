import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { parseCsv } from '../src/etl/parseCsv';

function buildContractorSchedule() {
  const [header, ...data] = parseCsv(readFileSync('fixtures/contractor-export.csv', 'utf8'));
  const width = header.length; // 6
  const blank = () => Array<string>(width).fill('');
  const title = blank(); title[0] = 'KETTLE CREEK WTP — MECHANICAL EQUIPMENT SCHEDULE';
  const rev = blank(); rev[0] = 'Rev 3';
  const mergedTop = blank(); mergedTop[1] = header[1];   // "EQUIPMENT DESCRIPTION" lives in B3 ...
  const headerRow = [...header]; headerRow[1] = '';       // ... merged down over B4 (blank until filled)
  const aoa = [title, rev, mergedTop, headerRow, ...data];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: width - 1 } }, // title across A1:F1
    { s: { r: 2, c: 1 }, e: { r: 3, c: 1 } },         // description header B3:B4
  ];
  const notes = XLSX.utils.aoa_to_sheet([['Notes'], ['Issued for commissioning review.'], ['Serial numbers pending for P-5 and CH-2.']]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, notes, 'Notes');
  XLSX.utils.book_append_sheet(wb, ws, 'Equipment Schedule');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  mkdirSync('fixtures', { recursive: true });
  writeFileSync('fixtures/contractor-schedule.xlsx', buf);
}

buildContractorSchedule();
console.log('fixtures written');
