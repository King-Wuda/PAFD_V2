import type { CatalogueTable } from './types'
import { ROWS } from './rows/ms-pipe'

/** Wall / bore / mass columns, repeated per schedule. */
function schedule(variant: string, group: string) {
  return [
    { key: 't', label: 'Wall t (mm)', group, variant, align: 'center' as const },
    { key: 'id', label: 'Inside dia ID (mm)', group, variant, align: 'center' as const },
    { key: 'm', label: 'Mass (kg/m)', group, variant, align: 'center' as const },
  ]
}

export const MS_PIPE: CatalogueTable = {
  id: 'ms-pipe',
  label: 'MS Pipe (ASTM A106 Gr. B)',
  name: 'MS Pipe (ASTM A106 Gr. B seamless)',
  variantLabel: 'Schedule:',
  variants: [
    { id: 'sch40', label: 'Sch 40' },
    { id: 'sch80', label: 'Sch 80' },
  ],
  sheets: [
    {
      id: 'ms-sheet',
      label: 'MS Pipe',
      name: 'MS Pipe (ASTM A106 Gr. B seamless)',
      columns: [
        { key: 'nps', label: 'NPS (Inches)', align: 'center' },
        { key: 'dn', label: 'DN (mm)', align: 'center' },
        { key: 'od', label: 'OD (mm)', align: 'center' },
        ...schedule('sch40', 'Schedule 40'),
        ...schedule('sch80', 'Schedule 80'),
      ],
      rows: ROWS['ms-sheet'] ?? [],
    },
  ],
  sourceNote:
    'Seamless pipe to ASTM A106 / API 5L. Sch 40 = STD and Sch 80 = XS up to 250 NB; ' +
    'above that the schedule walls are listed.',
}
