import { useState } from 'react';
import { PROJECT } from './data/project';
import { useHashTab } from './lib/route';
import { Banner } from './components/Banner';
import { About } from './components/About';
import { Chip } from './components/Chip';
import { Tabs } from './components/Tabs';
import { Overview } from './views/Overview';
import { Equipment } from './views/Equipment';
import { Issues } from './views/Issues';
import { Documents } from './views/Documents';
import { Import } from './views/Import';
import { EquipmentDrawer } from './views/EquipmentDrawer';

const VIEWS = {
  overview: Overview,
  equipment: Equipment,
  issues: Issues,
  documents: Documents,
  import: Import,
} as const;

export default function App() {
  const [tab] = useHashTab();
  const [aboutOpen, setAboutOpen] = useState(false);
  const ActiveView = VIEWS[tab];

  return (
    <>
      <header>
        <h1>Cx Ledger</h1>
        <span>{PROJECT.name}</span>
        <Chip tone="accent">{PROJECT.phase}</Chip>
      </header>
      <Banner onAbout={() => setAboutOpen(true)} />
      <Tabs active={tab} />
      {aboutOpen && <About onClose={() => setAboutOpen(false)} />}
      <main>
        <ActiveView />
      </main>
      <EquipmentDrawer />
    </>
  );
}
