import type { System } from '../types';

const FANS = [
  'Fan set, curb and vibration isolation installed',
  'Backdraft damper operates freely',
  'Belt/drive alignment and guards',
  'Rotation verified',
  'Disconnect installed',
  'Controls points wired and labeled',
];

export const TYPE_TEMPLATES: Record<string, string[]> = {
  VAV: [
    'Box installed with required straight inlet duct',
    'Reheat coil piped, control valve installed',
    'Airflow sensor tubing connected',
    'Controller addressed and communicating',
    'Min/max airflow set per schedule',
  ],
  EF: FANS, SF: FANS, RF: FANS,
  ATS: [
    'Nameplate matches submittal',
    'Torque check documented',
    'Normal and emergency phase rotation matched',
    'Time delays set per spec',
    'Exerciser clock configured',
  ],
  GEN: [
    'Set on pad and anchored',
    'Fuel tank filled, leak detection verified',
    'Battery and charger installed',
    'Exhaust and silencer installed',
    'Remote annunciator wired',
    'Load bank connection provided',
  ],
  P: [
    'Pump alignment verified',
    'Rotation verified',
    'Strainer cleaned after flush',
    'Isolation valves and gauges installed',
    'Controls points wired and labeled',
  ],
};

export const SYSTEM_TEMPLATES: Record<System, string[]> = {
  'Air side': [
    'Unit set, anchored, vibration isolation installed',
    'Duct connections complete, flex length within spec',
    'Filters installed (MERV 13), differential gauge reading',
    'Belt/drive alignment and guards',
    'Fan rotation verified',
    'Controls points wired and labeled',
    'TAB report received',
  ],
  Hydronic: [
    'Piping flushed and cleaned, strainers cleaned',
    'System filled, air vented',
    'Pump alignment verified',
    'Rotation verified',
    'Isolation valves and gauges installed',
    'Water treatment in place',
    'Controls points wired and labeled',
  ],
  Electrical: [
    'Nameplate matches submittal',
    'Torque check documented',
    'Insulation resistance test complete',
    'Grounding and bonding verified',
    'Labeling / arc flash labels installed',
    'Breaker settings per coordination study',
  ],
  Controls: [
    'Point-to-point checkout complete',
    'Graphics match sequences',
    'Trends configured',
    'Alarms configured and routed',
    'BACnet communication verified',
  ],
  Plumbing: [
    'Unit set and anchored',
    'Relief valve piped to drain',
    'Gas/electrical connected',
    'Temperature setpoint verified',
    'Recirculation pump operational',
  ],
  Unassigned: [
    'Nameplate data matches approved submittal',
    'Installation complete per manufacturer',
    'Controls points wired and labeled',
  ],
};

export function checklistFor(type: string, system: System): string[] {
  return TYPE_TEMPLATES[type] ?? SYSTEM_TEMPLATES[system];
}
