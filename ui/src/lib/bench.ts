export type Run = {
	file: string;
	model: string;
	date: string;
	suite: string;
	demo: boolean;
	overall: number;
	categories: Record<string, number>;
	axes: Record<string, number | null>;
	tasks: TaskResult[];
};

export type TaskResult = {
	taskId: string;
	title: string;
	category: string;
	score: number;
	rubric: number;
	axes: Record<string, number | null>;
	citation: number;
	concision: number;
	words: number;
	budget: number;
	cited: string[];
	invented: string[];
	fields: Record<string, { given: unknown; expected: unknown; credit: number }>;
	hits: string[];
	misses: string[];
	violations: string[];
	structured: boolean;
	error: string | null;
	answer: {
		verdict?: string;
		steps?: { claim: string; evidence: string[] }[];
		remediation?: string;
		confidence?: number;
	} | null;
};

export type Series = {
	model: string;
	provider: string;
	name: string;
	color: string;
	runs: Run[];
};

const PALETTE = ['#e8a33d', '#3f9c86', '#c4553b', '#6f8fc7', '#b07cc6', '#8fae4f', '#d4719a'];

export type Index = { generated: string; runs: Run[] };
export const axisMetrics = ['detect', 'remediate', 'evaluate', 'citation', 'concision'];

// Results arrive from the server load (after login), never from a client-bundled import.
export function buildModel(index: Index) {
	const runs = index.runs.slice().sort((a, b) => a.date.localeCompare(b.date));
	const series: Series[] = [...new Set(runs.map((r) => r.model))].map((model, i) => {
		const [provider, ...rest] = model.split(':');
		return { model, provider, name: rest.join(':'), color: PALETTE[i % PALETTE.length], runs: runs.filter((r) => r.model === model) };
	});
	return {
		runs,
		series,
		generated: index.generated,
		hasDemo: runs.some((r) => r.demo),
		categories: [...new Set(runs.flatMap((r) => Object.keys(r.categories)))],
		dates: [...new Set(runs.map((r) => r.date))].sort()
	};
}

export const metricOf = (run: Run, metric: string) =>
	metric === 'overall' ? run.overall : (run.categories[metric] ?? run.axes?.[metric] ?? null);

export const pct = (v: number | null | undefined) => (v == null ? '—' : Math.round(v * 100).toString());
