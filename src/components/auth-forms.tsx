import { useRef, useState } from 'react'
import { signIn, signOut, signUp, type AuthUser } from '../profile-store'

export function LoginForm({ onAuth, onSignupClick }: { onAuth: (user: AuthUser) => void; onSignupClick: () => void }) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !pw.trim()) {
      setAuthError('아이디와 비밀번호를 입력하세요.')
      return
    }

    const email = id.includes('@') ? id.trim() : `${id.trim()}@saju.app`
    setAuthLoading(true)
    setAuthError(null)

    const { user, error } = await signIn(email, pw)
    if (error) {
      setAuthError('아이디 또는 비밀번호가 틀렸습니다.')
      setAuthLoading(false)
      return
    }

    onAuth(user)
    setAuthLoading(false)
  }

  return (
    <div className="auth-modal auth-modal--inline">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="label" htmlFor="login-id">아이디</label>
          <input id="login-id" type="text" placeholder="아이디 입력" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
        </div>
        <div className="auth-field">
          <label className="label" htmlFor="login-pw">비밀번호</label>
          <input id="login-pw" type="password" placeholder="비밀번호 입력" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" />
        </div>
        {authError && <p className="auth-error">{authError}</p>}
        <button className="auth-submit" type="submit" disabled={authLoading}>
          {authLoading ? '로그인 중...' : '로그인'}
        </button>
        <button type="button" className="auth-switch" onClick={onSignupClick}>
          계정이 없으신가요? <strong>회원가입</strong>
        </button>
      </form>
    </div>
  )
}

export function SignupModal({
  onClose,
  signingUpRef,
}: {
  onClose: (success: boolean) => void
  signingUpRef: React.MutableRefObject<boolean>
}) {
  const [id, setId] = useState('')
  const [pw, setPw] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id.trim() || !pw.trim()) {
      setAuthError('아이디와 비밀번호를 입력하세요.')
      return
    }
    if (pw.length < 6) {
      setAuthError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (pw !== pwConfirm) {
      setAuthError('비밀번호가 일치하지 않습니다.')
      return
    }

    const email = id.includes('@') ? id.trim() : `${id.trim()}@saju.app`
    setAuthLoading(true)
    setAuthError(null)

    signingUpRef.current = true
    const { error } = await signUp(email, pw)
    if (error) {
      setAuthError(error)
      setAuthLoading(false)
      signingUpRef.current = false
      return
    }

    await signOut()
    signingUpRef.current = false
    setAuthLoading(false)
    onClose(true)
  }

  return (
    <div className="guide-overlay" ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(false) }}>
      <div className="auth-modal">
        <div className="guide-modal-header">
          <h2 className="guide-modal-title">회원가입</h2>
          <button className="guide-modal-close" onClick={() => onClose(false)} aria-label="닫기">&times;</button>
        </div>
        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="label" htmlFor="signup-id">아이디</label>
            <input id="signup-id" type="text" placeholder="사용할 아이디" value={id} onChange={e => setId(e.target.value)} autoComplete="username" />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="signup-pw">비밀번호</label>
            <input id="signup-pw" type="password" placeholder="6자 이상" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" />
          </div>
          <div className="auth-field">
            <label className="label" htmlFor="signup-pw2">비밀번호 확인</label>
            <input id="signup-pw2" type="password" placeholder="비밀번호 다시 입력" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {authError && <p className="auth-error">{authError}</p>}
          <button className="auth-submit" type="submit" disabled={authLoading}>
            {authLoading ? '가입 중...' : '가입하기'}
          </button>
        </form>
      </div>
    </div>
  )
}
