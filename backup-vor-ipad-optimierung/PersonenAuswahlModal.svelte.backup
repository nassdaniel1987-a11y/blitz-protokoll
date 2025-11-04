<script>
	import { createEventDispatcher } from 'svelte';
	import { getPersonen } from '$lib/einstellungenService';
	import { onMount } from 'svelte';

	export let show = false;
	export let selectedPersonen = [];

	let personen = [];
	let tempSelected = [];
	const dispatch = createEventDispatcher();

	onMount(async () => {
		personen = await getPersonen();
	});

	$: if (show) {
		// Wenn Modal geöffnet wird, aktuelle Auswahl laden
		tempSelected = [...selectedPersonen];
	}

	function togglePerson(person) {
		if (tempSelected.includes(person)) {
			tempSelected = tempSelected.filter(p => p !== person);
		} else {
			tempSelected = [...tempSelected, person];
		}
	}

	function handleUebernehmen() {
		dispatch('select', tempSelected);
		close();
	}

	function close() {
		dispatch('close');
	}
</script>

{#if show}
	<div class="modal-overlay" on:click={close}>
		<div class="modal-content" on:click|stopPropagation>
			<div class="modal-header">
				<h3>Personen auswählen</h3>
				<button class="close-btn" on:click={close}>✕</button>
			</div>

			<div class="modal-body">
				{#if personen.length === 0}
					<p class="no-persons">
						Keine Personen vorhanden. Gehe zu den Einstellungen, um Personen anzulegen.
					</p>
				{:else}
					<div class="person-list">
						{#each personen as person}
							<label class="person-checkbox">
								<input 
									type="checkbox" 
									checked={tempSelected.includes(person)}
									on:change={() => togglePerson(person)}
								/>
								<span class="person-label">{person}</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<div class="modal-footer">
				<button class="btn-cancel" on:click={close}>Abbrechen</button>
				<button class="btn-confirm" on:click={handleUebernehmen}>Übernehmen</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background: var(--bg-secondary);
		border-radius: 12px;
		box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
		width: 100%;
		max-width: 500px;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid var(--border-color);
	}

	.modal-header h3 {
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
	}

	.close-btn:hover {
		background: var(--bg-primary);
		color: var(--text-primary);
	}

	.modal-body {
		padding: 24px;
		overflow-y: auto;
		flex: 1;
	}

	.no-persons {
		color: var(--text-secondary);
		text-align: center;
		padding: 20px;
	}

	.person-list {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.person-checkbox {
		display: flex;
		align-items: center;
		padding: 12px 16px;
		background: var(--bg-primary);
		border: 2px solid var(--border-color);
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.person-checkbox:hover {
		border-color: var(--accent-color);
		background: var(--bg-secondary);
	}

	.person-checkbox input[type="checkbox"] {
		width: 24px;
		height: 24px;
		margin: 0 12px 0 0;
		cursor: pointer;
		accent-color: var(--accent-color);
	}

	.person-label {
		color: var(--text-primary);
		font-size: 1rem;
		user-select: none;
	}

	.modal-footer {
		display: flex;
		gap: 12px;
		padding: 20px 24px;
		border-top: 1px solid var(--border-color);
	}

	.btn-cancel,
	.btn-confirm {
		flex: 1;
		padding: 14px 24px;
		border: none;
		border-radius: 8px;
		font-size: 16px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
	}

	.btn-cancel {
		background: var(--bg-primary);
		color: var(--text-primary);
		border: 2px solid var(--border-color);
	}

	.btn-cancel:hover {
		background: var(--border-color);
	}

	.btn-confirm {
		background: var(--accent-color);
		color: white;
	}

	.btn-confirm:hover {
		background: var(--accent-hover);
	}

	/* iPad-Optimierung */
	@media (max-width: 768px) {
		.modal-content {
			max-height: 90vh;
		}

		.person-checkbox {
			padding: 16px 20px;
		}

		.person-checkbox input[type="checkbox"] {
			width: 28px;
			height: 28px;
		}

		.person-label {
			font-size: 1.1rem;
		}

		.btn-cancel,
		.btn-confirm {
			padding: 16px 24px;
			font-size: 18px;
		}
	}
</style>