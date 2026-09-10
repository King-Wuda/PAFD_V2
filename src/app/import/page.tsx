import { ImportWizard } from '@/components/ImportWizard'
import { fetchSuppliers, isConfigured } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  if (!isConfigured) {
    return (
      <p className="banner amber">
        The price database is not configured, so there is nothing to import into.
      </p>
    )
  }

  const suppliers = await fetchSuppliers()
  return <ImportWizard suppliers={suppliers.map((supplier) => supplier.name)} />
}
