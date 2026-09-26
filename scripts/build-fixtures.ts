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

export function makePdf(lines: string[]): Buffer {
  const esc = (s: string) => s.replace(/[\\()]/g, (m) => '\\' + m);
  const content = ['BT', '/F1 12 Tf', '72 720 Td', '16 TL', ...lines.map((l, i) => `${i ? 'T* ' : ''}(${esc(l)}) Tj`), 'ET'].join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

function buildSamplePdfs() {
  mkdirSync('public/samples', { recursive: true });
  writeFileSync('public/samples/AHU-2_TAB_Summary.pdf', makePdf(['TAB SUMMARY - AHU-2', 'Kettle Creek WTP, Admin & Lab Building', 'Supply fan: design 12,000 CFM, measured 10,560 CFM (-12%)', 'Outside air: design 12,000 CFM, measured 10,410 CFM', 'Sample document for the Cx Ledger demo.']));
  writeFileSync('public/samples/P-3_FPT_Form.pdf', makePdf(['FUNCTIONAL PERFORMANCE TEST - P-3', 'Heating hot water pump, Boiler 103', 'Step 4: Simulate lead pump failure - lag pump did not start (FAIL)', 'See issue CX-003.', 'Sample document for the Cx Ledger demo.']));
  writeFileSync('public/samples/ATS-1_Submittal_Cover.pdf', makePdf(['SUBMITTAL COVER SHEET - ATS-1', 'Automatic transfer switch, 400A, 480V', 'Manufacturer: ASCO   Model: 7000 Series', 'Status: Approved as noted', 'Sample document for the Cx Ledger demo.']));
}

buildContractorSchedule();
buildSamplePdfs();
console.log('fixtures written');
