import type { TotalsSnapshot } from '../../../shared/types';
import { formatA, formatW } from '../../../shared/calculations';

const COLORS: Record<TotalsSnapshot['phase'], string> = {
  ok: '#0f766e',
  dichtbij: '#b45309',
  accu: '#b45309',
  over: '#b91c1c'
};

export function Gauge({ totals }: { totals: TotalsSnapshot }) {
  const radius = 76;
  const circumference = 2 * Math.PI * radius;
  const visible = circumference * 0.75;
  const fraction = Math.max(0, Math.min(1, totals.percent / 100));
  const color = COLORS[totals.phase];

  return (
    <div className="relative mx-auto w-full max-w-[240px]">
      <svg
        viewBox="0 0 200 200"
        role="img"
        aria-label={`Netbelasting ${formatA(totals.gridA)} van ${totals.limitA} ampère`}
        className="w-full"
      >
        <g transform="rotate(135 100 100)">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e9e5dc"
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${visible} ${circumference}`}
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${visible * fraction} ${circumference}`}
            style={{ transition: 'stroke-dasharray 400ms ease, stroke 300ms ease' }}
          />
        </g>
        <text
          x="100"
          y="94"
          textAnchor="middle"
          className="fill-stone-900"
          style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.04em' }}
        >
          {formatA(totals.gridA)}
        </text>
        <text
          x="100"
          y="114"
          textAnchor="middle"
          className="fill-stone-500"
          style={{ fontSize: '11px', fontWeight: 500 }}
        >
          van {totals.limitA} A
        </text>
        <text
          x="100"
          y="146"
          textAnchor="middle"
          className="fill-stone-500 tnum"
          style={{ fontSize: '11px', fontWeight: 500 }}
        >
          {Math.round(totals.percent)}% · {formatW(totals.gridW)}
        </text>
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-between px-8 text-[10px] font-medium text-stone-400">
        <span>0</span>
        <span>{totals.limitA} A</span>
      </div>
    </div>
  );
}
