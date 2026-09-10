import type { CatalogueTable } from './types'

export const SANS719_PIPE: CatalogueTable = {
  id: 'sans719-pipe',
  label: 'SANS 719 Pipe (Large bore)',
  name: 'SANS 719 Pipe (large bore)',
  variants: [{ id: 'x', label: '' }],
  sheets: [
    {
      id: 'sans719-sheet',
      label: 'SANS 719 Pipe',
      name: 'SANS 719 Pipe (large bore)',
      columns: [
        { key: 'nps', label: 'NPS (Inches)', align: 'center' },
        { key: 'dn', label: 'DN (mm)', align: 'center' },
        { key: 'od', label: 'OD (mm)', align: 'center' },
        { key: 't', label: 'Wall t (mm)', variant: 'x', align: 'center' },
        { key: 'id', label: 'Inside dia ID (mm)', variant: 'x', align: 'center' },
        { key: 'grade', label: 'Grade', align: 'center' },
        { key: 'm', label: 'Mass (kg/m)', variant: 'x', align: 'center' },
      ],
      // One nominal size appears several times, once per stocked wall thickness.
      rows: [],
    },
  ],
  sourceNote:
    'Uncoated plain-ended welded pipe to SANS 719, grades A and B, as stocked. Wall thickness ' +
    'as listed; inside diameter is OD − 2t; mass is calculated for steel.',
}
