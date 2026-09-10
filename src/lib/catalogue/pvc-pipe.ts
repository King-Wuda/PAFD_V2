import type { CatalogueTable } from './types'
import { ROWS } from './rows/pvc-pipe'

function pressureClass(variant: string, group: string) {
  return [
    { key: 't', label: 'Wall t (mm)', group, variant, align: 'center' as const },
    { key: 'id', label: 'Inside dia ID (mm)', group, variant, align: 'center' as const },
    { key: 'm', label: 'Mass (kg/m)', group, variant, align: 'center' as const },
  ]
}

export const PVC_PIPE: CatalogueTable = {
  id: 'pvc-pipe',
  label: 'PVC Pipe (Class 9, 12, 16)',
  name: 'PVC Pipe',
  variantLabel: 'Schedule:',
  variants: [
    { id: 'c9', label: 'Class 9' },
    { id: 'c12', label: 'Class 12' },
    { id: 'c16', label: 'Class 16' },
  ],
  sheets: [
    {
      id: 'pvc-sheet',
      label: 'PVC Pipe',
      name: 'PVC Pipe',
      columns: [
        { key: 'nps', label: 'NPS (Inches)', align: 'center' },
        { key: 'dn', label: 'DN (mm)', align: 'center' },
        { key: 'od', label: 'OD (mm)', align: 'center' },
        ...pressureClass('c9', 'Class 9 (9 Bar)'),
        ...pressureClass('c12', 'Class 12 (12 Bar)'),
        ...pressureClass('c16', 'Class 16 (16 Bar)'),
      ],
      rows: ROWS['pvc-sheet'] ?? [],
    },
  ],
  sourceNote:
    'Pressure-class PVC. Inside diameter calculated as OD − 2t. ' +
    'Class 9 is not made in 15 and 20 NB.',
}
