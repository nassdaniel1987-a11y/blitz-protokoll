<script>
  import { createEventDispatcher } from 'svelte';

  export let person = '';
  export let planung = {};
  export let zeitslots = [];
  export let raeume = [];
  export let raumLabels = {};

  const dispatch = createEventDispatcher();

  // Erstelle eine Kopie der Planung für die Bearbeitung
  let tempPlanung = JSON.parse(JSON.stringify(planung));

  // State: Welche Raum/Zeit-Kombinationen sind für diese Person ausgewählt?
  let zuordnungen = {};

  // Initialisiere zuordnungen basierend auf aktueller Planung
  raeume.forEach(raum => {
    zuordnungen[raum] = {};
    zeitslots.forEach(slot => {
      const inhalt = planung[slot]?.[raum] || '';
      const personen = inhalt.split(',').map(p => p.trim()).filter(p => p);
      zuordnungen[raum][slot] = personen.includes(person);
    });
  });

  function handleSave() {
    // Aktualisiere tempPlanung basierend auf zuordnungen
    raeume.forEach(raum => {
      zeitslots.forEach(slot => {
        // Hole aktuelle Personen in diesem Raum/Zeitslot
        const inhalt = tempPlanung[slot]?.[raum] || '';
        let personen = inhalt.split(',').map(p => p.trim()).filter(p => p);

        // Entferne diese Person erstmal
        personen = personen.filter(p => p !== person);

        // Füge Person hinzu, wenn ausgewählt
        if (zuordnungen[raum][slot]) {
          personen.push(person);
        }

        // Schreibe zurück
        tempPlanung[slot][raum] = personen.join(', ');
      });
    });

    dispatch('save', tempPlanung);
    dispatch('close');
  }

  function handleClose() {
    dispatch('close');
  }

  // Hilfsfunktion: Alle Zeitslots für einen Raum auswählen/abwählen
  function toggleAlleZeitslots(raum) {
    const alleAusgewaehlt = zeitslots.every(slot => zuordnungen[raum][slot]);
    zeitslots.forEach(slot => {
      zuordnungen[raum][slot] = !alleAusgewaehlt;
    });
  }

  // Zähle wie viele Slots für diesen Raum ausgewählt sind
  function getAnzahlAusgewaehlteSlots(raum) {
    return zeitslots.filter(slot => zuordnungen[raum][slot]).length;
  }
</script>

<div class="modal-overlay" on:click={handleClose}>
  <div class="modal-content" on:click|stopPropagation>
    <div class="modal-header">
      <h2>{person} zuordnen</h2>
      <button type="button" class="close-btn" on:click={handleClose}>×</button>
    </div>

    <div class="modal-body">
      <p class="hinweis">Wähle die Räume und Zeitslots aus:</p>

      <div class="raeume-liste">
        {#each raeume as raum}
          <div class="raum-card">
            <div class="raum-header">
              <h3>{raumLabels[raum]}</h3>
              <button
                type="button"
                class="toggle-all-btn"
                on:click={() => toggleAlleZeitslots(raum)}
                title="Alle auswählen/abwählen"
              >
                {#if getAnzahlAusgewaehlteSlots(raum) === zeitslots.length}
                  ✓ Alle
                {:else if getAnzahlAusgewaehlteSlots(raum) > 0}
                  {getAnzahlAusgewaehlteSlots(raum)}/{zeitslots.length}
                {:else}
                  Alle?
                {/if}
              </button>
            </div>

            <div class="zeitslots-checkboxen">
              {#each zeitslots as slot}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    bind:checked={zuordnungen[raum][slot]}
                  />
                  <span class="checkbox-text">{slot}</span>
                </label>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" on:click={handleClose}>Abbrechen</button>
      <button type="button" class="btn btn-primary" on:click={handleSave}>Speichern</button>
    </div>
  </div>
</div>

<style>
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 12px;
    max-width: 600px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem;
    border-bottom: 1px solid #e0e0e0;
  }

  .modal-header h2 {
    margin: 0;
    font-size: 1.5rem;
    color: #2c3e50;
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 2rem;
    color: #95a5a6;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: #ecf0f1;
    color: #2c3e50;
  }

  .modal-body {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .hinweis {
    margin-top: 0;
    margin-bottom: 1.5rem;
    color: #7f8c8d;
    font-size: 0.95rem;
  }

  .raeume-liste {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .raum-card {
    border: 2px solid #ecf0f1;
    border-radius: 8px;
    padding: 1rem;
    background: #fafafa;
    transition: border-color 0.2s;
  }

  .raum-card:has(input:checked) {
    border-color: #3498db;
    background: #ebf5fb;
  }

  .raum-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.8rem;
  }

  .raum-header h3 {
    margin: 0;
    font-size: 1.1rem;
    color: #2c3e50;
  }

  .toggle-all-btn {
    background: white;
    border: 1px solid #bdc3c7;
    padding: 0.4rem 0.8rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.85rem;
    color: #555;
    transition: all 0.2s;
  }

  .toggle-all-btn:hover {
    background: #3498db;
    color: white;
    border-color: #3498db;
  }

  .zeitslots-checkboxen {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 0.6rem;
    border-radius: 6px;
    background: white;
    transition: background 0.2s;
    user-select: none;
  }

  .checkbox-label:hover {
    background: #f8f9fa;
  }

  .checkbox-label input[type="checkbox"] {
    width: 24px;
    height: 24px;
    margin-right: 0.8rem;
    cursor: pointer;
    flex-shrink: 0;
  }

  /* Touch-Friendly: Größere Checkboxen auf iPad */
  @media (hover: none) and (pointer: coarse) {
    .checkbox-label {
      padding: 1rem;
    }

    .checkbox-label input[type="checkbox"] {
      width: 28px;
      height: 28px;
    }

    .checkbox-text {
      font-size: 1.05rem;
    }
  }

  .checkbox-text {
    font-size: 0.95rem;
    color: #2c3e50;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    padding: 1.5rem;
    border-top: 1px solid #e0e0e0;
  }

  .btn {
    padding: 0.8rem 1.5rem;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;
    min-width: 120px;
  }

  /* Touch-Friendly: Größere Buttons auf iPad */
  @media (hover: none) and (pointer: coarse) {
    .btn {
      padding: 1rem 2rem;
      font-size: 1.1rem;
      min-width: 140px;
    }
  }

  .btn-secondary {
    background: #ecf0f1;
    color: #2c3e50;
  }

  .btn-secondary:hover {
    background: #bdc3c7;
  }

  .btn-primary {
    background: #3498db;
    color: white;
  }

  .btn-primary:hover {
    background: #2980b9;
  }

  .btn:active {
    transform: scale(0.98);
  }
</style>
