import { useEffect, useRef, useState } from 'react'
import type { GuideCategory } from '../guide-data'

export function GuideModal({ guide, onClose }: { guide: GuideCategory; onClose: () => void }) {
  const [expanded, setExpanded] = useState<number | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const handleToggle = (index: number) => {
    const next = expanded === index ? null : index
    setExpanded(next)
    if (next !== null) {
      window.setTimeout(() => {
        itemRefs.current[next]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }, 50)
    }
  }

  return (
    <div className="guide-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose() }}>
      <div className="guide-modal">
        <div className="guide-modal-header">
          <h2 className="guide-modal-title">{guide.title}</h2>
          <button className="guide-modal-close" onClick={onClose} aria-label="닫기">&times;</button>
        </div>
        <p className="guide-modal-desc">{guide.description}</p>
        <div className="guide-list">
          {guide.items.map((item, index) => (
            <div
              key={index}
              ref={el => { itemRefs.current[index] = el }}
              className={`guide-item ${expanded === index ? 'guide-item--open' : ''}`}
            >
              <button className="guide-item-header" onClick={() => handleToggle(index)}>
                <div className="guide-item-left">
                  <span className="guide-item-name">
                    {item.name}
                    {item.hanja && <span className="guide-item-hanja"> {item.hanja}</span>}
                  </span>
                  {(item.yinYang || item.element) && (
                    <span className="guide-item-tags">
                      {item.yinYang && <span className={`guide-tag guide-tag--${item.yinYang === '양' ? 'yang' : 'yin'}`}>{item.yinYang}</span>}
                      {item.element && <span className="guide-tag guide-tag--element">{item.element}</span>}
                    </span>
                  )}
                </div>
                <span className="guide-item-arrow">{expanded === index ? '\u25B2' : '\u25BC'}</span>
              </button>
              <div className="guide-item-summary">{item.summary}</div>
              {expanded === index && <div className="guide-item-detail">{item.detail}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
