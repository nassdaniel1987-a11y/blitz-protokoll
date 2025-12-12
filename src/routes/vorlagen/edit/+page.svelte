<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import { getPersonen, getRaeume, getVorlagen, saveVorlagen } from '$lib/einstellungenService';
	import { toast } from '$lib/toastStore';
	import PersonenAuswahlModal from '$lib/components/PersonenAuswahlModal.svelte';
	import PersonenKacheln from '$lib/components/PersonenKacheln.svelte';

	let vorlageId = null;
	let vorlageName = '';
	let formData = {
		anwesenheit: '',
		abwesend: '',
		wer_geht_essen: '',
		leitung_im_haus: '',
		spaetdienst: '',
		fruehdienst_naechster_tag: '',
		sonstiges: '',
		planung: {}
	};
	let loading = true;
	let saving = false;

	let showAnwesenheitModal = false;
	let anwesenheitArray = [];
	let allePersonen = [];
	let raumDaten = [];
	let raeume = [];
	let raumLabels = {};

	// PAINT MODE: Ausgewählte Person für schnelles Zuweisen
	let selectedPerson = null;
	let eraserMode = false; // Radierer-Modus

	// PAINT MODE: Zuordnungsstatus für farbliche Kennzeichnung
	let zuordnungStatus = {};
	let kachelKlassen = {};

	const zeitslots = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

	// Berechne für alle Personen die Zuordnungen - reaktiv!
	$: {
		zuordnungStatus = {};
		anwesenheitArray.forEach(person => {
			let zugeordneteSlots = 0;
			zeitslots.forEach(slot => {
				raeume.forEach(raum => {
					const inhalt = formData.planung[slot]?.[raum] || '';
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
		const maxSlots = zeitslots.length;
		anwesenheitArray.forEach(person => {
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

	function createEmptyProtokoll() {
		const planung = {};
		zeitslots.forEach(slot => {
			planung[slot] = {};
			raeume.forEach(raum => {
				planung[slot][raum] = '';
			});
		});
		return {
			anwesenheit: '',
			abwesend: '',
			wer_geht_essen: '',
			leitung_im_haus: '',
			spaetdienst: '',
			fruehdienst_naechster_tag: '',
			sonstiges: '',
			planung
		};
	}

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		allePersonen = await getPersonen();
		raumDaten = await getRaeume();
		raeume = raumDaten.map(r => r.id);
		raumLabels = raumDaten.reduce((acc, r) => {
			acc[r.id] = r.label;
			return acc;
		}, {});

		const urlParams = new URLSearchParams(window.location.search);
		vorlageId = urlParams.get('id');

		if (vorlageId) {
			// Vorlage laden
			const vorlagen = await getVorlagen();
			const vorlage = vorlagen.find(v => v.id === vorlageId);
			if (vorlage) {
				vorlageName = vorlage.name;
				formData = vorlage.inhalt;
				anwesenheitArray = parsePersonenString(formData.anwesenheit);

				// Stelle sicher, dass alle Zeitslots/Räume existieren
				zeitslots.forEach(slot => {
					if (!formData.planung[slot]) {
						formData.planung[slot] = {};
					}
					raeume.forEach(raum => {
						if (formData.planung[slot][raum] === undefined) {
							formData.planung[slot][raum] = '';
						}
					});
				});
			} else {
				toast.show('Vorlage nicht gefunden!', 'error');
				goto('/settings');
				return;
			}
		} else {
			// Neue Vorlage - alle Personen standardmäßig anwesend
			formData = createEmptyProtokoll();
			anwesenheitArray = [...allePersonen];
			formData.anwesenheit = arrayToString(anwesenheitArray);
			formData.abwesend = '';
		}
		loading = false;
	});

	function parsePersonenString(str) {
		if (!str) return [];
		return str.split(',').map(s => s.trim()).filter(s => s);
	}

	function arrayToString(arr) {
		return arr.join(', ');
	}

	function handleAnwesenheitUpdate(event) {
		anwesenheitArray = event.detail;
		formData.anwesenheit = arrayToString(anwesenheitArray);
		const abwesendePersonen = allePersonen.filter(p => !anwesenheitArray.includes(p));
		formData.abwesend = arrayToString(abwesendePersonen);
	}

	function handlePlanungUpdate(event) {
		formData.planung = event.detail;
	}

	async function handleSave() {
		if (!vorlageName.trim()) {
			toast.show('Bitte gib einen Namen für die Vorlage ein!', 'error');
			return;
		}

		saving = true;
		const vorlagen = await getVorlagen();

		if (vorlageId) {
			// Vorlage aktualisieren
			const index = vorlagen.findIndex(v => v.id === vorlageId);
			if (index !== -1) {
				vorlagen[index] = {
					id: vorlageId,
					name: vorlageName.trim(),
					inhalt: formData
				};
			}
		} else {
			// Neue Vorlage erstellen
			const newVorlage = {
				id: crypto.randomUUID(),
				name: vorlageName.trim(),
				inhalt: formData
			};
			vorlagen.push(newVorlage);
		}

		const success = await saveVorlagen(vorlagen);
		if (success) {
			toast.show('Vorlage erfolgreich gespeichert!', 'success');
			setTimeout(() => {
				goto('/settings');
			}, 500);
		} else {
			toast.show('Fehler beim Speichern der Vorlage!', 'error');
		}
		saving = false;
	}

	function handleCancel() {
		goto('/settings');
	}

	// PAINT MODE: Person auswählen
	function selectPerson(person) {
		eraserMode = false; // Radierer deaktivieren
		if (selectedPerson === person) {
			selectedPerson = null; // Deselektieren wenn nochmal geklickt
		} else {
			selectedPerson = person;
		}
	}

	// PAINT MODE: Radierer aktivieren/deaktivieren
	function toggleEraser() {
		selectedPerson = null; // Person-Auswahl deaktivieren
		eraserMode = !eraserMode;
	}

	// PAINT MODE: Person in Tabellenfeld hinzufügen/entfernen (Toggle) ODER löschen mit Radierer
	function togglePersonInFeld(slot, raum) {
		// Radierer-Modus: Komplette Zelle löschen
		if (eraserMode) {
			formData.planung[slot][raum] = '';
			formData = formData;
			return;
		}

		// Normale Person-Zuweisung
		if (!selectedPerson) return; // Keine Person ausgewählt

		const currentValue = formData.planung[slot][raum] || '';
		const personen = currentValue.split(',').map(p => p.trim()).filter(p => p);

		if (personen.includes(selectedPerson)) {
			// Person entfernen
			const newPersonen = personen.filter(p => p !== selectedPerson);
			formData.planung[slot][raum] = newPersonen.join(', ');
		} else {
			// Person hinzufügen
			personen.push(selectedPerson);
			formData.planung[slot][raum] = personen.join(', ');
		}

		// Trigger Reaktivität
		formData = formData;
	}

	function autoResize(event) {
		const textarea = event.target;
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}
</script>

<PersonenAuswahlModal
	bind:show={showAnwesenheitModal}
	selectedPersonen={anwesenheitArray}
	on:select={handleAnwesenheitUpdate}
	on:close={() => showAnwesenheitModal = false}
/>

<div class="edit-container">
	{#if loading}
		<p class="loading-text">Lade Daten...</p>
	{:else}
		<div class="edit-header">
			<h1>{vorlageId ? 'Vorlage bearbeiten' : 'Neue Vorlage erstellen'}</h1>
		</div>

		<form on:submit|preventDefault={handleSave}>
			<section class="section">
				<div class="form-group">
					<label for="vorlageName">Vorlagenname *</label>
					<input
						type="text"
						id="vorlageName"
						bind:value={vorlageName}
						placeholder="z.B. Montag, Dienstag Kurz, Freitag Nachmittag..."
						required
					/>
				</div>
			</section>

			<section class="section">
				<h2>Allgemeine Informationen</h2>

				<div class="form-group">
					<label for="anwesenheit">Anwesenheit</label>
					<div class="input-with-button">
						<input
							type="text"
							id="anwesenheit"
							bind:value={formData.anwesenheit}
							placeholder="Klicken, um Anwesenheit zu bearbeiten..."
							on:click={() => showAnwesenheitModal = true}
							readonly
						/>
						<button
							type="button"
							class="select-btn"
							on:click={() => showAnwesenheitModal = true}
						>
							Anwesenheit bearbeiten
						</button>
					</div>
				</div>

				<div class="form-group">
					<label for="abwesend">Abwesend (automatisch)</label>
					<input
						type="text"
						id="abwesend"
						bind:value={formData.abwesend}
						placeholder="Wird automatisch ausgefüllt..."
						readonly
						disabled
					/>
				</div>

				<div class="form-group">
					<label for="wer_geht_essen">Wer geht essen</label>
					<input
						type="text"
						id="wer_geht_essen"
						bind:value={formData.wer_geht_essen}
						placeholder="z.B. Anna, Peter"
					/>
				</div>

				<div class="form-group">
					<label for="leitung_im_haus">Leitung im Haus</label>
					<input
						type="text"
						id="leitung_im_haus"
						bind:value={formData.leitung_im_haus}
						placeholder="z.B. Frau Müller"
					/>
				</div>

				<div class="form-group">
					<label for="spaetdienst">Spätdienst</label>
					<input
						type="text"
						id="spaetdienst"
						bind:value={formData.spaetdienst}
						placeholder="z.B. Herr Schmidt"
					/>
				</div>

				<div class="form-group">
					<label for="fruehdienst">Frühdienst nächster Tag</label>
					<input
						type="text"
						id="fruehdienst"
						bind:value={formData.fruehdienst_naechster_tag}
						placeholder="z.B. Frau Weber"
					/>
				</div>

				<div class="form-group">
					<label for="sonstiges">Sonstiges</label>
					<textarea
						id="sonstiges"
						bind:value={formData.sonstiges}
						rows="4"
						placeholder="Weitere Anmerkungen..."
					></textarea>
				</div>
			</section>

			{#if anwesenheitArray.length > 0}
				<section class="section">
					<PersonenKacheln
						anwesendePersonen={anwesenheitArray}
						planung={formData.planung}
						{zeitslots}
						{raeume}
						{raumLabels}
						on:update={handlePlanungUpdate}
					/>
				</section>

				<!-- PAINT MODE: Schnellzuweisung -->
				<section class="section paint-mode-section">
					<h2>✏️ Schnellzuweisung</h2>
					<p class="paint-mode-hint">
						Klicke auf eine Person oder den Radierer, dann auf Felder in der Tabelle.
					</p>
					{#if selectedPerson}
						<p class="selected-person-indicator">
							<strong class="selected-person-name">Ausgewählt: {selectedPerson}</strong>
						</p>
					{:else if eraserMode}
						<p class="selected-person-indicator">
							<strong class="selected-person-name eraser-active">🗑️ Radierer aktiv</strong>
						</p>
					{/if}

					<div class="paint-mode-personen">
						{#each anwesenheitArray as person}
							<button
								type="button"
								class="paint-mode-person {kachelKlassen[person] || 'nicht-zugeordnet'}"
								class:active={selectedPerson === person}
								on:click={() => selectPerson(person)}
							>
								<span class="person-name-paint">{person}</span>
								<span class="status-badge-paint">{zuordnungStatus[person] || 0}/{zeitslots.length}</span>
							</button>
						{/each}

						<!-- Radierer-Button -->
						<button
							type="button"
							class="paint-mode-person eraser-btn"
							class:active={eraserMode}
							on:click={toggleEraser}
							title="Radierer: Klicken um Zellen zu leeren"
						>
							<span class="person-name-paint">🗑️</span>
							<span class="status-badge-paint">Radierer</span>
						</button>
					</div>

					<div class="paint-mode-legende">
						<span class="legende-item"><span class="dot nicht-zugeordnet"></span> Nicht zugeordnet</span>
						<span class="legende-item"><span class="dot teilweise"></span> Teilweise zugeordnet</span>
						<span class="legende-item"><span class="dot vollstaendig"></span> Vollständig zugeordnet</span>
					</div>
				</section>
			{/if}

			<section class="section">
				<h2>Belegungsplanung (Übersicht)</h2>

				<div class="matrix-container">
					<div class="matrix-scroll">
						<table class="matrix">
							<thead>
								<tr>
									<th class="raum-header">Raum / Zeit</th>
									{#each zeitslots as slot}
										<th class="zeit-header">{slot}</th>
									{/each}
								</tr>
							</thead>
							<tbody>
								{#each raeume as raum}
									<tr>
										<td class="raum-label">{raumLabels[raum]}</td>
										{#each zeitslots as slot}
											<td
												class="matrix-cell"
												class:paint-mode-active={selectedPerson || eraserMode}
												on:click={() => togglePersonInFeld(slot, raum)}
											>
												{#if selectedPerson || eraserMode}
													<!-- Paint Mode: Zeige nur Text, ganze Zelle ist klickbar -->
													<div class="matrix-text">
														{formData.planung[slot][raum] || '...'}
													</div>
												{:else}
													<!-- Normaler Modus: Textarea zum Eingeben -->
													<textarea
														bind:value={formData.planung[slot][raum]}
														placeholder="..."
														class="matrix-input"
														rows="1"
														on:input={autoResize}
													></textarea>
												{/if}
											</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<div class="button-group">
				<button type="button" on:click={handleCancel} class="btn-cancel">
					Abbrechen
				</button>
				<button type="submit" disabled={saving} class="btn-save">
					{saving ? 'Speichert...' : 'Vorlage speichern'}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	input:disabled {
		background-color: var(--border-color);
		cursor: not-allowed;
	}

	.edit-container {
		padding: 20px;
		max-width: 1400px;
		margin: 0 auto;
		background: var(--bg-primary);
		min-height: 100vh;
	}

	.loading-text {
		text-align: center;
		font-size: 1.2rem;
		color: var(--text-secondary);
		padding: 60px 20px;
	}

	.edit-header {
		margin-bottom: 30px;
	}

	h1 {
		color: var(--text-primary);
		margin: 0;
	}

	h2 {
		color: var(--text-primary);
		margin-bottom: 20px;
		font-size: 1.3rem;
	}

	.section {
		background: var(--bg-secondary);
		padding: 30px;
		border-radius: 12px;
		box-shadow: 0 2px 8px var(--shadow);
		margin-bottom: 30px;
	}

	.form-group {
		margin-bottom: 20px;
	}

	label {
		display: block;
		margin-bottom: 8px;
		color: var(--text-primary);
		font-weight: 500;
	}

	input[type="text"],
	textarea {
		width: 100%;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		font-family: inherit;
		transition: border-color 0.3s;
		box-sizing: border-box;
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	input:focus,
	textarea:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.input-with-button {
		display: flex;
		gap: 10px;
	}

	.input-with-button input {
		flex: 1;
		cursor: pointer;
	}

	.select-btn {
		padding: 12px 24px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 14px;
		font-weight: 600;
		white-space: nowrap;
	}

	.select-btn:hover {
		background: var(--accent-hover);
	}

	.matrix-container {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}

	.matrix {
		width: 100%;
		border-collapse: collapse;
		min-width: 600px;
	}

	.matrix th,
	.matrix td {
		border: 1px solid var(--border-color);
		padding: 8px;
		text-align: center;
		vertical-align: top;
	}

	.matrix thead th {
		background: var(--accent-color);
		color: white;
		font-weight: 600;
		position: sticky;
		top: 0;
		z-index: 10;
	}

	.raum-header {
		text-align: left;
		min-width: 150px;
	}

	.zeit-header {
		min-width: 150px;
	}

	.raum-label {
		background: var(--bg-primary);
		font-weight: 500;
		text-align: left;
		padding-left: 12px;
		color: var(--text-primary);
	}

	.matrix-input {
		width: 100%;
		padding: 8px;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 14px;
		box-sizing: border-box;
		background: var(--bg-secondary);
		color: var(--text-primary);
		resize: none;
		overflow: hidden;
		min-height: 36px;
		line-height: 1.4;
	}

	.matrix-input:focus {
		border-color: var(--accent-color);
		outline: none;
	}

	.button-group {
		display: flex;
		gap: 15px;
		justify-content: flex-end;
		margin-top: 30px;
	}

	button {
		padding: 14px 28px;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.3s;
	}

	.btn-save {
		background: var(--accent-color);
		color: white;
	}

	.btn-save:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.btn-save:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.btn-cancel {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
	}

	.btn-cancel:hover {
		background: var(--border-color);
	}

	/* PAINT MODE Styles */
	.paint-mode-section {
		background: var(--bg-secondary);
		border: 2px dashed var(--accent-color);
	}

	.paint-mode-hint {
		color: var(--text-secondary);
		font-size: 0.9rem;
		margin: 0.5rem 0 1rem 0;
	}

	.selected-person-indicator {
		margin: 0.5rem 0;
		padding: 0.5rem;
		background: var(--accent-color);
		color: white;
		border-radius: 6px;
		text-align: center;
	}

	.selected-person-name {
		font-size: 1rem;
	}

	.selected-person-name.eraser-active {
		color: #dc3545;
	}

	.paint-mode-personen {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 1rem;
		margin: 1.5rem 0;
	}

	.paint-mode-person {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		border: 2px solid transparent;
		border-radius: 8px;
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
		transition: all 0.2s ease;
		min-height: 80px;
	}

	:global(.dark-mode) .paint-mode-person {
		background: #2d2d2d;
	}

	.person-name-paint {
		font-weight: 600;
		margin-bottom: 0.5rem;
	}

	.status-badge-paint {
		font-size: 0.85rem;
		padding: 0.25rem 0.6rem;
		border-radius: 12px;
		background: var(--border-color);
		font-weight: 500;
		color: var(--text-primary);
	}

	/* Farbcodierung für Paint Mode Buttons */
	.paint-mode-person.nicht-zugeordnet {
		border-color: #3498db;
	}

	.paint-mode-person.nicht-zugeordnet .status-badge-paint {
		background: #3498db;
		color: white;
	}

	.paint-mode-person.teilweise {
		border-color: #f39c12;
	}

	.paint-mode-person.teilweise .status-badge-paint {
		background: #f39c12;
		color: white;
	}

	.paint-mode-person.vollstaendig {
		border-color: #27ae60;
	}

	.paint-mode-person.vollstaendig .status-badge-paint {
		background: #27ae60;
		color: white;
	}

	.paint-mode-person:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 8px var(--shadow);
	}

	:global(.dark-mode) .paint-mode-person:hover {
		box-shadow: 0 4px 8px rgba(255, 255, 255, 0.1);
	}

	.paint-mode-person.active {
		transform: scale(1.05);
		box-shadow: 0 0 0 3px var(--accent-color);
		background: var(--accent-color);
		color: white;
		border-color: var(--accent-color);
	}

	.paint-mode-person.active .person-name-paint,
	.paint-mode-person.active .status-badge-paint {
		color: white;
	}

	.paint-mode-person.active .status-badge-paint {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Radierer-Button */
	.paint-mode-person.eraser-btn {
		border-color: #dc3545;
	}

	.paint-mode-person.eraser-btn .status-badge-paint {
		background: #dc3545;
		color: white;
	}

	.paint-mode-person.eraser-btn.active {
		background: #dc3545;
		border-color: #dc3545;
	}

	.paint-mode-person.eraser-btn.active .status-badge-paint {
		background: rgba(255, 255, 255, 0.3);
	}

	.paint-mode-legende {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		font-size: 0.9rem;
		padding-top: 1rem;
		border-top: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	.paint-mode-legende .legende-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.paint-mode-legende .dot {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		display: inline-block;
	}

	.paint-mode-legende .dot.nicht-zugeordnet {
		background: #3498db;
	}

	.paint-mode-legende .dot.teilweise {
		background: #f39c12;
	}

	.paint-mode-legende .dot.vollstaendig {
		background: #27ae60;
	}

	/* Matrix-Zellen im Paint Mode */
	.matrix-cell {
		cursor: default;
	}

	.matrix-cell.paint-mode-active {
		cursor: pointer;
	}

	.matrix-cell.paint-mode-active:hover {
		background: rgba(52, 152, 219, 0.1);
	}

	:global(.dark-mode) .matrix-cell.paint-mode-active:hover {
		background: rgba(52, 152, 219, 0.2);
	}

	.matrix-text {
		padding: 8px;
		min-height: 36px;
		line-height: 1.4;
		font-size: 14px;
		color: var(--text-primary);
		white-space: pre-wrap;
	}

	@media (max-width: 768px) {
		.edit-container {
			padding: 15px;
		}

		.section {
			padding: 20px;
		}

		input[type="text"],
		textarea,
		button {
			font-size: 18px;
			padding: 16px;
		}

		.input-with-button {
			flex-direction: column;
		}

		.select-btn {
			width: 100%;
		}

		.matrix-input {
			font-size: 16px;
			padding: 12px;
		}

		.button-group {
			flex-direction: column;
		}

		button {
			width: 100%;
		}
	}
</style>
