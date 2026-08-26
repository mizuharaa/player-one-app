import type { NativeTheme } from '../../design/native.ts';
import type { Tone } from '../../services/payout/status.ts';

/** A pill tone → theme colours. The only place a payout screen picks a colour. */
export function toneColors(theme: NativeTheme, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'pass':
      return { fg: theme.color.verdict.pass.fg, bg: theme.color.verdict.pass.bg };
    case 'partial':
      return { fg: theme.color.verdict.partial.fg, bg: theme.color.verdict.partial.bg };
    case 'info':
      return { fg: theme.color.tech[700], bg: theme.color.tech[100] };
    case 'muted':
      return { fg: theme.color.mutedForeground, bg: theme.color.muted };
  }
}

/** `YYYY-MM-DD` → `DD/MM/YYYY`, by string, so a UTC-midnight parse cannot shift the day. */
export function displayDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return y !== undefined && m !== undefined && d !== undefined ? `${d}/${m}/${y}` : isoDate;
}
