import type { AppState, DocumentRef, Equipment, FptStatus, Issue, Severity, System, Trade } from '../types';
import { checklistFor, SYSTEM_TEMPLATES } from './checklists';
import { typeOf } from './tags';
import { daysAgo } from '../lib/dates';

type SeedEq = [tag: string, desc: string, system: System, location: string, mfr: string, model: string, serial: string, pfcDone: number, fpt: FptStatus];

const EQUIPMENT: SeedEq[] = [
  ['AHU-1', 'Air handling unit, admin wing', 'Air side', 'Mech 101', 'Trane', 'CSAA021', 'K22H4410', 7, 'Passed'],
  ['AHU-2', 'Air handling unit, laboratory 100% OA', 'Air side', 'Mech 101', 'Trane', 'CSAA030', '', 7, 'Failed'],
  ['RTU-1', 'Rooftop unit, operations control room', 'Air side', 'Roof', 'Carrier', '48FC', '', 7, 'Passed'],
  ['EF-1', 'General exhaust fan, restrooms', 'Air side', 'Roof', 'Greenheck', 'SQ-120', '', 6, 'Not started'],
  ['EF-2', 'Fume hood exhaust fan', 'Air side', 'Roof', 'Greenheck', 'Vektor-MH', '', 7, 'Scheduled'],
  ['EF-3', 'Chemical storage exhaust fan', 'Air side', 'Chem Storage 110', 'Greenheck', 'CUE-099', '', 4, 'Not started'],
  ['ERV-1', 'Energy recovery ventilator, admin', 'Air side', 'Mech 101', 'RenewAire', 'HE2XINH', '', 7, 'Passed'],
  ['VAV-1-01', 'VAV terminal w/ reheat, office 101', 'Air side', 'Admin', 'Price', 'SDV5', '', 5, 'Not started'],
  ['VAV-1-02', 'VAV terminal w/ reheat, office 102', 'Air side', 'Admin', 'Price', 'SDV5', '', 5, 'Not started'],
  ['VAV-2-01', 'VAV terminal w/ reheat, lab 201', 'Air side', 'Lab 201', 'Price', 'SDV5', '', 7, 'Retest'],
  ['FCU-1', 'Fan coil unit, electrical room', 'Air side', 'Elec 104', 'Daikin', 'FXFQ', '', 3, 'Not started'],
  ['CH-1', 'Air-cooled chiller, 120 ton', 'Hydronic', 'Yard', 'Trane', 'ACR120', '', 7, 'Passed'],
  ['B-1', 'Condensing boiler, 1500 MBH', 'Hydronic', 'Boiler 103', 'Lochinvar', 'FBN1501', '', 7, 'Passed'],
  ['B-2', 'Condensing boiler, 1500 MBH', 'Hydronic', 'Boiler 103', 'Lochinvar', 'FBN1501', '', 7, 'Scheduled'],
  ['P-1', 'Chilled water pump, primary', 'Hydronic', 'Mech 101', 'Bell & Gossett', 'e-1510', '', 7, 'Passed'],
  ['P-2', 'Chilled water pump, standby', 'Hydronic', 'Mech 101', 'Bell & Gossett', 'e-1510', '', 6, 'Not started'],
  ['P-3', 'Heating hot water pump', 'Hydronic', 'Boiler 103', 'Bell & Gossett', 'e-1510', '', 7, 'Failed'],
  ['P-4', 'Heating hot water pump, standby', 'Hydronic', 'Boiler 103', 'Bell & Gossett', 'e-1510', '', 7, 'Scheduled'],
  ['HX-1', 'Plate heat exchanger, process heat recovery', 'Hydronic', 'Mech 101', 'Alfa Laval', 'T10', '', 2, 'Not started'],
  ['SWBD-1', 'Main switchboard, 2000A 480V', 'Electrical', 'Elec 104', 'Square D', 'QED-2', '', 6, 'Passed'],
  ['ATS-1', 'Automatic transfer switch, 400A', 'Electrical', 'Elec 104', 'ASCO', '7000', '', 6, 'Failed'],
  ['GEN-1', 'Diesel generator, 250 kW', 'Electrical', 'Yard', 'Caterpillar', 'C9', '', 5, 'Scheduled'],
  ['UPS-1', 'UPS, SCADA room, 20 kVA', 'Electrical', 'SCADA 105', 'Eaton', '93PM', '', 6, 'Passed'],
  ['VFD-AHU2', 'VFD, AHU-2 supply fan', 'Electrical', 'Mech 101', 'ABB', 'ACH580', '', 6, 'Passed'],
  ['BAS-1', 'Building automation front end', 'Controls', 'Operations', 'Tridium', 'N4', '', 4, 'Not started'],
  ['LC-1', 'Lighting control panel', 'Controls', 'Elec 104', 'nLight', '', '', 5, 'Passed'],
  ['DWH-1', 'Domestic water heater, gas, 100 gal', 'Plumbing', 'Mech 101', 'A.O. Smith', 'BTH-199', '', 5, 'Passed'],
];

