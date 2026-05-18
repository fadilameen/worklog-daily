'use client'

const CHIP_COLORS = ['#d97757', '#b85885', '#5b88c4', '#c14545', '#875a7b', '#6aa84f', '#4d908e', '#e0a82e']

function chipColor(email: string): string {
  let h = 0
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) | 0
  return CHIP_COLORS[Math.abs(h) % CHIP_COLORS.length]
}

function chipName(email: string): string {
  const local = email.split('@')[0] || email
  return local.split(/[._-]/).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ')
}

export function RecipientChips({ label, emails, onAdd, onRemove, inputValue, setInputValue }: {
  label: string
  emails: string[]
  onAdd: (email: string) => void
  onRemove: (email: string) => void
  inputValue: string
  setInputValue: (v: string) => void
}) {
  const commit = () => {
    const v = inputValue.trim()
    if (v) onAdd(v)
    setInputValue('')
  }
  return (
    <div className="flex items-start gap-2 border-b border-gray-200 bg-white py-2 px-3">
      <span className="text-xs text-gray-500 w-8 pt-1.5 shrink-0">{label}</span>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">
        {emails.map((e) => {
          const name = chipName(e)
          return (
            <span key={e} title={e} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-1 py-0.5 text-xs text-black">
              <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: chipColor(e) }}>
                {(name[0] || '?').toUpperCase()}
              </span>
              <span className="pr-1">{name}</span>
              <button type="button" onClick={() => onRemove(e)} className="rounded-full p-0.5 text-gray-500 hover:bg-gray-200 hover:text-black">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </span>
          )
        })}
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',' || e.key === ' ') { e.preventDefault(); commit() } }}
          onBlur={commit}
          className="min-w-[120px] flex-1 bg-white text-xs text-black outline-none"
        />
      </div>
    </div>
  )
}
