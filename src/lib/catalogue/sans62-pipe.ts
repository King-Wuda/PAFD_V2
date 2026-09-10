import type { CatalogueTable } from './types'

function pipeClass(variant: string, group: string) {
  return [
    { key: 't', label: 'Wall t (mm)', group, variant, align: 'center' as const },
    { key: 'id', label: 'Inside dia ID (mm)', group, variant, align: 'center' as const },
    { key: 'm', label: 'Mass (kg/m)', group, variant, align: 'center' as const },
  ]
}

export const SANS62_PIPE: CatalogueTable = {
  id: 'sans62-pipe',
  label: 'SANS 62 Pipe (Med / Hvy)',
  name: 'SANS 62 Pipe (medium / heavy)',
  variantLabel: 'Schedule:',
  variants: [
    { id: 'med', label: 'Medium' },
    { id: 'hvy', label: 'Heavy' },
  ],
  sheets: [
    {
      id: 'sans62-sheet',
      label: 'SANS 62 Pipe',
      name: 'SANS 62 Pipe (medium / heavy)',
      columns: [
        { key: 'nps', label: 'NPS (Inches)', align: 'center' },
        { key: 'dn', label: 'DN (mm)', align: 'center' },
        { key: 'od', label: 'OD (mm)', align: 'center' },
        ...pipeClass('med', 'Medium class'),
        ...pipeClass('hvy', 'Heavy class'),
      ],
      rows: [],
    },
  ],
  sourceNote:
    'Uncoated plain-ended pipe to SANS 62 (BS 1387), CQ HR steel. Medium and heavy classes ' +
    'share the same OD; the wall and bore differ. Inside diameter is OD − 2t; mass is ' +
    'calculated for steel.',
}
