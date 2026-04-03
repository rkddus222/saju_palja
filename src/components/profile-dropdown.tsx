import { useEffect, useMemo, useRef, useState } from 'react'
import { calculateSaju } from '../saju-calc'
import { formatBirthText, normalizeMbtiInput } from '../saju-format'
import type { SavedProfile } from '../profile-store'

export function ProfileDropdown({
  profiles,
  activeProfileId,
  onLoad,
  onDelete,
}: {
  profiles: SavedProfile[]
  activeProfileId: string | null
  onLoad: (profile: SavedProfile) => void
  onDelete: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const profileSummaries = useMemo(() => (
    profiles.map(profile => {
      const name = profile.form.name.trim() || '의뢰인'
      const birth = formatBirthText(profile.form)
      const gender = profile.form.gender === 'female' ? '여' : '남'
      const mbti = normalizeMbtiInput(profile.form.mbti)
      const year = Number(profile.form.year)
      const month = Number(profile.form.month)
      const day = Number(profile.form.day)
      const hourVal = profile.form.hour === '' || profile.form.hour === 'unknown' ? null : Number(profile.form.hour)

      let preview = ''
      if (year && month && day) {
        const result = calculateSaju(year, month, day, hourVal)
        preview = `${result.dayPillar.stemChar}${result.dayPillar.branchChar}`
      }

      return { profile, name, birth, gender, mbti, preview }
    })
  ), [profiles])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const active = profiles.find(profile => profile.id === activeProfileId)
  const activeLabel = active
    ? `${active.form.name.trim() || '의뢰인'} · ${formatBirthText(active.form)}`
    : '저장된 사주 선택'

  return (
    <div className="dropdown" ref={dropdownRef}>
      <button
        type="button"
        className={`dropdown-trigger ${open ? 'dropdown-trigger--open' : ''}`}
        onClick={() => setOpen(v => !v)}
      >
        <span className="dropdown-trigger-label">{activeLabel}</span>
        <span className="dropdown-trigger-badge">{profiles.length}</span>
        <span className={`dropdown-arrow ${open ? 'dropdown-arrow--open' : ''}`}>&#9662;</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          {profileSummaries.map(({ profile, name, birth, gender, mbti, preview }) => (
            <div
              key={profile.id}
              className={`dropdown-item ${profile.id === activeProfileId ? 'dropdown-item--active' : ''}`}
              onClick={() => { onLoad(profile); setOpen(false) }}
            >
              {confirmDeleteId === profile.id ? (
                <div className="dropdown-confirm" onClick={e => e.stopPropagation()}>
                  <span className="dropdown-confirm-text">삭제할까요?</span>
                  <button className="dropdown-confirm-yes" onClick={() => { onDelete(profile.id); setConfirmDeleteId(null) }}>삭제</button>
                  <button className="dropdown-confirm-no" onClick={() => setConfirmDeleteId(null)}>취소</button>
                </div>
              ) : (
                <>
                  <div className="dropdown-item-body">
                    <span className="dropdown-item-name">{name}</span>
                    <span className="dropdown-item-meta">
                      {birth} · {gender}
                      {mbti && <span className="dropdown-item-preview"> · {mbti}</span>}
                      {preview && <span className="dropdown-item-preview"> · {preview}</span>}
                    </span>
                  </div>
                  <button
                    className="dropdown-item-delete"
                    onClick={e => { e.stopPropagation(); setConfirmDeleteId(profile.id) }}
                    title="삭제"
                    aria-label="삭제"
                  >
                    &times;
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
