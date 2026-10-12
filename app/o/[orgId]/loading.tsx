export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-4">
      <div className="h-8 w-48 rounded-lg bg-stone-200" />
      <div className="h-4 w-72 rounded bg-stone-200" />
      <div className="mt-6 h-64 rounded-xl bg-stone-200/70" />
    </div>
  )
}
