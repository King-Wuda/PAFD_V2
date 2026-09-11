import { ImportWizard } from '@/components/ImportWizard'
import { SubPageHead } from '@/components/PageHead'
import { fetchSuppliers, isConfigured } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function ImportPage() {
  if (!isConfigured) {
    return (
      <>
        <SubPageHead title="Upload a price list" />
        <p className="banner amber">
          The price database is not configured, so there is nothing to import into.
        </p>
      </>
    )
  }

  const suppliers = await fetchSuppliers()
  return (
    <>
      <SubPageHead
        title="Upload a price list"
        meta="Nothing is overwritten. Importing adds a list; the previous one stays and can be made current again."
      />
      <ImportWizard suppliers={suppliers.map((supplier) => supplier.name)} />
    </>
  )
}
