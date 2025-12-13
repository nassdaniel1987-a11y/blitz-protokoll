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
	import { saveVorlagen } from '$lib/einstellungenService';
	// REALTIME: Import für gleichzeitiges Bearbeiten
	import {
		registerEditor,
		unregisterEditor,
		updateHeartbeat,
		getActiveEditors,
		subscribeToProtokoll,
		subscribeToActiveEditors,
		registerFieldEditor,
		unregisterFieldEditor,
		getActiveFieldEditors,
		subscribeToFieldEditors
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

	// Vorlage-Speichern Modal
	let showSaveTemplateModal = false;
	let templateName = '';

	// Hilfe-Tooltips
	let activeTooltip = null;
	
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
	let eraserMode = false; // Radierer-Modus

	// PAINT MODE: Zuordnungsstatus für farbliche Kennzeichnung
	let zuordnungStatus = {};
	let kachelKlassen = {};

	// Toggle für erweiterte Kacheln-Ansicht
	let showDetailedKacheln = false;

	// Berechne für alle Personen die Zuordnungen - reaktiv!
	// Hinweis: Der erste Slot (11:40-12:25) wird nicht mitgezählt, da er selten vergeben wird
	$: {
		zuordnungStatus = {};
		anwesenheitArray.forEach(person => {
			let zugeordneteSlots = 0;
			// Überspringe den ersten Slot (Index 0: 11:40-12:25)
			zeitslots.slice(1).forEach(slot => {
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
		const maxSlots = 3; // Nur 3 Slots werden gezählt (ohne 11:40-12:25)
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
	let fieldEditorsSubscription; // Realtime für Feld-Editoren
	let activeFieldEditors = {}; // Map: fieldKey -> username
	let currentEditingField = null; // Aktuell bearbeitetes Feld (fieldKey)

	const zeitslots = ['11:40-12:25', '12:25-13:10', '13:10-14:00', '14:00-14:30'];

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
			// NEU: Bei neuem Protokoll sind standardmäßig ALLE Personen anwesend
			anwesenheitArray = [...allePersonen];
			formData.anwesenheit = arrayToString(anwesenheitArray);
			formData.abwesend = ''; // Niemand abwesend
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

		// Subscribe zu Protokoll-Änderungen - mit automatischem Merge
		protokollSubscription = subscribeToProtokoll(currentDate, async (payload) => {
			// Wenn jemand anderes speichert, lade Updates automatisch
			if (payload.eventType === 'UPDATE') {
				const neuesProtokoll = await getProtokoll(currentDate);
				if (neuesProtokoll) {
					// Merge nur Felder, die der User nicht gerade bearbeitet
					const currentFieldKey = currentEditingField;

					// Merge Planung (außer aktuell bearbeitetes Feld)
					zeitslots.forEach(slot => {
						raeume.forEach(raum => {
							const fieldKey = `${slot}_${raum}`;
							// Nur updaten wenn User dieses Feld nicht gerade bearbeitet
							if (fieldKey !== currentFieldKey) {
								if (formData.planung[slot] && formData.planung[slot][raum] !== neuesProtokoll.inhalt.planung[slot]?.[raum]) {
									formData.planung[slot][raum] = neuesProtokoll.inhalt.planung[slot]?.[raum] || '';
								}
							}
						});
					});

					// Merge andere Felder (wenn nicht fokussiert)
					if (currentFieldKey !== 'anwesenheit') formData.anwesenheit = neuesProtokoll.inhalt.anwesenheit;
					if (currentFieldKey !== 'abwesend') formData.abwesend = neuesProtokoll.inhalt.abwesend;
					if (currentFieldKey !== 'wer_geht_essen') formData.wer_geht_essen = neuesProtokoll.inhalt.wer_geht_essen;
					if (currentFieldKey !== 'leitung_im_haus') formData.leitung_im_haus = neuesProtokoll.inhalt.leitung_im_haus;
					if (currentFieldKey !== 'spaetdienst') formData.spaetdienst = neuesProtokoll.inhalt.spaetdienst;
					if (currentFieldKey !== 'fruehdienst_naechster_tag') formData.fruehdienst_naechster_tag = neuesProtokoll.inhalt.fruehdienst_naechster_tag;
					if (currentFieldKey !== 'sonstiges') formData.sonstiges = neuesProtokoll.inhalt.sonstiges;

					// Reaktivität triggern
					formData = formData;

					toast.show('🔄 Live-Update von anderem Nutzer empfangen', 'info', 3000);
				}
			}
		});

		// Subscribe zu Änderungen der aktiven Editoren
		editorsSubscription = subscribeToActiveEditors(currentDate, (editors) => {
			activeEditors = editors.filter(e => e.username !== currentUsername);
		});

		// Subscribe zu Feld-Editoren (für Field-Level Locking)
		fieldEditorsSubscription = subscribeToFieldEditors(currentDate, (fieldMap) => {
			activeFieldEditors = fieldMap;
		});

		// Lade initial die aktiven Feld-Editoren
		activeFieldEditors = await getActiveFieldEditors(currentDate);

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
		// Aktuelles Feld freigeben
		if (currentEditingField && currentDate && currentUsername) {
			await unregisterFieldEditor(currentDate, currentEditingField, currentUsername);
		}

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
		if (fieldEditorsSubscription) {
			await supabase.removeChannel(fieldEditorsSubscription);
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

	async function copyFromYesterday() {
		// Berechne das gestrige Datum
		const date = new Date(currentDate);
		date.setDate(date.getDate() - 1);
		const yesterday = date.toISOString().split('T')[0];

		// Lade das gestrige Protokoll
		const yesterdayProtokoll = await getProtokoll(yesterday);

		if (!yesterdayProtokoll) {
			toast.show('Kein Protokoll von gestern gefunden!', 'error');
			return;
		}

		// Kopiere die Daten (aber nicht das Datum!)
		formData = JSON.parse(JSON.stringify(yesterdayProtokoll.inhalt));
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

		toast.show('✓ Daten von gestern kopiert!', 'success');
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
	async function togglePersonInFeld(slot, raum) {
		// Registriere Feld-Bearbeitung
		const fieldKey = `${slot}_${raum}`;
		await handleFieldFocus(fieldKey);

		// Radierer-Modus: Komplette Zelle löschen
		if (eraserMode) {
			formData.planung[slot][raum] = '';
			formData = formData;
			// Speichere sofort bei Paint-Mode-Änderungen
			await handleSave();
			await handleFieldBlur(fieldKey);
			return;
		}

		// Normale Person-Zuweisung
		if (!selectedPerson) {
			await handleFieldBlur(fieldKey);
			return; // Keine Person ausgewählt
		}

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

		// Speichere sofort bei Paint-Mode-Änderungen
		await handleSave();
		await handleFieldBlur(fieldKey);
	}

	// REALTIME: Feld-Fokus - Registriere als aktiver Editor
	async function handleFieldFocus(fieldKey) {
		// Altes Feld freigeben
		if (currentEditingField && currentEditingField !== fieldKey) {
			await unregisterFieldEditor(currentDate, currentEditingField, currentUsername);
		}

		// Neues Feld registrieren
		currentEditingField = fieldKey;
		await registerFieldEditor(currentDate, fieldKey, currentUsername);
	}

	// REALTIME: Feld-Blur - Feld freigeben
	async function handleFieldBlur(fieldKey) {
		if (currentEditingField === fieldKey) {
			await unregisterFieldEditor(currentDate, fieldKey, currentUsername);
			currentEditingField = null;
		}
	}

	function toggleTooltip(tooltipId) {
		if (activeTooltip === tooltipId) {
			activeTooltip = null;
		} else {
			activeTooltip = tooltipId;
		}
	}

	// Als Vorlage speichern
	async function saveAsTemplate() {
		if (!templateName.trim()) {
			toast.show('Bitte gib einen Namen für die Vorlage ein!', 'error');
			return;
		}

		// Lade aktuelle Vorlagen
		const currentVorlagen = await getVorlagen();

		// Erstelle neue Vorlage
		const newTemplate = {
			id: `template-${Date.now()}`,
			name: templateName.trim(),
			inhalt: JSON.parse(JSON.stringify(formData)) // Deep copy
		};

		// Füge neue Vorlage hinzu
		const updatedVorlagen = [...currentVorlagen, newTemplate];

		// Speichere
		const success = await saveVorlagen(updatedVorlagen);

		if (success) {
			toast.show(`✓ Vorlage "${templateName}" gespeichert!`, 'success');
			showSaveTemplateModal = false;
			templateName = '';
			// Reload vorlagen
			vorlagen = await getVorlagen();
		} else {
			toast.show('Fehler beim Speichern der Vorlage!', 'error');
		}
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

<!-- Vorlage Speichern Modal -->
{#if showSaveTemplateModal}
	<div class="modal-overlay" on:click={() => showSaveTemplateModal = false}>
		<div class="modal-content template-modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>📋 Als Vorlage speichern</h2>
				<button class="close-btn" on:click={() => showSaveTemplateModal = false}>✕</button>
			</div>
			<div class="modal-body">
				<p class="modal-description">
					Gib der Vorlage einen aussagekräftigen Namen. Sie wird dann beim Erstellen neuer Protokolle verfügbar sein.
				</p>
				<div class="form-group">
					<label for="template-name">Name der Vorlage</label>
					<input
						type="text"
						id="template-name"
						bind:value={templateName}
						placeholder="z.B. Typischer Montag, Sommerplan, etc."
						on:keydown={(e) => e.key === 'Enter' && saveAsTemplate()}
						autofocus
					/>
				</div>
				<div class="modal-actions">
					<button type="button" on:click={() => showSaveTemplateModal = false} class="btn-cancel">
						Abbrechen
					</button>
					<button type="button" on:click={saveAsTemplate} class="btn-save">
						Vorlage speichern
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

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

		<!-- TESTMODUS: Banner wenn Test-Protokoll -->
		{#if currentDate.startsWith('test-')}
			<div class="test-mode-banner">
				<div class="test-icon">🧪</div>
				<div class="test-content">
					<div class="test-title">TESTMODUS AKTIV</div>
					<div class="test-description">
						Dies ist dein persönliches Übungsprotokoll. Hier kannst du alles ausprobieren!
						Testprotokolle erscheinen nicht in Statistiken und können beliebig gelöscht werden.
					</div>
				</div>
			</div>
		{/if}

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

		{#if isNewProtokoll}
			<section class="section vorlage-section">
				<h2>
					Schnellstart
					<button type="button" class="help-btn" on:click={() => toggleTooltip('schnellstart')} title="Hilfe">?</button>
					{#if activeTooltip === 'schnellstart'}
						<div class="tooltip-box">
							<strong>Schnellstart-Optionen:</strong>
							<br>Kopiere das gestrige Protokoll als Ausgangspunkt oder wähle eine gespeicherte Vorlage.
							Das spart dir viel Tipparbeit!
						</div>
					{/if}
				</h2>
				<p class="vorlage-description">
					Starte mit einer Vorlage oder kopiere das gestrige Protokoll.
				</p>

				<!-- Von gestern kopieren Button -->
				<div class="quick-action-group">
					<button
						type="button"
						on:click={copyFromYesterday}
						class="copy-yesterday-btn"
					>
						<span class="btn-icon">📋</span>
						<span class="btn-text">Von gestern kopieren</span>
					</button>
				</div>

				{#if vorlagen.length > 0}
					<div class="divider">
						<span>oder</span>
					</div>
					<div class="vorlage-auswahl">
						<select bind:value={selectedVorlageId} class="vorlage-select">
							<option value="">-- Vorlage auswählen --</option>
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
				{/if}
			</section>
		{/if}

		<form on:submit|preventDefault={handleSave}>
			<section class="section">
				<h2>
					Allgemeine Informationen
					<button type="button" class="help-btn" on:click={() => toggleTooltip('anwesenheit')} title="Hilfe">?</button>
					{#if activeTooltip === 'anwesenheit'}
						<div class="tooltip-box">
							<strong>Anwesenheit bearbeiten:</strong>
							<br>Bei neuen Protokollen sind alle Personen vorausgewählt. Wähle nur die Abwesenden ab!
							Das "Abwesend"-Feld wird automatisch ausgefüllt.
						</div>
					{/if}
				</h2>

				<div class="form-group">
					<label for="anwesenheit">
						Anwesenheit
						{#if isNewProtokoll}
							<span class="label-hint">(Alle sind vorausgewählt - abwesende Personen abwählen)</span>
						{/if}
					</label>
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

			<!-- PAINT MODE: Personen auswählen - IMMER sichtbar -->
			{#if anwesenheitArray.length > 0}
				<section class="section paint-mode-section">
					<h2>
						✏️ Schnellzuweisung
						<button type="button" class="help-btn" on:click={() => toggleTooltip('schnellzuweisung')} title="Hilfe">?</button>
						{#if activeTooltip === 'schnellzuweisung'}
							<div class="tooltip-box">
								<strong>Schnellzuweisung:</strong>
								<br>Wähle eine Person aus (wird farbig markiert), dann klicke auf beliebige Felder in der Tabelle, um diese Person schnell zuzuweisen.
								Mit dem Radierer kannst du Zuweisungen schnell löschen. Die Zahlen zeigen dir, wie viele Zeitslots die Person bereits hat.
							</div>
						{/if}
					</h2>
					<p class="paint-mode-hint">
						Klicke auf eine Person oder den Radierer, dann auf Felder in der Tabelle.
						{#if selectedPerson}
							<strong class="selected-person-name">Ausgewählt: {selectedPerson}</strong>
						{:else if eraserMode}
							<strong class="selected-person-name eraser-active">🗑️ Radierer aktiv</strong>
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
								<span class="status-badge-paint">{zuordnungStatus[person] || 0}/3</span>
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

					<!-- Legende -->
					<div class="paint-mode-legende">
						<span class="legende-item"><span class="dot nicht-zugeordnet"></span> Nicht zugeordnet</span>
						<span class="legende-item"><span class="dot teilweise"></span> Teilweise zugeordnet</span>
						<span class="legende-item"><span class="dot vollstaendig"></span> Vollständig zugeordnet</span>
					</div>

					<!-- Toggle-Button für erweiterte Ansicht -->
					<button
						type="button"
						class="toggle-detailed-btn"
						on:click={() => showDetailedKacheln = !showDetailedKacheln}
					>
						{showDetailedKacheln ? '▼ Erweiterte Zuordnung ausblenden' : '▶ Erweiterte Zuordnung anzeigen'}
					</button>

					<!-- Erweiterte Kacheln-Ansicht (ausgeklappt) -->
					{#if showDetailedKacheln}
						<div class="detailed-kacheln-container">
							<PersonenKacheln
								anwesendePersonen={anwesenheitArray}
								planung={formData.planung}
								{zeitslots}
								{raeume}
								{raumLabels}
								on:update={handlePlanungUpdate}
							/>
						</div>
					{/if}
				</section>
			{/if}

			<section class="section">
				<h2>
					Belegungsplanung (Übersicht)
					<button type="button" class="help-btn" on:click={() => toggleTooltip('planung')} title="Hilfe">?</button>
					{#if activeTooltip === 'planung'}
						<div class="tooltip-box">
							<strong>Belegungsplanung:</strong>
							<br>Trage hier ein, welche Personen zu welchen Zeiten in welchen Räumen sind.
							Tipp: Nutze den Paint-Modus (Personenkacheln) für schnelleres Zuweisen!
						</div>
					{/if}
				</h2>

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
												class:eraser-mode={eraserMode}
												on:click={() => togglePersonInFeld(slot, raum)}
												title={selectedPerson ? `Klicken um ${selectedPerson} hinzuzufügen/zu entfernen` : eraserMode ? 'Klicken um Zelle zu leeren' : ''}
											>
												{#if selectedPerson || eraserMode}
													<!-- Paint Mode/Radierer: Zeige nur Text, ganze Zelle ist klickbar -->
													<div class="matrix-text-display">
														{formData.planung[slot][raum] || '...'}
													</div>
												{:else}
													<!-- Normal Mode: Zeige Textarea zum Editieren -->
													<textarea
														bind:value={formData.planung[slot][raum]}
														placeholder="..."
														class="matrix-input"
														class:field-locked={activeFieldEditors[`${slot}_${raum}`] && activeFieldEditors[`${slot}_${raum}`] !== currentUsername}
														rows="1"
														on:input={autoResize}
														on:focus={() => handleFieldFocus(`${slot}_${raum}`)}
														on:blur={() => handleFieldBlur(`${slot}_${raum}`)}
														disabled={activeFieldEditors[`${slot}_${raum}`] && activeFieldEditors[`${slot}_${raum}`] !== currentUsername}
													></textarea>
													{#if activeFieldEditors[`${slot}_${raum}`] && activeFieldEditors[`${slot}_${raum}`] !== currentUsername}
														<div class="field-editor-indicator">
															🔒 {activeFieldEditors[`${slot}_${raum}`]}
														</div>
													{/if}
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
				<button
					type="button"
					on:click={() => showSaveTemplateModal = true}
					class="btn-template"
					title="Speichere dieses Protokoll als wiederverwendbare Vorlage"
				>
					📋 Als Vorlage speichern
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

	.btn-template {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
	}

	.btn-template:hover {
		background: linear-gradient(135deg, #5568d3 0%, #6a3f8f 100%);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	.modal-content.template-modal {
		background: var(--bg-secondary);
		border-radius: 12px;
		width: 90%;
		max-width: 500px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 2px solid var(--border-color);
	}

	.modal-header h2 {
		margin: 0;
		color: var(--text-primary);
		font-size: 1.3rem;
	}

	.close-btn {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-secondary);
		cursor: pointer;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.close-btn:hover {
		background: var(--border-color);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
	}

	.modal-description {
		color: var(--text-secondary);
		margin-bottom: 20px;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
		margin-top: 24px;
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

	.quick-action-group {
		margin-bottom: 20px;
	}

	.copy-yesterday-btn {
		width: 100%;
		padding: 16px 24px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 12px;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		transition: all 0.3s ease;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
	}

	.copy-yesterday-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
	}

	.copy-yesterday-btn .btn-icon {
		font-size: 20px;
	}

	.copy-yesterday-btn .btn-text {
		font-size: 16px;
	}

	.divider {
		display: flex;
		align-items: center;
		text-align: center;
		margin: 20px 0;
		color: var(--text-secondary);
		font-size: 0.9rem;
		font-weight: 500;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		border-bottom: 2px solid var(--border-color);
	}

	.divider span {
		padding: 0 15px;
	}

	.label-hint {
		font-size: 0.85rem;
		font-weight: 400;
		color: var(--text-secondary);
		font-style: italic;
		margin-left: 8px;
	}

	/* Hilfe-Buttons und Tooltips */
	.help-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--accent-color);
		color: white;
		border: none;
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
		margin-left: 10px;
		transition: all 0.2s;
		vertical-align: middle;
	}

	.help-btn:hover {
		background: var(--accent-hover);
		transform: scale(1.1);
	}

	h2 {
		position: relative;
		display: inline-flex;
		align-items: center;
	}

	.tooltip-box {
		position: absolute;
		top: 100%;
		left: 0;
		margin-top: 10px;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--accent-color);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 100;
		max-width: 400px;
		font-size: 0.9rem;
		line-height: 1.5;
		color: var(--text-primary);
		animation: tooltipFadeIn 0.2s ease;
	}

	@keyframes tooltipFadeIn {
		from {
			opacity: 0;
			transform: translateY(-5px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.tooltip-box strong {
		color: var(--accent-color);
	}

	/* TESTMODUS: Banner */
	.test-mode-banner {
		display: flex;
		align-items: center;
		gap: 20px;
		padding: 20px;
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		border: 3px solid #f5576c;
		border-radius: 12px;
		margin-bottom: 20px;
		animation: pulse-test 3s ease-in-out infinite;
		box-shadow: 0 4px 20px rgba(245, 87, 108, 0.4);
	}

	:global(.dark-mode) .test-mode-banner {
		background: linear-gradient(135deg, #d87de6 0%, #d4485a 100%);
		border-color: #d4485a;
	}

	@keyframes pulse-test {
		0%, 100% {
			opacity: 1;
			transform: scale(1);
		}
		50% {
			opacity: 0.95;
			transform: scale(1.005);
		}
	}

	.test-icon {
		font-size: 48px;
		flex-shrink: 0;
		animation: rotate-test 4s linear infinite;
	}

	@keyframes rotate-test {
		0% { transform: rotate(0deg); }
		10% { transform: rotate(10deg); }
		20% { transform: rotate(-10deg); }
		30% { transform: rotate(10deg); }
		40% { transform: rotate(0deg); }
		100% { transform: rotate(0deg); }
	}

	.test-content {
		flex: 1;
		color: white;
	}

	.test-title {
		font-size: 1.3rem;
		font-weight: 700;
		margin-bottom: 8px;
		text-transform: uppercase;
		letter-spacing: 1px;
	}

	.test-description {
		font-size: 0.95rem;
		line-height: 1.5;
		opacity: 0.95;
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

	.selected-person-name.eraser-active {
		color: #e74c3c;
	}

	:global(.dark-mode) .selected-person-name.eraser-active {
		color: #ff6b6b;
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

	/* Radierer-Button */
	.paint-mode-person.eraser-btn {
		border-color: #95a5a6;
	}

	.paint-mode-person.eraser-btn .status-badge-paint {
		background: #95a5a6;
		color: white;
	}

	.paint-mode-person.eraser-btn.active {
		background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
		border-color: #e74c3c;
	}

	.paint-mode-person.eraser-btn.active .status-badge-paint {
		background: rgba(255, 255, 255, 0.3);
	}

	/* Legende */
	.paint-mode-legende {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
		padding-top: 15px;
		margin-top: 15px;
		border-top: 1px solid var(--border-color);
		color: var(--text-secondary);
	}

	.legende-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.dot {
		width: 14px;
		height: 14px;
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

	/* Toggle-Button für erweiterte Ansicht */
	.toggle-detailed-btn {
		margin-top: 20px;
		padding: 10px 20px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		color: var(--text-primary);
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		width: 100%;
		text-align: center;
	}

	.toggle-detailed-btn:hover {
		background: var(--border-color);
		border-color: var(--accent-color);
	}

	.detailed-kacheln-container {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 2px solid var(--border-color);
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

	/* Radierer-Modus Hover-Effekt */
	.matrix-cell.eraser-mode:hover {
		background-color: rgba(231, 76, 60, 0.1) !important;
	}

	:global(.dark-mode) .matrix-cell.eraser-mode:hover {
		background-color: rgba(231, 76, 60, 0.2) !important;
	}

	.matrix-cell.eraser-mode:hover::after {
		content: '🗑️';
		position: absolute;
		top: 5px;
		right: 5px;
		font-size: 14px;
		opacity: 0.6;
	}

	/* Field-Level Locking Styles */
	.matrix-input.field-locked {
		background: repeating-linear-gradient(
			45deg,
			var(--bg-primary),
			var(--bg-primary) 10px,
			var(--border-color) 10px,
			var(--border-color) 11px
		);
		cursor: not-allowed;
		border-color: #e74c3c;
		opacity: 0.7;
	}

	.field-editor-indicator {
		position: absolute;
		bottom: 2px;
		right: 4px;
		font-size: 10px;
		color: #e74c3c;
		background: rgba(231, 76, 60, 0.1);
		padding: 2px 6px;
		border-radius: 4px;
		font-weight: 600;
		pointer-events: none;
		white-space: nowrap;
		z-index: 5;
	}

	:global(.dark-mode) .field-editor-indicator {
		background: rgba(231, 76, 60, 0.2);
		color: #ff6b6b;
	}

	.matrix-cell {
		position: relative;
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