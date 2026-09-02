import React from 'react';
import { parsePalmerNotation } from '@/lib/utils';

export function PalmerCross({ teethStr }: { teethStr: string }) {
  const parsed = parsePalmerNotation(teethStr);
  if (!parsed.hasFDI) return <span>{teethStr}</span>;

  const [topL, botL] = parsed.left.split('\n');
  const [topR, botR] = parsed.right.split('\n');

  return (
    <div className="inline-grid grid-cols-2 gap-0 text-center text-xs leading-none font-medium text-white/90 bg-black/20 rounded">
      <div className="border-b border-r border-panel-border/80 px-1.5 py-1 min-w-[24px]">{topL}</div>
      <div className="border-b border-panel-border/80 px-1.5 py-1 min-w-[24px]">{topR}</div>
      <div className="border-r border-panel-border/80 px-1.5 py-1 min-w-[24px]">{botL}</div>
      <div className="px-1.5 py-1 min-w-[24px]">{botR}</div>
    </div>
  );
}
