<script lang="ts">
	import type { Run } from '#lib/bench.ts';
	import { pct } from '#lib/bench.ts';

	type Props = { name: string; color: string; run: Run; category: string | null; onclose: () => void };
	let { name, color, run, category, onclose }: Props = $props();

	const tasks = $derived(run.tasks.filter((t) => !category || t.category === category));
	let open = $state<string | null>(null);
	let heading: HTMLHeadingElement;
	$effect(() => heading?.focus());

	const show = (v: unknown) => (v == null ? '∅' : Array.isArray(v) ? v.join(', ') : String(v));
	const date = $derived(new Date(run.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }));
</script>

<section id="drill" class="drill" aria-label="Drill-down for {name}" style="--c:{color}">
	<header>
		<div>
			<p class="eyebrow">{category ?? 'all categories'} · {date}{run.demo ? ' · demo' : ''}</p>
			<h2 bind:this={heading} tabindex="-1"><i></i>{name}</h2>
		</div>
		<button class="close" onclick={onclose} aria-label="Close drill-down">close ×</button>
	</header>

	<ol class="tasks">
		{#each tasks as t (t.taskId)}
			{@const isOpen = open === t.taskId}
			<li class:open={isOpen}>
				<button class="row" aria-expanded={isOpen} onclick={() => (open = isOpen ? null : t.taskId)}>
					<span class="id">{t.taskId}</span>
					<span class="title">{t.title}</span>
					<span class="axes" aria-label="detect remediate evaluate">
						{#each ['detect', 'remediate', 'evaluate'] as a}
							{@const v = t.axes[a]}
							<span class="ax" title="{a} {pct(v)}"><b style="height:{v == null ? 0 : v * 100}%"></b></span>
						{/each}
					</span>
					<span class="words" class:over={t.words > t.budget}>{t.words}/{t.budget}w</span>
					<span class="score">{pct(t.score)}</span>
				</button>

				{#if isOpen}
					<div class="detail">
						{#if t.error}
							<p class="err">Error: {t.error}</p>
						{:else if !t.structured}
							<p class="err">The answer was not valid JSON, so only phrase checks ran.</p>
						{/if}

						{#if t.answer?.verdict}
							<p class="verdict"><span class="k">verdict</span>{t.answer.verdict}</p>
						{/if}

						<table class="fields">
							<thead><tr><th>field</th><th>answered</th><th>expected</th><th>credit</th></tr></thead>
							<tbody>
								{#each Object.entries(t.fields ?? {}) as [k, f]}
									<tr class:bad={f.credit < 1}>
										<td>{k}</td><td>{show(f.given)}</td><td>{show(f.expected)}</td><td>{pct(f.credit)}</td>
									</tr>
								{/each}
							</tbody>
						</table>

						{#if t.answer?.steps?.length}
							<p class="k">reasoning chain</p>
							<ol class="steps">
								{#each t.answer.steps as s}
									<li>
										<span>{s.claim}</span>
										<span class="ev">
											{#each s.evidence as e}
												<code class:fake={t.invented.includes(e)}>{e}</code>
											{:else}
												<em>uncited</em>
											{/each}
										</span>
									</li>
								{/each}
							</ol>
						{/if}

						{#if t.answer?.remediation}
							<p class="verdict"><span class="k">remediation</span>{t.answer.remediation}</p>
						{/if}

						<dl class="checks">
							<dt>passed</dt><dd>{t.hits.join(', ') || '—'}</dd>
							<dt>missed</dt><dd>{t.misses.join(', ') || '—'}</dd>
							<dt>violations</dt><dd class:bad={t.violations.length}>{t.violations.join(', ') || '—'}</dd>
							<dt>citation</dt><dd>{pct(t.citation)} · cited {t.cited.join(' ') || 'none'}{t.invented.length ? ` · invented ${t.invented.join(' ')}` : ''}</dd>
						</dl>
					</div>
				{/if}
			</li>
		{/each}
	</ol>
</section>

<style>
	.drill {
		margin-top: 40px;
		border: 1px solid var(--rule);
		border-top: 3px solid var(--c);
		background: var(--panel);
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: start;
		padding: 16px 20px;
		border-bottom: 1px solid var(--rule);
	}
	.eyebrow {
		margin: 0 0 4px;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-dim);
	}
	h2 {
		font-family: var(--serif);
		font-weight: 400;
		font-size: 24px;
		margin: 0;
	}
	h2 i {
		display: inline-block;
		width: 10px;
		height: 10px;
		background: var(--c);
		margin-right: 10px;
		vertical-align: middle;
	}
	.close {
		background: none;
		border: 1px solid var(--rule);
		padding: 4px 10px;
		cursor: pointer;
		font-size: 12px;
	}
	.tasks {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.tasks > li {
		border-bottom: 1px solid var(--rule);
	}
	.tasks > li:last-child {
		border-bottom: 0;
	}
	.row {
		all: unset;
		box-sizing: border-box;
		width: 100%;
		display: grid;
		grid-template-columns: 90px 1fr 46px 70px 40px;
		gap: 16px;
		align-items: center;
		padding: 12px 20px;
		cursor: pointer;
	}
	.row:hover,
	.open .row {
		background: color-mix(in srgb, var(--c) 7%, transparent);
	}
	.row:focus-visible {
		outline: 2px solid var(--signal);
		outline-offset: -2px;
	}
	.id {
		color: var(--ink-dim);
		font-size: 12px;
	}
	.title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.axes {
		display: flex;
		gap: 3px;
		height: 18px;
		align-items: end;
	}
	.ax {
		width: 12px;
		height: 100%;
		background: var(--rule);
		display: flex;
		align-items: end;
	}
	.ax b {
		width: 100%;
		background: var(--c);
	}
	.words {
		font-size: 12px;
		color: var(--ink-dim);
		text-align: right;
	}
	.words.over {
		color: var(--bad);
	}
	.score {
		font-family: var(--serif);
		font-size: 20px;
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	.detail {
		padding: 4px 20px 20px 126px;
		display: grid;
		gap: 14px;
		font-size: 13px;
	}
	.k {
		display: block;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--ink-dim);
		margin: 0 0 4px;
	}
	.verdict {
		margin: 0;
	}
	.err {
		margin: 0;
		color: var(--bad);
	}
	.fields {
		border-collapse: collapse;
		width: 100%;
	}
	.fields th {
		font-weight: 400;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ink-dim);
		text-align: left;
		padding: 4px 8px 4px 0;
		border-bottom: 1px solid var(--rule);
	}
	.fields td {
		padding: 6px 8px 6px 0;
		border-bottom: 1px solid color-mix(in srgb, var(--rule) 50%, transparent);
	}
	tr.bad td:nth-child(2),
	.bad {
		color: var(--bad);
	}
	.steps {
		margin: 0;
		padding-left: 20px;
		display: grid;
		gap: 6px;
	}
	.steps li {
		display: flex;
		justify-content: space-between;
		gap: 16px;
	}
	.ev {
		display: flex;
		gap: 4px;
		flex-shrink: 0;
	}
	.ev code {
		border: 1px solid var(--rule);
		padding: 0 4px;
		font-size: 11px;
	}
	.ev code.fake {
		color: var(--bad);
		border-color: var(--bad);
		text-decoration: line-through;
	}
	.ev em {
		color: var(--ink-dim);
		font-size: 11px;
	}
	.checks {
		display: grid;
		grid-template-columns: 90px 1fr;
		gap: 4px 12px;
		margin: 0;
	}
	.checks dt {
		color: var(--ink-dim);
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.checks dd {
		margin: 0;
	}

	@media (max-width: 860px) {
		.row {
			grid-template-columns: 1fr 46px 40px;
		}
		.id,
		.words {
			display: none;
		}
		.detail {
			padding: 4px 16px 16px;
		}
	}
</style>
