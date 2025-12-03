<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/stores';
	import { getProtokoll, saveProtokoll, getToday } from '$lib/protokollService';
	// NEU: getPersonen und getRaeume importieren
	import { getPersonen, getRaeume, getVorlagen } from '$lib/einstellungenService';
	import { getNachrichten } from '$lib/teamNachrichtenService';
	import { darkMode } from '$lib/darkModeStore';
	import { toast } from '$lib/toastStore';
	import PersonenAuswahlModal from '$lib/components/PersonenAuswahlModal.svelte';
	import PersonenKacheln from '$lib/components/PersonenKacheln.svelte';
	import TeamNachrichtenModal from '$lib/components/TeamNachrichtenModal.svelte';
	// REALTIME: Import für gleichzeitiges Bearbeiten
	import {
		registerEditor,
		unregisterEditor,
		updateHeartbeat,
		getActiveEditors,
		subscribeToProtokoll,
		subscribeToActiveEditors
	} from '$lib/realtimeService';

	let currentDate = getToday();
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

	// Hilfsfunktion: Leeres Protokoll mit aktuellen Räumen erstellen
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

	// Nur noch ein Modal State
	let showAnwesenheitModal = false;
	let anwesenheitArray = [];
	
	// NEU: Variable für die komplette Personenliste
	let allePersonen = [];

	// Raumliste - wird dynamisch geladen
	let raumDaten = [];
	let raeume = [];
	let raumLabels = {};

	// Vorlagen
	let vorlagen = [];
	let selectedVorlageId = '';
	let isNewProtokoll = true;

	// PAINT MODE: Ausgewählte Person für schnelles Zuweisen
	let selectedPerson = null;

	// PAINT MODE: Zuordnungsstatus für farbliche Kennzeichnung
	let zuordnungStatus = {};
	let kachelKlassen = {};

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

	// Team-Nachrichten
	let currentUsername = '';
	let showNachrichtenModal = false;
	let messageCount = 0;

	// REALTIME: Variablen für gleichzeitiges Bearbeiten
	let activeEditors = [];
	let heartbeatInterval;
	let protokollSubscription;
	let editorsSubscription;
	let messagesSubscription; // Realtime für Badge-Counter

	const zeitslots = ['12:25-13:10', '13:15-14:00', '14:00-14:30'];

	onMount(async () => {
		const { data } = await supabase.auth.getSession();
		if (!data.session) {
			goto('/');
			return;
		}

		// Username extrahieren
		const email = data.session.user.email;
		currentUsername = email.split('@')[0];

		// NEU: Lade die komplette Personenliste und Raumliste
		allePersonen = await getPersonen();
		raumDaten = await getRaeume();
		vorlagen = await getVorlagen();
		await loadMessageCount();

		// Erstelle Arrays und Objekte für Räume
		raeume = raumDaten.map(r => r.id);
		raumLabels = raumDaten.reduce((acc, r) => {
			acc[r.id] = r.label;
			return acc;
		}, {});

		const urlParams = new URLSearchParams(window.location.search);
		const dateParam = urlParams.get('date');
		if (dateParam) {
			currentDate = dateParam;
		}

		const protokoll = await getProtokoll(currentDate);
		if (protokoll) {
			isNewProtokoll = false;
			formData = protokoll.inhalt;
			anwesenheitArray = parsePersonenString(formData.anwesenheit);
			// Stelle sicher, dass das Abwesend-Feld auch initial korrekt ist, falls es manuell geändert wurde
			if (!formData.abwesend) {
				const abwesendePersonen = allePersonen.filter(p => !anwesenheitArray.includes(p));
				formData.abwesend = arrayToString(abwesendePersonen);
			}

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
			isNewProtokoll = true;
			formData = createEmptyProtokoll();
		}
		loading = false;

		// REALTIME: Editor registrieren und Subscriptions starten
		await registerEditor(currentDate, currentUsername);

		// Lade aktive Editoren
		activeEditors = await getActiveEditors(currentDate);

		// Heartbeat alle 10 Sekunden senden
		heartbeatInterval = setInterval(async () => {
			await updateHeartbeat(currentDate, currentUsername);
		}, 10000);

		// Subscribe zu Protokoll-Änderungen
		protokollSubscription = subscribeToProtokoll(currentDate, async (payload) => {
			// Wenn jemand anderes speichert, zeige Warnung und frage ob neu laden
			if (payload.eventType === 'UPDATE') {
				toast.show('⚠️ Das Protokoll wurde von einem anderen Nutzer geändert!', 'warning', 5000);
				// Optional: Automatisch neu laden nach 2 Sekunden
				setTimeout(async () => {
					const neuesProtokoll = await getProtokoll(currentDate);
					if (neuesProtokoll && confirm('Das Protokoll wurde geändert. Möchten Sie die Seite neu laden? (Ungespeicherte Änderungen gehen verloren)')) {
						window.location.reload();
					}
				}, 2000);
			}
		});

		// Subscribe zu Änderungen der aktiven Editoren
		editorsSubscription = subscribeToActiveEditors(currentDate, (editors) => {
			activeEditors = editors.filter(e => e.username !== currentUsername);
		});

		// REALTIME: Subscribe zu Team-Nachrichten für Badge-Counter
		messagesSubscription = supabase
			.channel('edit-messages-badge')
			.on(
				'postgres_changes',
				{
					event: '*',
					schema: 'public',
					table: 'team_nachrichten'
				},
				async () => {
					await loadMessageCount(); // Badge aktualisieren
				}
			)
			.subscribe();
	});

	// REALTIME: Cleanup beim Verlassen der Seite
	onDestroy(async () => {
		// Editor abmelden
		if (currentDate && currentUsername) {
			await unregisterEditor(currentDate, currentUsername);
		}

		// Heartbeat stoppen
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
		}

		// Subscriptions beenden
		if (protokollSubscription) {
			await supabase.removeChannel(protokollSubscription);
		}
		if (editorsSubscription) {
			await supabase.removeChannel(editorsSubscription);
		}
		if (messagesSubscription) {
			await supabase.removeChannel(messagesSubscription);
		}
	});

	function parsePersonenString(str) {
		if (!str) return [];
		return str.split(',').map(s => s.trim()).filter(s => s);
	}

	function arrayToString(arr) {
		return arr.join(', ');
	}

	// Umbenannt und Logik angepasst
	function handleAnwesenheitUpdate(event) {
		anwesenheitArray = event.detail;
		formData.anwesenheit = arrayToString(anwesenheitArray);

		// NEU: Leite die Abwesenden automatisch ab
		const abwesendePersonen = allePersonen.filter(p => !anwesenheitArray.includes(p));
		formData.abwesend = arrayToString(abwesendePersonen);
	}

	function handlePlanungUpdate(event) {
		formData.planung = event.detail;
	}

	// Validierung & Warnungen - reaktiv
	let validierung = {
		eingeteilt: 0,
		anwesend: 0,
		doppelbelegungen: [],
		fehlendeFelderWarn: [],
		fehlendeFelderInfo: []
	};

	$: {
		// Zähle eingeteilte Personen
		const eingeteiltePersonenSet = new Set();
		zeitslots.forEach(slot => {
			raeume.forEach(raum => {
				const inhalt = formData.planung[slot]?.[raum] || '';
				const personen = inhalt.split(',').map(p => p.trim()).filter(p => p);
				personen.forEach(p => eingeteiltePersonenSet.add(p));
			});
		});

		// Prüfe Doppelbelegungen (Person in mehreren Räumen zur gleichen Zeit)
		const doppelbelegungen = [];
		zeitslots.forEach(slot => {
			const personenInSlot = {};
			raeume.forEach(raum => {
				const inhalt = formData.planung[slot]?.[raum] || '';
				const personen = inhalt.split(',').map(p => p.trim()).filter(p => p);
				personen.forEach(person => {
					if (!personenInSlot[person]) {
						personenInSlot[person] = [];
					}
					personenInSlot[person].push(raumLabels[raum] || raum);
				});
			});

			// Finde Personen in mehreren Räumen
			Object.entries(personenInSlot).forEach(([person, raeumeList]) => {
				if (raeumeList.length > 1) {
					doppelbelegungen.push({
						person,
						slot,
						raeume: raeumeList
					});
				}
			});
		});

		// Prüfe fehlende wichtige Felder
		const fehlendeFelderWarn = [];
		const fehlendeFelderInfo = [];

		if (!formData.leitung_im_haus?.trim()) fehlendeFelderWarn.push('Leitung im Haus');
		if (!formData.spaetdienst?.trim()) fehlendeFelderWarn.push('Spätdienst');
		if (!formData.fruehdienst_naechster_tag?.trim()) fehlendeFelderInfo.push('Frühdienst (nächster Tag)');
		if (!formData.wer_geht_essen?.trim()) fehlendeFelderInfo.push('Wer geht essen');

		validierung = {
			eingeteilt: eingeteiltePersonenSet.size,
			anwesend: anwesenheitArray.length,
			doppelbelegungen,
			fehlendeFelderWarn,
			fehlendeFelderInfo
		};
	}

	function autoResize(event) {
		const textarea = event.target;
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	async function handleSave() {
		saving = true;
		const result = await saveProtokoll(currentDate, formData);
		
		if (result) {
			toast.show('Protokoll erfolgreich gespeichert!', 'success');
			setTimeout(() => {
				// GEÄNDERT: Gehe zur Dashboard-Seite mit dem korrekten Datum
				goto(`/dashboard?date=${currentDate}`);
			}, 500);
		} else {
			toast.show('Fehler beim Speichern des Protokolls!', 'error');
		}
		saving = false;
	}

	function handleCancel() {
		// GEÄNDERT: Gehe zur Dashboard-Seite mit dem korrekten Datum
		goto(`/dashboard?date=${currentDate}`);
	}

	function applyVorlage() {
		if (!selectedVorlageId) return;

		const vorlage = vorlagen.find(v => v.id === selectedVorlageId);
		if (!vorlage) return;

		// Kopiere die Vorlage in formData
		formData = JSON.parse(JSON.stringify(vorlage.inhalt));
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

		toast.show(`Vorlage "${vorlage.name}" wurde angewendet!`, 'success');
	}

	async function loadMessageCount() {
		const nachrichten = await getNachrichten();
		messageCount = nachrichten.length;
	}

	async function openNachrichtenModal() {
		showNachrichtenModal = true;
		await loadMessageCount();
	}

	function closeNachrichtenModal() {
		showNachrichtenModal = false;
		loadMessageCount();
	}

	// PAINT MODE: Person auswählen
	function selectPerson(person) {
		if (selectedPerson === person) {
			selectedPerson = null; // Deselektieren wenn nochmal geklickt
		} else {
			selectedPerson = person;
		}
	}

	// PAINT MODE: Person in Tabellenfeld hinzufügen/entfernen (Toggle)
	function togglePersonInFeld(slot, raum) {
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
</script>

<TeamNachrichtenModal
	bind:show={showNachrichtenModal}
	{currentUsername}
/>

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
			<div class="header-left">
				<h1>Protokoll bearbeiten</h1>
				<p class="date">Datum: {currentDate}</p>
			</div>
			<button on:click={openNachrichtenModal} class="nachrichten-btn" title="Team-Notizen">
				📝
				{#if messageCount > 0}
					<span class="badge">{messageCount}</span>
				{/if}
			</button>
		</div>

		<!-- REALTIME: Warnung wenn andere Editoren aktiv sind -->
		{#if activeEditors.length > 0}
			<div class="realtime-warning">
				<span class="warning-icon">⚠️</span>
				<span class="warning-text">
					{#if activeEditors.length === 1}
						<strong>{activeEditors[0].username}</strong> bearbeitet dieses Protokoll gerade auch.
					{:else}
						<strong>{activeEditors.map(e => e.username).join(', ')}</strong> bearbeiten dieses Protokoll gerade auch.
					{/if}
					Änderungen können überschrieben werden!
				</span>
			</div>
		{/if}

		{#if isNewProtokoll && vorlagen.length > 0}
			<section class="section vorlage-section">
				<h2>Aus Vorlage erstellen</h2>
				<p class="vorlage-description">
					Du kannst eine vorhandene Vorlage als Ausgangspunkt verwenden.
				</p>
				<div class="vorlage-auswahl">
					<select bind:value={selectedVorlageId} class="vorlage-select">
						<option value="">-- Keine Vorlage verwenden --</option>
						{#each vorlagen as vorlage}
							<option value={vorlage.id}>{vorlage.name}</option>
						{/each}
					</select>
					<button
						type="button"
						on:click={applyVorlage}
						disabled={!selectedVorlageId}
						class="vorlage-apply-btn"
					>
						Vorlage anwenden
					</button>
				</div>
			</section>
		{/if}

		<form on:submit|preventDefault={handleSave}>
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

			<!-- Validierung & Warnungen -->
			{#if anwesenheitArray.length > 0 && (validierung.doppelbelegungen.length > 0 || validierung.fehlendeFelderWarn.length > 0 || validierung.fehlendeFelderInfo.length > 0 || validierung.eingeteilt < validierung.anwesend)}
				<section class="section validierung-box">
					<h2>⚠️ Hinweise & Warnungen</h2>

					<!-- Eingeteilte Personen -->
					<div class="validierung-item">
						<div class="validierung-status">
							{#if validierung.eingeteilt === validierung.anwesend}
								<span class="status-icon success">✓</span>
								<span class="status-text success">Alle {validierung.anwesend} anwesenden Personen sind eingeteilt</span>
							{:else if validierung.eingeteilt > validierung.anwesend}
								<span class="status-icon warning">⚠</span>
								<span class="status-text warning">{validierung.eingeteilt} Personen eingeteilt, aber nur {validierung.anwesend} anwesend</span>
							{:else}
								<span class="status-icon warning">⚠</span>
								<span class="status-text warning">{validierung.eingeteilt} von {validierung.anwesend} Personen eingeteilt ({validierung.anwesend - validierung.eingeteilt} fehlen noch)</span>
							{/if}
						</div>
					</div>

					<!-- Doppelbelegungen -->
					{#if validierung.doppelbelegungen.length > 0}
						<div class="validierung-item error">
							<div class="validierung-status">
								<span class="status-icon error">✗</span>
								<span class="status-text error">Doppelbelegungen gefunden:</span>
							</div>
							<ul class="validierung-details">
								{#each validierung.doppelbelegungen as doppel}
									<li><strong>{doppel.person}</strong> ist um {doppel.slot} in mehreren Räumen: {doppel.raeume.join(', ')}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Fehlende wichtige Felder -->
					{#if validierung.fehlendeFelderWarn.length > 0}
						<div class="validierung-item warning">
							<div class="validierung-status">
								<span class="status-icon warning">⚠</span>
								<span class="status-text warning">Wichtige Felder fehlen:</span>
							</div>
							<ul class="validierung-details">
								{#each validierung.fehlendeFelderWarn as feld}
									<li>{feld}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<!-- Fehlende Info-Felder -->
					{#if validierung.fehlendeFelderInfo.length > 0}
						<div class="validierung-item info">
							<div class="validierung-status">
								<span class="status-icon info">ℹ</span>
								<span class="status-text info">Optional: Folgende Felder sind leer:</span>
							</div>
							<ul class="validierung-details">
								{#each validierung.fehlendeFelderInfo as feld}
									<li>{feld}</li>
								{/each}
							</ul>
						</div>
					{/if}
				</section>
			{/if}

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
			{/if}

			<!-- PAINT MODE: Personen auswählen -->
			{#if anwesenheitArray.length > 0}
				<section class="section paint-mode-section">
					<h2>✏️ Schnellzuweisung</h2>
					<p class="paint-mode-hint">
						Klicke auf eine Person, dann auf Felder in der Tabelle um sie hinzuzufügen/zu entfernen.
						{#if selectedPerson}
							<strong class="selected-person-name">Ausgewählt: {selectedPerson}</strong>
						{/if}
					</p>
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
												class:paint-mode-active={selectedPerson}
												on:click={() => togglePersonInFeld(slot, raum)}
												title={selectedPerson ? `Klicken um ${selectedPerson} hinzuzufügen/zu entfernen` : ''}
											>
												{#if selectedPerson}
													<!-- Paint Mode: Zeige nur Text, ganze Zelle ist klickbar -->
													<div class="matrix-text-display">
														{formData.planung[slot][raum] || '...'}
													</div>
												{:else}
													<!-- Normal Mode: Zeige Textarea zum Editieren -->
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
					{saving ? 'Speichert...' : 'Speichern'}
				</button>
			</div>
		</form>
	{/if}
</div>

<style>
	/* Hinzufügen für das deaktivierte Feld */
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
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 20px;
	}

	.header-left {
		flex: 1;
	}

	h1 {
		color: var(--text-primary);
		margin: 0 0 10px 0;
	}

	.date {
		color: var(--text-secondary);
		font-size: 1.1rem;
	}

	.nachrichten-btn {
		position: relative;
		padding: 12px 16px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
		flex-shrink: 0;
	}

	.nachrichten-btn:hover {
		background: var(--accent-hover);
	}

	.nachrichten-btn .badge {
		position: absolute;
		top: -6px;
		right: -6px;
		background: #dc3545;
		color: white;
		font-size: 11px;
		font-weight: 600;
		padding: 2px 6px;
		border-radius: 10px;
		min-width: 18px;
		text-align: center;
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

	.matrix-text-display {
		width: 100%;
		padding: 8px;
		font-size: 14px;
		min-height: 36px;
		line-height: 1.4;
		color: var(--text-primary);
		white-space: pre-wrap;
		word-break: break-word;
		text-align: center;
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

	/* Validierung & Warnungen */
	.validierung-box {
		border-left: 4px solid #f39c12;
		background: var(--bg-secondary);
	}

	.validierung-item {
		margin-bottom: 1rem;
		padding: 1rem;
		border-radius: 8px;
		background: var(--bg-primary);
	}

	.validierung-item:last-child {
		margin-bottom: 0;
	}

	.validierung-status {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.status-icon {
		font-size: 1.2rem;
		font-weight: bold;
	}

	.status-icon.success {
		color: #27ae60;
	}

	.status-icon.warning {
		color: #f39c12;
	}

	.status-icon.error {
		color: #e74c3c;
	}

	.status-icon.info {
		color: #3498db;
	}

	.status-text {
		font-weight: 500;
	}

	.status-text.success {
		color: #27ae60;
	}

	.status-text.warning {
		color: #f39c12;
	}

	.status-text.error {
		color: #e74c3c;
	}

	.status-text.info {
		color: var(--text-secondary);
	}

	.validierung-details {
		margin: 0.5rem 0 0 2rem;
		padding: 0;
		list-style: disc;
		color: var(--text-primary);
	}

	.validierung-details li {
		margin-bottom: 0.3rem;
	}

	.validierung-item.error {
		border-left: 3px solid #e74c3c;
	}

	.validierung-item.warning {
		border-left: 3px solid #f39c12;
	}

	.validierung-item.info {
		border-left: 3px solid #3498db;
	}

	.vorlage-section {
		border-left: 4px solid var(--accent-color);
	}

	.vorlage-description {
		color: var(--text-secondary);
		margin-bottom: 20px;
		font-size: 0.95rem;
	}

	.vorlage-auswahl {
		display: flex;
		gap: 10px;
		align-items: center;
	}

	.vorlage-select {
		flex: 1;
		padding: 12px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-primary);
		color: var(--text-primary);
		cursor: pointer;
	}

	.vorlage-select:focus {
		outline: none;
		border-color: var(--accent-color);
	}

	.vorlage-apply-btn {
		padding: 12px 24px;
		background: var(--accent-color);
		color: white;
		border: none;
		border-radius: 8px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		white-space: nowrap;
	}

	.vorlage-apply-btn:hover:not(:disabled) {
		background: var(--accent-hover);
	}

	.vorlage-apply-btn:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	/* REALTIME: Warnung für gleichzeitiges Bearbeiten */
	.realtime-warning {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%);
		border: 2px solid #ffc107;
		border-radius: 12px;
		margin-bottom: 20px;
		animation: pulse-warning 2s ease-in-out infinite;
	}

	:global(.dark-mode) .realtime-warning {
		background: linear-gradient(135deg, #5a4a1f 0%, #7a6a2f 100%);
		border-color: #ffc107;
	}

	@keyframes pulse-warning {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.95;
			transform: scale(1.005);
		}
	}

	.warning-icon {
		font-size: 24px;
		flex-shrink: 0;
		animation: shake 0.5s ease-in-out infinite;
	}

	@keyframes shake {
		0%, 100% { transform: rotate(0deg); }
		25% { transform: rotate(-5deg); }
		75% { transform: rotate(5deg); }
	}

	.warning-text {
		color: #856404;
		font-size: 0.95rem;
		line-height: 1.4;
	}

	:global(.dark-mode) .warning-text {
		color: #ffd966;
	}

	.warning-text strong {
		color: #664d03;
		font-weight: 600;
	}

	:global(.dark-mode) .warning-text strong {
		color: #ffc107;
	}

	/* PAINT MODE Styles */
	.paint-mode-section {
		background: var(--bg-secondary);
		border-left: 4px solid #3498db;
	}

	.paint-mode-hint {
		color: var(--text-secondary);
		margin-bottom: 15px;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.selected-person-name {
		color: #667eea;
		font-weight: 600;
		margin-left: 10px;
	}

	:global(.dark-mode) .selected-person-name {
		color: #9f7aea;
	}

	.paint-mode-personen {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.paint-mode-person {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 2px solid transparent;
		border-radius: 8px;
		cursor: pointer;
		font-size: 15px;
		font-weight: 500;
		color: var(--text-primary);
		transition: all 0.2s ease;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
		min-width: 100px;
	}

	:global(.dark-mode) .paint-mode-person {
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	}

	.person-name-paint {
		font-weight: 600;
		font-size: 15px;
	}

	.status-badge-paint {
		font-size: 0.75rem;
		padding: 2px 8px;
		border-radius: 10px;
		background: var(--border-color);
		font-weight: 600;
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
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	:global(.dark-mode) .paint-mode-person:hover {
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
	}

	.paint-mode-person.active {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		border-color: #667eea;
		color: white;
		transform: scale(1.05);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.paint-mode-person.active .person-name-paint,
	.paint-mode-person.active .status-badge-paint {
		color: white;
	}

	.paint-mode-person.active .status-badge-paint {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Matrix-Zellen im Paint Mode */
	.matrix-cell {
		position: relative;
	}

	.matrix-cell.paint-mode-active {
		cursor: pointer;
		transition: background-color 0.2s ease;
	}

	.matrix-cell.paint-mode-active:hover {
		background-color: rgba(102, 126, 234, 0.1);
	}

	:global(.dark-mode) .matrix-cell.paint-mode-active:hover {
		background-color: rgba(102, 126, 234, 0.2);
	}

	.matrix-cell.paint-mode-active:hover::after {
		content: '✏️';
		position: absolute;
		top: 5px;
		right: 5px;
		font-size: 14px;
		opacity: 0.6;
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

		.vorlage-auswahl {
			flex-direction: column;
		}

		.vorlage-apply-btn {
			width: 100%;
		}
	}
</style>