type SeedIssue = [id: string, tag: string, desc: string, severity: Severity, trade: Trade, openedDaysAgo: number, closedDaysAgo: number | null];

const ISSUES: SeedIssue[] = [
  ['CX-001', 'AHU-2', 'Supply static pressure hunting ±0.4 in. w.c. at setpoint; PID loop needs tuning', 'Major', 'Controls', 38, null],
  ['CX-002', 'AHU-2', 'OA damper actuator strokes to 85% at 100% command', 'Major', 'Mechanical', 38, null],
  ['CX-003', 'P-3', 'Lead/lag does not stage on simulated pump failure', 'Critical', 'Controls', 12, null],
  ['CX-004', 'ATS-1', 'Transfer time 14 s on utility loss test; spec is 10 s max', 'Critical', 'Electrical', 9, null],
  ['CX-005', 'EF-3', 'Discharge within 10 ft of RTU-1 outdoor air intake', 'Major', 'Design team', 61, null],
  ['CX-006', 'VAV-2-01', 'Reheat valve leaks by; discharge temp rises 6°F with valve closed', 'Minor', 'Mechanical', 20, null],
  ['CX-007', 'FCU-1', 'Condensate drain not trapped', 'Minor', 'Mechanical', 45, null],
  ['CX-008', 'BAS-1', 'Graphics missing HX-1 and P-4 points', 'Minor', 'Controls', 26, null],
  ['CX-009', 'GEN-1', 'Load bank test report not submitted', 'Major', 'Electrical', 17, null],
  ['CX-010', 'AHU-1', 'Filter differential gauge not installed', 'Minor', 'Mechanical', 72, 50],
  ['CX-011', 'CH-1', 'CHW supply temp reset not per sequence', 'Major', 'Controls', 55, 30],
  ['CX-012', 'B-1', 'Flue termination clearance below manufacturer minimum', 'Major', 'Mechanical', 64, 41],
  ['CX-013', 'SWBD-1', 'Arc flash labels missing', 'Minor', 'Electrical', 40, 22],
  ['CX-014', 'VAV-1-02', 'Airflow 30% below scheduled max; TAB to rebalance', 'Minor', 'TAB', 5, null],
  ['CX-015', 'HX-1', 'Strainer not cleaned after flush', 'Minor', 'Mechanical', 3, null],
  ['CX-016', 'AHU-2', 'TAB report shows supply fan 12% below design CFM', 'Major', 'TAB', 31, null],
];

export const SEED_DOCUMENTS: DocumentRef[] = [
  { id: 'DOC-0001', tag: 'AHU-2', filename: 'AHU-2_TAB_Summary.pdf', kind: 'TAB report', mime: 'application/pdf', size: 824, addedAt: '2026-09-01T12:00:00.000Z', blobKey: 'seed:AHU-2_TAB_Summary.pdf', matchedBy: 'filename' },
  { id: 'DOC-0002', tag: 'P-3', filename: 'P-3_FPT_Form.pdf', kind: 'FPT form', mime: 'application/pdf', size: 809, addedAt: '2026-09-01T12:00:00.000Z', blobKey: 'seed:P-3_FPT_Form.pdf', matchedBy: 'filename' },
  { id: 'DOC-0003', tag: 'ATS-1', filename: 'ATS-1_Submittal_Cover.pdf', kind: 'Submittal', mime: 'application/pdf', size: 787, addedAt: '2026-09-01T12:00:00.000Z', blobKey: 'seed:ATS-1_Submittal_Cover.pdf', matchedBy: 'filename' },
];

export function seedPfc(type: string, system: System, pfcDone: number): boolean[] {
  const len = checklistFor(type, system).length;
  const checked = pfcDone === SYSTEM_TEMPLATES[system].length ? len : Math.min(pfcDone, len - 1);
  return Array.from({ length: len }, (_, i) => i < checked);
}

export function buildSeed(now: Date = new Date()): { equipment: Equipment[]; issues: Issue[] } {
  const equipment = EQUIPMENT.map(([tag, desc, system, location, mfr, model, serial, pfcDone, fpt]): Equipment => {
    const type = typeOf(tag);
    return { tag, type, desc, system, location, mfr, model, serial, pfc: seedPfc(type, system, pfcDone), fpt };
  });
  const issues = ISSUES.map(([id, tag, desc, severity, trade, o, c]): Issue => ({
    id, tag, desc, severity, trade, opened: daysAgo(o, now), closed: c === null ? null : daysAgo(c, now),
  }));
  return { equipment, issues };
}

export function seedState(now: Date = new Date()): AppState {
  const { equipment, issues } = buildSeed(now);
  return { version: 1, equipment, issues, documents: SEED_DOCUMENTS, profiles: [], batches: [], changes: [] };
}
