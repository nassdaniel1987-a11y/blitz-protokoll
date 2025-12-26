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
	// CHANGELOG: Import für Änderungsprotokoll
	import { logChange, compareProtocols } from '$lib/changelogService';
	// ADMIN: Import für Admin-Check
	import { isCurrentUserAdmin } from '$lib/userManagementService';
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

	// ADMIN: Experimentelle Features
	let isAdmin = false;
	let showExperimentalSection = false;
	let showPersonPicker = false;
	let personPickerSlot = null;
	let personPickerRaum = null;
	let personPickerSelectedPersonen = [];
	let personPickerSearchQuery = '';

	// CHANGELOG: Änderungshistorie
	let showChangelog = false;
	let changelogEntries = [];
	let loadingChangelog = false;
	let originalProtokollData = null; // Original-Daten beim Laden (für Changelog-Vergleich)

	// REALTIME: Variablen für gleichzeitiges Bearbeiten
	let activeEditors = [];
	let heartbeatInterval;
	let protokollSubscription;
	let editorsSubscription;
	let messagesSubscription; // Realtime für Badge-Counter
	let fieldEditorsSubscription; // Realtime für Feld-Editoren
	let activeFieldEditors = {}; // Map: fieldKey -> username
	let currentEditingField = null; // Aktuell bearbeitetes Feld (fieldKey)
	let autoSaveTimeout = null; // Timeout für Auto-Save (Debouncing)

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

		// ADMIN: Prüfe ob User Admin ist
		isAdmin = await isCurrentUserAdmin();

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

			// CHANGELOG: Speichere Original-Daten für späteren Vergleich
			originalProtokollData = JSON.parse(JSON.stringify(formData));
		} else {
			isNewProtokoll = true;
			formData = createEmptyProtokoll();
			// NEU: Bei neuem Protokoll sind standardmäßig ALLE Personen anwesend
			anwesenheitArray = [...allePersonen];
			formData.anwesenheit = arrayToString(anwesenheitArray);
			formData.abwesend = ''; // Niemand abwesend

			// CHANGELOG: Speichere Original-Daten (leer bei neuem Protokoll)
			originalProtokollData = null;
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
			if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
				try {
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
				} catch (error) {
					console.error('Fehler beim Laden des Protokoll-Updates:', error);
					// Ignoriere 406-Fehler (Protokoll existiert nicht)
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

		// Auto-Save Timeout stoppen
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
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

		// AUTO-REMOVE: Entferne abwesende Personen aus der Planung
		abwesendePersonen.forEach(person => {
			const personNormalized = person.trim().toLowerCase();

			zeitslots.forEach(slot => {
				raeume.forEach(raum => {
					const currentValue = formData.planung[slot]?.[raum] || '';
					const personen = currentValue.split(',').map(p => p.trim()).filter(p => p);

					// Filtere Personen mit flexiblem Matching
					const filtered = personen.filter(p => {
						const pNormalized = p.trim().toLowerCase();

						// Exakter Match
						if (pNormalized === personNormalized) return false;

						// Teilstring-Match (z.B. "Anna Schmidt" enthält "Anna")
						if (pNormalized.includes(personNormalized)) return false;
						if (personNormalized.includes(pNormalized)) return false;

						return true;
					});

					// Nur updaten wenn sich was geändert hat
					if (filtered.length !== personen.length) {
						formData.planung[slot][raum] = filtered.join(', ');
					}
				});
			});
		});

		// Trigger Reaktivität
		formData = formData;

		// Auto-Save nach Anwesenheitsänderung
		saveProtokollSilent();
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

		// CHANGELOG: Verwende gespeicherte Original-Daten statt erneut aus DB zu laden
		// (wichtig wegen Auto-Save, der sonst die Änderungen schon gespeichert hätte)
		console.log('🔍 DEBUG: originalProtokollData:', originalProtokollData);
		console.log('🔍 DEBUG: formData:', formData);

		// Speichere das Protokoll
		const result = await saveProtokoll(currentDate, formData);

		if (result) {
			// CHANGELOG: Logge Änderungen
			if (!originalProtokollData) {
				// NEU: Protokoll erstellt
				console.log('✨ Protokoll NEU erstellt');
				await logChange(currentDate, currentUsername, 'create', {
					description: 'Protokoll erstellt'
				});
			} else {
				// UPDATE: Vergleiche Original-Daten mit aktuellen Daten
				console.log('📝 Protokoll wird AKTUALISIERT - vergleiche Änderungen...');

				// Wrappe originalProtokollData im gleichen Format wie getProtokoll()
				const oldProtokollWrapped = { inhalt: originalProtokollData };
				const changes = compareProtocols(oldProtokollWrapped, formData, zeitslots, raeume);
				console.log('🔍 DEBUG: Gefundene Änderungen:', changes);
				console.log('🔍 DEBUG: Anzahl Änderungen:', changes.length);

				for (const change of changes) {
					console.log('💾 Logge Änderung:', change);
					await logChange(currentDate, currentUsername, 'update', {
						fieldName: change.fieldName,
						oldValue: change.oldValue,
						newValue: change.newValue
					});
				}
			}

			// CHANGELOG: Aktualisiere Original-Daten für nächsten Save
			originalProtokollData = JSON.parse(JSON.stringify(formData));

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

	// REALTIME: Silent Save (ohne Navigation) mit Debouncing
	async function saveProtokollSilent() {
		// Lösche alten Timeout
		if (autoSaveTimeout) {
			clearTimeout(autoSaveTimeout);
		}

		// Setze neuen Timeout (1 Sekunde Debounce)
		autoSaveTimeout = setTimeout(async () => {
			const result = await saveProtokoll(currentDate, formData);

			if (result) {
				// Kein Toast, kein Redirect - nur leises Speichern
				console.log('Auto-Save erfolgreich');
			} else {
				console.error('Auto-Save fehlgeschlagen');
			}
		}, 1000); // 1 Sekunde warten vor dem Speichern
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

	// EXPERIMENTAL: Person Picker für Zellen
	function openPersonPicker(slot, raum) {
		personPickerSlot = slot;
		personPickerRaum = raum;

		// Lade aktuell zugewiesene Personen
		const currentValue = formData.planung[slot]?.[raum] || '';
		const currentPersonen = currentValue
			.split(',')
			.map(p => p.trim())
			.filter(p => p);

		personPickerSelectedPersonen = [...currentPersonen];
		personPickerSearchQuery = '';
		showPersonPicker = true;
	}

	function togglePersonInPicker(person) {
		const index = personPickerSelectedPersonen.indexOf(person);
		if (index > -1) {
			// Person entfernen
			personPickerSelectedPersonen = personPickerSelectedPersonen.filter(p => p !== person);
		} else {
			// Person hinzufügen
			personPickerSelectedPersonen = [...personPickerSelectedPersonen, person];
		}
	}

	function applyPersonPicker() {
		if (personPickerSlot && personPickerRaum) {
			// Aktualisiere die Zelle mit den ausgewählten Personen
			formData.planung[personPickerSlot][personPickerRaum] = personPickerSelectedPersonen.join(', ');
			formData = formData; // Trigger reactivity

			// Auto-save
			saveProtokollSilent();
		}

		// Schließe Modal
		closePersonPicker();
	}

	function closePersonPicker() {
		showPersonPicker = false;
		personPickerSlot = null;
		personPickerRaum = null;
		personPickerSelectedPersonen = [];
		personPickerSearchQuery = '';
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
			// Starte Auto-Save (debounced)
			saveProtokollSilent();
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

		// Starte Auto-Save (debounced)
		saveProtokollSilent();
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

	// CHANGELOG: Lade Änderungshistorie
	async function loadChangelog() {
		loadingChangelog = true;
		const { getChangelog, formatChangelogEntry } = await import('$lib/changelogService');
		changelogEntries = await getChangelog(currentDate);
		loadingChangelog = false;
	}

	// CHANGELOG: Toggle Changelog-Anzeige
	async function toggleChangelog() {
		showChangelog = !showChangelog;
		if (showChangelog && changelogEntries.length === 0) {
			await loadChangelog();
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

<!-- EXPERIMENTAL: Person Picker Modal für Zellen -->
{#if showPersonPicker}
	<div class="modal-overlay" on:click={closePersonPicker}>
		<div class="modal-content person-picker-modal" on:click|stopPropagation>
			<div class="modal-header">
				<h2>👥 Personen zuweisen</h2>
				<button class="close-btn" on:click={closePersonPicker}>✕</button>
			</div>

			<div class="modal-subheader">
				<strong>{raumLabels[personPickerRaum] || personPickerRaum}</strong>
				<span class="separator">•</span>
				<strong>{personPickerSlot}</strong>
			</div>

			<div class="modal-body">
				<!-- Suchfeld -->
				<div class="search-box">
					<input
						type="text"
						placeholder="🔍 Person suchen..."
						bind:value={personPickerSearchQuery}
						class="search-input"
					/>
				</div>

				<!-- Personen-Liste -->
				<div class="person-picker-list">
					{#each allePersonen.filter(p => p.toLowerCase().includes(personPickerSearchQuery.toLowerCase())) as person}
						<button
							type="button"
							class="person-picker-item"
							class:selected={personPickerSelectedPersonen.includes(person)}
							on:click={() => togglePersonInPicker(person)}
						>
							<span class="checkbox">
								{personPickerSelectedPersonen.includes(person) ? '☑' : '☐'}
							</span>
							<span class="person-name">{person}</span>
						</button>
					{/each}
				</div>

				<!-- Aktuelle Auswahl -->
				<div class="current-selection">
					<strong>Ausgewählt ({personPickerSelectedPersonen.length}):</strong>
					<div class="selected-chips">
						{#if personPickerSelectedPersonen.length === 0}
							<span class="empty-hint">Keine Personen ausgewählt</span>
						{:else}
							{#each personPickerSelectedPersonen as person}
								<span class="chip">
									{person}
									<button
										type="button"
										class="chip-remove"
										on:click={() => togglePersonInPicker(person)}
									>
										✕
									</button>
								</span>
							{/each}
						{/if}
					</div>
				</div>

				<!-- Aktionen -->
				<div class="modal-actions">
					<button
						type="button"
						class="btn-cancel"
						on:click={closePersonPicker}
					>
						Abbrechen
					</button>
					<button
						type="button"
						class="btn-save"
						on:click={applyPersonPicker}
					>
						✓ Übernehmen
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

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

		<!-- EXPERIMENTAL: Admin-only features -->
		{#if isAdmin}
			<div class="experimental-section">
				<button
					type="button"
					class="experimental-toggle"
					on:click={() => showExperimentalSection = !showExperimentalSection}
				>
					🧪 Experimentelle Features (nur für Admins)
					<span class="toggle-icon">{showExperimentalSection ? '▼' : '▶'}</span>
				</button>

				{#if showExperimentalSection}
					<div class="experimental-content">
						<div class="experimental-header">
							<p class="experimental-description">
								⚠️ Diese Features sind in der Testphase. Sie ändern nichts an der normalen Funktionalität,
								sondern bieten alternative Workflows zum Ausprobieren.
							</p>
						</div>

						<!-- Feature 1: Von gestern kopieren -->
						<div class="experimental-feature">
							<h3>📋 Von gestern kopieren</h3>
							<p class="feature-description">
								Kopiert das Protokoll vom Vortag und übernimmt alle Einträge.
								Danach können nur noch die Änderungen gemacht werden (z.B. Krankmeldungen).
							</p>
							<button
								type="button"
								on:click={copyFromYesterday}
								class="btn-experimental"
							>
								📋 Von gestern kopieren
							</button>
						</div>

						<!-- Feature 2: Tap-Zelle Person Picker -->
						<div class="experimental-feature">
							<h3>👆 Tap-Zelle → Person auswählen (Tablet-optimiert)</h3>
							<p class="feature-description">
								Alternative zur Paint-Mode: Tippe auf eine Zelle in der Tabelle unten und wähle direkt aus einer Liste
								die Personen aus. Kein Hin-und-Her-Scrollen mehr nötig. Perfekt für Tablets!
							</p>

							<!-- Experimentelle Planungs-Tabelle -->
							<div class="experimental-table-container">
								<h4>📊 Experimentelle Planungs-Matrix (Tap-Modus)</h4>
								<p class="experimental-table-hint">
									👇 Tippe auf eine Zelle, um Personen zuzuweisen
								</p>
								<div class="table-wrapper">
									<table class="planning-table experimental-planning-table">
										<thead>
											<tr>
												<th class="time-column">Zeitslot</th>
												{#each raeume as raum}
													<th>{raumLabels[raum] || raum}</th>
												{/each}
											</tr>
										</thead>
										<tbody>
											{#each zeitslots as slot}
												<tr>
													<td class="time-cell">{slot}</td>
													{#each raeume as raum}
														<td class="matrix-cell experimental-cell">
															<button
																type="button"
																class="cell-tap-btn"
																on:click={() => openPersonPicker(slot, raum)}
															>
																{formData.planung[slot]?.[raum] || 'Tippen zum Zuweisen'}
															</button>
														</td>
													{/each}
												</tr>
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						</div>
					</div>
				{/if}
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
						on:input={saveProtokollSilent}
					/>
				</div>

				<div class="form-group">
					<label for="leitung_im_haus">Leitung im Haus</label>
					<input
						type="text"
						id="leitung_im_haus"
						bind:value={formData.leitung_im_haus}
						placeholder="z.B. Frau Müller"
						on:input={saveProtokollSilent}
					/>
				</div>

				<div class="form-group">
					<label for="spaetdienst">Spätdienst</label>
					<input
						type="text"
						id="spaetdienst"
						bind:value={formData.spaetdienst}
						placeholder="z.B. Herr Schmidt"
						on:input={saveProtokollSilent}
					/>
				</div>

				<div class="form-group">
					<label for="fruehdienst">Frühdienst nächster Tag</label>
					<input
						type="text"
						id="fruehdienst"
						bind:value={formData.fruehdienst_naechster_tag}
						placeholder="z.B. Frau Weber"
						on:input={saveProtokollSilent}
					/>
				</div>

				<div class="form-group">
					<label for="sonstiges">Sonstiges</label>
					<textarea
						id="sonstiges"
						bind:value={formData.sonstiges}
						rows="4"
						placeholder="Weitere Anmerkungen..."
						on:input={saveProtokollSilent}
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
								<strong>Schnellzuweisung (Paint-Mode):</strong>
								<br><br>
								<strong>Person hinzufügen/entfernen (Toggle):</strong>
								<br>• Wähle eine Person aus (wird farbig)
								<br>• Klick auf Feld → Person wird hinzugefügt
								<br>• Nochmal klicken → Person wird entfernt ✅
								<br><br>
								<strong>Radierer (ganzes Feld löschen):</strong>
								<br>• Klick auf 🗑️ Radierer
								<br>• Klick auf Feld → alles wird gelöscht
								<br><br>
								Die Zahlen zeigen Zeitslots pro Person (max. 3).
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
														on:input={(e) => { autoResize(e); saveProtokollSilent(); }}
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

		<!-- CHANGELOG: Änderungshistorie -->
		<section class="changelog-section">
			<button
				type="button"
				class="changelog-toggle"
				on:click={toggleChangelog}
			>
				📋 Änderungshistorie
				<span class="toggle-icon">{showChangelog ? '▼' : '▶'}</span>
			</button>

			{#if showChangelog}
				<div class="changelog-content">
					{#if loadingChangelog}
						<p class="changelog-loading">Lade Änderungshistorie...</p>
					{:else if changelogEntries.length === 0}
						<p class="changelog-empty">Noch keine Änderungen vorhanden.</p>
					{:else}
						<ul class="changelog-list">
							{#each changelogEntries as entry}
								<li class="changelog-entry">
									<div class="changelog-timestamp">
										{new Date(entry.timestamp).toLocaleString('de-DE', {
											day: '2-digit',
											month: '2-digit',
											year: 'numeric',
											hour: '2-digit',
											minute: '2-digit'
										})}
									</div>
									<div class="changelog-user">
										👤 {entry.username}
									</div>
									<div class="changelog-change">
										{#if entry.change_type === 'create'}
											<span class="change-type-create">✨ {entry.description || 'Protokoll erstellt'}</span>
										{:else if entry.description}
											<span class="change-type-update">{entry.description}</span>
										{:else}
											<div class="change-details">
												<strong>{entry.field_name}:</strong>
												<div class="change-values">
													<span class="old-value">"{entry.old_value || '(leer)'}"</span>
													<span class="arrow">→</span>
													<span class="new-value">"{entry.new_value || '(leer)'}"</span>
												</div>
											</div>
										{/if}
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</section>
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

	/* EXPERIMENTAL: Styles für experimentelle Features */
	.experimental-section {
		margin-bottom: 20px;
		border: 2px solid #6c757d;
		border-radius: 12px;
		overflow: hidden;
		background: var(--bg-color);
	}

	.experimental-toggle {
		width: 100%;
		padding: 16px 20px;
		background: linear-gradient(135deg, #6c757d 0%, #5a6268 100%);
		color: white;
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background 0.2s ease;
	}

	.experimental-toggle:hover {
		background: linear-gradient(135deg, #5a6268 0%, #545b62 100%);
	}

	.experimental-content {
		padding: 20px;
		background: var(--secondary-bg-color);
	}

	.experimental-header {
		margin-bottom: 20px;
	}

	.experimental-description {
		margin: 0;
		padding: 12px;
		background: rgba(255, 193, 7, 0.1);
		border-left: 4px solid #ffc107;
		border-radius: 4px;
		font-size: 14px;
		color: var(--text-color);
	}

	.experimental-feature {
		padding: 20px;
		margin-bottom: 16px;
		background: var(--bg-color);
		border: 2px solid var(--border-color);
		border-radius: 8px;
	}

	.experimental-feature:last-child {
		margin-bottom: 0;
	}

	.experimental-feature h3 {
		margin: 0 0 10px 0;
		font-size: 18px;
		color: var(--text-color);
	}

	.feature-description {
		margin: 0 0 15px 0;
		font-size: 14px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	.btn-experimental {
		padding: 10px 20px;
		background: #007bff;
		color: white;
		border: none;
		border-radius: 6px;
		cursor: pointer;
		font-size: 15px;
		font-weight: 600;
		transition: background 0.2s;
	}

	.btn-experimental:hover:not(:disabled) {
		background: #0056b3;
	}

	.btn-experimental:disabled {
		background: #6c757d;
		cursor: not-allowed;
		opacity: 0.6;
	}

	.experimental-disabled {
		opacity: 0.7;
	}

	:global(.dark-mode) .experimental-section {
		border-color: #545b62;
	}

	:global(.dark-mode) .experimental-content {
		background: #2c3e50;
	}

	:global(.dark-mode) .experimental-feature {
		background: #34495e;
		border-color: #545b62;
	}

	/* EXPERIMENTAL: Table and Person Picker Styles */
	.experimental-table-container {
		margin-top: 20px;
	}

	.experimental-table-container h4 {
		margin: 0 0 8px 0;
		font-size: 16px;
		color: var(--text-color);
	}

	.experimental-table-hint {
		margin: 0 0 12px 0;
		font-size: 14px;
		color: var(--text-muted);
		font-style: italic;
	}

	.experimental-planning-table {
		width: 100%;
		border-collapse: collapse;
		background: var(--bg-color);
	}

	.experimental-cell {
		padding: 0 !important;
	}

	.cell-tap-btn {
		width: 100%;
		min-height: 60px;
		padding: 12px;
		background: var(--bg-color);
		border: 2px solid var(--border-color);
		color: var(--text-color);
		cursor: pointer;
		font-size: 14px;
		text-align: left;
		transition: all 0.2s;
		border-radius: 4px;
	}

	.cell-tap-btn:hover {
		background: var(--hover-bg-color);
		border-color: var(--primary-color);
		transform: scale(1.02);
	}

	.cell-tap-btn:active {
		transform: scale(0.98);
	}

	/* Person Picker Modal */
	.person-picker-modal {
		max-width: 500px;
		width: 90%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.modal-subheader {
		padding: 12px 24px;
		background: var(--secondary-bg-color);
		border-bottom: 1px solid var(--border-color);
		font-size: 14px;
		color: var(--text-muted);
	}

	.modal-subheader .separator {
		margin: 0 8px;
	}

	.search-box {
		margin-bottom: 16px;
	}

	.search-input {
		width: 100%;
		padding: 12px 16px;
		border: 2px solid var(--border-color);
		border-radius: 8px;
		font-size: 16px;
		background: var(--bg-color);
		color: var(--text-color);
	}

	.search-input:focus {
		outline: none;
		border-color: var(--primary-color);
	}

	.person-picker-list {
		max-height: 300px;
		overflow-y: auto;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.person-picker-item {
		width: 100%;
		padding: 14px 16px;
		background: var(--bg-color);
		border: none;
		border-bottom: 1px solid var(--border-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 16px;
		transition: background 0.2s;
		text-align: left;
		color: var(--text-color);
	}

	.person-picker-item:last-child {
		border-bottom: none;
	}

	.person-picker-item:hover {
		background: var(--hover-bg-color);
	}

	.person-picker-item.selected {
		background: rgba(0, 123, 255, 0.1);
		font-weight: 600;
	}

	.person-picker-item .checkbox {
		font-size: 20px;
		color: var(--primary-color);
	}

	.person-picker-item .person-name {
		flex: 1;
	}

	.current-selection {
		padding: 12px;
		background: var(--secondary-bg-color);
		border-radius: 8px;
		margin-bottom: 16px;
	}

	.current-selection strong {
		display: block;
		margin-bottom: 8px;
		font-size: 14px;
		color: var(--text-color);
	}

	.selected-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		min-height: 32px;
		align-items: center;
	}

	.empty-hint {
		color: var(--text-muted);
		font-size: 14px;
		font-style: italic;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 10px;
		background: var(--primary-color);
		color: white;
		border-radius: 16px;
		font-size: 14px;
		font-weight: 500;
	}

	.chip-remove {
		padding: 0;
		width: 18px;
		height: 18px;
		background: rgba(255, 255, 255, 0.3);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		font-size: 12px;
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.2s;
	}

	.chip-remove:hover {
		background: rgba(255, 255, 255, 0.5);
	}

	.modal-actions {
		display: flex;
		gap: 12px;
		justify-content: flex-end;
	}

	.modal-actions .btn-cancel,
	.modal-actions .btn-save {
		padding: 12px 24px;
		border: none;
		border-radius: 6px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: background 0.2s;
	}

	.modal-actions .btn-cancel {
		background: #6c757d;
		color: white;
	}

	.modal-actions .btn-cancel:hover {
		background: #5a6268;
	}

	.modal-actions .btn-save {
		background: var(--primary-color);
		color: white;
	}

	.modal-actions .btn-save:hover {
		background: var(--primary-color-dark);
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

	/* CHANGELOG: Änderungshistorie Styles */
	.changelog-section {
		margin-top: 30px;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		overflow: hidden;
		background: var(--bg-color);
	}

	.changelog-toggle {
		width: 100%;
		padding: 15px 20px;
		background: var(--secondary-bg-color);
		border: none;
		text-align: left;
		cursor: pointer;
		font-size: 16px;
		font-weight: 600;
		color: var(--text-color);
		display: flex;
		justify-content: space-between;
		align-items: center;
		transition: background 0.2s ease;
	}

	.changelog-toggle:hover {
		background: var(--hover-bg-color);
	}

	.toggle-icon {
		font-size: 12px;
		transition: transform 0.2s ease;
	}

	.changelog-content {
		padding: 20px;
		max-height: 500px;
		overflow-y: auto;
		border-top: 1px solid var(--border-color);
	}

	.changelog-loading,
	.changelog-empty {
		color: var(--text-muted);
		text-align: center;
		padding: 20px;
		font-style: italic;
	}

	.changelog-list {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.changelog-entry {
		padding: 15px;
		margin-bottom: 10px;
		background: var(--secondary-bg-color);
		border-radius: 6px;
		border-left: 3px solid var(--primary-color);
	}

	.changelog-timestamp {
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 5px;
	}

	.changelog-user {
		font-size: 14px;
		font-weight: 600;
		color: var(--primary-color);
		margin-bottom: 8px;
	}

	.changelog-change {
		font-size: 14px;
		color: var(--text-color);
	}

	.change-type-create {
		color: #27ae60;
		font-weight: 600;
	}

	.change-type-update {
		color: var(--text-color);
	}

	.change-details {
		display: flex;
		flex-direction: column;
		gap: 5px;
	}

	.change-values {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 5px;
	}

	.old-value {
		color: #e74c3c;
		font-family: monospace;
		background: rgba(231, 76, 60, 0.1);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.new-value {
		color: #27ae60;
		font-family: monospace;
		background: rgba(39, 174, 96, 0.1);
		padding: 2px 6px;
		border-radius: 3px;
	}

	.arrow {
		color: var(--text-muted);
		font-weight: bold;
	}

	:global(.dark-mode) .changelog-toggle {
		background: #2c3e50;
	}

	:global(.dark-mode) .changelog-toggle:hover {
		background: #34495e;
	}

	:global(.dark-mode) .changelog-entry {
		background: #2c3e50;
		border-left-color: #3498db;
	}

	:global(.dark-mode) .old-value {
		background: rgba(231, 76, 60, 0.2);
		color: #ff6b6b;
	}

	:global(.dark-mode) .new-value {
		background: rgba(39, 174, 96, 0.2);
		color: #5dde8e;
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