<script>
	import { inactivityWarning, extendSession } from '$lib/inactivityStore';

	function handleContinue() {
		extendSession();
	}
</script>

{#if $inactivityWarning.show}
	<div class="inactivity-overlay">
		<div class="inactivity-modal">
			<div class="warning-icon">⏰</div>
			<h2>Automatische Abmeldung</h2>
			<p>
				Du wirst wegen Inaktivität in
				<span class="countdown">{$inactivityWarning.secondsLeft}</span>
				Sekunden automatisch abgemeldet.
			</p>
			<button on:click={handleContinue} class="continue-btn">
				Weiter arbeiten
			</button>
		</div>
	</div>
{/if}

<style>
	.inactivity-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
		animation: fadeIn 0.3s ease;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	.inactivity-modal {
		background: var(--bg-secondary);
		border-radius: 16px;
		padding: 40px;
		text-align: center;
		max-width: 400px;
		width: 90%;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
		animation: slideUp 0.4s ease;
		border: 3px solid #f5576c;
	}

	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(30px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.warning-icon {
		font-size: 64px;
		margin-bottom: 20px;
		animation: pulse 1s ease-in-out infinite;
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.1); }
	}

	h2 {
		margin: 0 0 15px 0;
		color: var(--text-primary);
		font-size: 1.5rem;
	}

	p {
		color: var(--text-secondary);
		font-size: 1.1rem;
		margin: 0 0 25px 0;
		line-height: 1.5;
	}

	.countdown {
		display: inline-block;
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: white;
		font-weight: 700;
		font-size: 1.4rem;
		padding: 4px 12px;
		border-radius: 8px;
		min-width: 50px;
		animation: countdownPulse 1s ease-in-out infinite;
	}

	@keyframes countdownPulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.05); }
	}

	.continue-btn {
		padding: 14px 32px;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		border-radius: 10px;
		font-size: 1.1rem;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.2s;
		box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
	}

	.continue-btn:hover {
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
	}

	.continue-btn:active {
		transform: translateY(0);
	}
</style>
