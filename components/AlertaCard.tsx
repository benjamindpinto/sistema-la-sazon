import Link from 'next/link'

interface AlertaCardProps {
  count: number
  label: string
  detail: string
  href: string
  urgente?: boolean
}

export default function AlertaCard({ count, label, detail, href, urgente = false }: AlertaCardProps) {
  return (
    <Link
      href={href}
      className={`flex-1 min-w-[200px] rounded-lg border p-4 transition-colors ${
        urgente
          ? 'bg-[var(--danger-bg)] border-[var(--danger)]/30 hover:border-[var(--danger)]'
          : 'bg-[var(--paper-card)] border-[var(--paper-line)] hover:border-[var(--ember)]/40'
      }`}
    >
      <p className={`font-display text-[26px] font-semibold tabular ${urgente ? 'text-[var(--danger)]' : 'text-[var(--ink)]'}`}>
        {count}
      </p>
      <p className="text-sm font-medium text-[var(--ink)] mt-0.5">{label}</p>
      <p className="text-xs text-[var(--ink-soft)] mt-0.5">{detail}</p>
    </Link>
  )
}
