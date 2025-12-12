<script>
  import { createEventDispatcher } from 'svelte';
  import RaumZeitZuordnungModal from './RaumZeitZuordnungModal.svelte';

  export let anwesendePersonen = [];
  export let planung = {};
  export let zeitslots = [];
  export let raeume = [];
  export let raumLabels = {};

  const dispatch = createEventDispatcher();

  let selectedPerson = null;
  let showModal = false;

  // Reaktives Mapping: Person -> Anzahl zugeordneter Slots
  let zuordnungStatus = {};
  let kachelKlassen = {};

  // Berechne für alle Personen die Zuordnungen - reaktiv!
  // Hinweis: Der erste Slot (11:40-12:25) wird nicht mitgezählt, da er selten vergeben wird
  $: {
    zuordnungStatus = {};
    anwesendePersonen.forEach(person => {
      let zugeordneteSlots = 0;
      // Überspringe den ersten Slot (Index 0: 11:40-12:25)
      zeitslots.slice(1).forEach(slot => {
        raeume.forEach(raum => {
          const inhalt = planung[slot]?.[raum] || '';
          const personen = inhalt.split(',').map(p => p.trim()).filter(p => p);
          if (personen.includes(person)) {
            zugeordneteSlots++;
          }
        });
      });
      zuordnungStatus[person] = zugeordneteSlots;
    });
  }

  // Berechne Farbklassen reaktiv basierend auf zuordnungStatus
  $: {
    kachelKlassen = {};
    const maxSlots = 3; // Nur 3 Slots werden gezählt (ohne 11:40-12:25)
    anwesendePersonen.forEach(person => {
      const status = zuordnungStatus[person] || 0;
      if (status === 0) {
        kachelKlassen[person] = 'nicht-zugeordnet';
      } else if (status >= maxSlots) {
        kachelKlassen[person] = 'vollstaendig';
      } else {
        kachelKlassen[person] = 'teilweise';
      }
    });
  }

  function openModal(person) {
    selectedPerson = person;
    showModal = true;
  }

  function handleZuordnungUpdate(event) {
    planung = event.detail;
    dispatch('update', planung);
  }
</script>

<div class="kacheln-container">
  <h3>Anwesende Personen zuordnen</h3>
  <div class="kacheln-grid">
    {#each anwesendePersonen as person}
      <button
        type="button"
        class="personen-kachel {kachelKlassen[person] || 'nicht-zugeordnet'}"
        on:click={() => openModal(person)}
      >
        <span class="person-name">{person}</span>
        <span class="status-badge">{zuordnungStatus[person] || 0}/3</span>
      </button>
    {/each}
  </div>

  <div class="legende">
    <span class="legende-item"><span class="dot nicht-zugeordnet"></span> Nicht zugeordnet</span>
    <span class="legende-item"><span class="dot teilweise"></span> Teilweise zugeordnet</span>
    <span class="legende-item"><span class="dot vollstaendig"></span> Vollständig zugeordnet</span>
  </div>
</div>

{#if showModal && selectedPerson}
  <RaumZeitZuordnungModal
    person={selectedPerson}
    {planung}
    {zeitslots}
    {raeume}
    {raumLabels}
    on:close={() => showModal = false}
    on:save={handleZuordnungUpdate}
  />
{/if}

<style>
  .kacheln-container {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    box-shadow: 0 2px 8px var(--shadow);
  }

  .kacheln-container h3 {
    margin-top: 0;
    margin-bottom: 1rem;
    color: var(--text-primary);
  }

  .kacheln-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .personen-kachel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 1.2rem 0.8rem;
    border: 2px solid transparent;
    border-radius: 8px;
    background: var(--bg-primary);
    color: var(--text-primary);
    cursor: pointer;
    transition: all 0.2s ease;
    min-height: 80px;
    font-size: 1rem;
    position: relative;
  }

  /* Touch-Friendly: Größere Tap-Targets auf iPad */
  @media (hover: none) and (pointer: coarse) {
    .personen-kachel {
      min-height: 100px;
      font-size: 1.1rem;
      padding: 1.5rem 1rem;
    }
  }

  .personen-kachel:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px var(--shadow);
  }

  .personen-kachel:active {
    transform: translateY(0);
  }

  .person-name {
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .status-badge {
    font-size: 0.85rem;
    padding: 0.25rem 0.6rem;
    border-radius: 12px;
    background: var(--border-color);
    font-weight: 500;
    color: var(--text-primary);
  }

  /* Farbcodierung */
  .personen-kachel.nicht-zugeordnet {
    border-color: #3498db;
    background: var(--bg-primary);
  }

  .personen-kachel.nicht-zugeordnet .status-badge {
    background: #3498db;
    color: white;
  }

  .personen-kachel.teilweise {
    border-color: #f39c12;
    background: var(--bg-primary);
  }

  .personen-kachel.teilweise .status-badge {
    background: #f39c12;
    color: white;
  }

  .personen-kachel.vollstaendig {
    border-color: #27ae60;
    background: var(--bg-primary);
  }

  .personen-kachel.vollstaendig .status-badge {
    background: #27ae60;
    color: white;
  }

  /* Legende */
  .legende {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
    padding-top: 1rem;
    border-top: 1px solid var(--border-color);
    color: var(--text-secondary);
  }

  .legende-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: inline-block;
  }

  .dot.nicht-zugeordnet {
    background: #3498db;
  }

  .dot.teilweise {
    background: #f39c12;
  }

  .dot.vollstaendig {
    background: #27ae60;
  }
</style>
