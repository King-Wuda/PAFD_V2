import type { CatalogueTable } from './types'

function schedule(variant: string, group: string) {
  return [
    { key: 't', label: 'Wall t (mm)', group, variant, align: 'center' as const },
    { key: 'id', label: 'Inside dia ID (mm)', group, variant, align: 'center' as const },
    { key: 'm', label: 'Mass (kg/m)', group, variant, align: 'center' as const },
  ]
}

export const SS_PIPE: CatalogueTable = {
  id: 'ss-pipe',
  label: 'SS Pipe (304L / 316L)',
  name: 'SS Pipe (304L / 316L)',
  variantLabel: 'Schedule:',
  variants: [
    { id: 'sch10s', label: 'Sch 10S' },
    { id: 'sch40s', label: 'Sch 40S' },
  ],
  sheets: [
    {
      id: 'ss-sheet',
      label: 'SS Pipe',
      name: 'SS Pipe (304L / 316L)',
      columns: [
        { key: 'nps', label: 'NPS (Inches)', align: 'center' },
        { key: 'dn', label: 'DN (mm)', align: 'center' },
        { key: 'od', label: 'OD (mm)', align: 'center' },
        ...schedule('sch10s', 'Schedule 10S'),
        ...schedule('sch40s', 'Schedule 40S'),
      ],
      rows: [],
    },
  ],
  sourceNote:
    'Austenitic stainless pipe to ANSI B 36.19, grades ASTM A312 TP 304 / 304L and 316 / 316L. ' +
    'Inside diameter calculated as OD − 2t.',
}
