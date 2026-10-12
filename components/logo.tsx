import Link from 'next/link'

export function Logo({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight text-stone-900">
      <span aria-hidden className="grid size-7 place-items-center rounded-md bg-emerald-700 text-sm text-white">
        M
      </span>
      Munkalap
    </Link>
  )
}
