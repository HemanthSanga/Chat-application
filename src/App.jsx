import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'

const API_URL = '/api/messages'
const NAME_KEY = 'commonroom-display-name'
const POLL_DELAY = 2000

function getSavedName() {
  try {
    return localStorage.getItem(NAME_KEY)?.trim().slice(0, 32) ?? ''
  } catch {
    return ''
  }
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'G'
}

function avatarColor(name = '') {
  const colors = ['lilac', 'sage', 'amber', 'blue', 'rose']
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return colors[Math.abs(hash) % colors.length]
}

function formatTime(value) {
  const parsed = new Date(value.replace(' ', 'T'))
  if (Number.isNaN(parsed.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(parsed)
}

function App() {
  const [messages, setMessages] = useState([])
  const [displayName, setDisplayName] = useState(getSavedName)
  const [nameDraft, setNameDraft] = useState('')
  const [messageDraft, setMessageDraft] = useState('')
  const [isNameDialogOpen, setIsNameDialogOpen] = useState(!getSavedName())
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState('')
  const latestId = useRef('0')
  const isLoadingMessages = useRef(false)
  const messagesArea = useRef(null)
  const messageInput = useRef(null)
  const shouldScroll = useRef(true)
  const isSendingRef = useRef(false)

  const loadMessages = useCallback(async (initial = false) => {
    if (isLoadingMessages.current) return
    isLoadingMessages.current = true
    try {
      const query = initial ? '' : `?after_id=${encodeURIComponent(latestId.current)}`
      const response = await fetch(`${API_URL}${query}`, { headers: { Accept: 'application/json' } })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not load the conversation.')
      if (!Array.isArray(result.messages)) throw new Error('The server returned an invalid message list.')

      setMessages((current) => {
        if (initial) {
          const ordered = result.messages
          if (ordered.length) latestId.current = String(ordered[ordered.length - 1].id)
          return ordered
        }
        const newMessages = result.messages.filter((message) => BigInt(message.id) > BigInt(latestId.current))
        if (newMessages.length) latestId.current = String(newMessages[newMessages.length - 1].id)
        return newMessages.length ? [...current, ...newMessages] : current
      })
      setError('')
    } catch (loadError) {
      setError(loadError.message || 'Could not connect to the chat server.')
    } finally {
      setIsLoading(false)
      isLoadingMessages.current = false
    }
  }, [])

  useEffect(() => {
    let timer
    let cancelled = false
    loadMessages(true).finally(() => {
      if (!cancelled) timer = window.setInterval(() => loadMessages(), POLL_DELAY)
    })
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [loadMessages])

  useEffect(() => {
    const area = messagesArea.current
    if (area && shouldScroll.current) area.scrollTop = area.scrollHeight
  }, [messages])

  function saveDisplayName(event) {
    event.preventDefault()
    const nextName = nameDraft.trim()
    if (!nextName) return
    const safeName = nextName.slice(0, 32)
    try {
      localStorage.setItem(NAME_KEY, safeName)
    } catch {
      setError('Your name could not be saved in this browser, but you can still chat.')
    }
    setDisplayName(safeName)
    setNameDraft('')
    setIsNameDialogOpen(false)
    window.setTimeout(() => messageInput.current?.focus(), 0)
  }

  async function sendMessage(event) {
    event.preventDefault()
    const text = messageDraft.trim()
    if (!text || !displayName || isSendingRef.current) return

    isSendingRef.current = true
    setIsSending(true)
    setError('')
    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender_name: displayName, message: text }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not send your message.')
      setMessages((current) => [...current, result.message])
      latestId.current = String(result.message.id)
      setMessageDraft('')
      shouldScroll.current = true
      messageInput.current?.focus()
    } catch (sendError) {
      setError(sendError.message || 'Could not send your message.')
    } finally {
      isSendingRef.current = false
      setIsSending(false)
    }
  }

  function handleMessageScroll() {
    const area = messagesArea.current
    if (area) shouldScroll.current = area.scrollHeight - area.scrollTop - area.clientHeight < 90
  }

  function handleMessageKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.form.requestSubmit()
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Commonroom home">
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32"><path d="M7 10a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v7a4 4 0 0 1-4 4h-6l-6 4v-5a4 4 0 0 1-2-3z" /><circle cx="12" cy="13.5" r="1" /><circle cx="16" cy="13.5" r="1" /><circle cx="20" cy="13.5" r="1" /></svg>
          </span>
          <span>commonroom</span>
        </a>
        <div className="workspace-label">YOUR SPACE</div>
        <div className="room-link" aria-current="page">
          <span className="room-hash" aria-hidden="true">#</span>
          <span>general</span>
          <span className="live-dot" aria-label="Live room" />
        </div>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <span aria-hidden="true">✳</span>
            <p>A little conversation goes a long way. Say hello!</p>
          </div>
          <div className="sidebar-profile">
            <div className={`avatar avatar-${avatarColor(displayName)}`}>{initials(displayName)}</div>
            <div className="profile-copy"><strong>{displayName || 'Guest'}</strong><span>Here to chat</span></div>
            <span className="live-dot" aria-label="Online" />
          </div>
        </div>
      </aside>

      <section className="chat-panel" aria-label="General chat room">
        <header className="chat-header">
          <div className="room-heading">
            <span className="heading-hash" aria-hidden="true">#</span>
            <div><h1>general</h1><p>A shared space for everyone</p></div>
          </div>
          <div className="header-actions">
            <span className="connection-status"><i /> Live chat</span>
            <button className="profile-button" type="button" onClick={() => { setNameDraft(displayName); setIsNameDialogOpen(true) }} title="Change display name">
              <span className={`avatar avatar-${avatarColor(displayName)}`}>{initials(displayName)}</span>
              <span className="profile-button-name">{displayName || 'Choose a name'}</span>
              <span className="chevron" aria-hidden="true">⌄</span>
            </button>
          </div>
        </header>

        <div className="welcome-card">
          <span className="welcome-mark" aria-hidden="true">✳</span>
          <div><strong>Welcome to the conversation</strong><p>This is the beginning of <b>#general</b>. Make yourself at home.</p></div>
        </div>

        <div className="messages-area" ref={messagesArea} onScroll={handleMessageScroll} role="log" aria-label="Chat messages" aria-live="polite" aria-relevant="additions">
          <div className="message-list">
            {messages.map((message) => (
              <article className="message" key={message.id}>
                <div className={`avatar message-avatar avatar-${avatarColor(message.sender_name)}`} aria-hidden="true">{initials(message.sender_name)}</div>
                <div className="message-copy">
                  <div className="message-meta"><strong>{message.sender_name}</strong><time dateTime={message.created_at}>{formatTime(message.created_at)}</time></div>
                  <p>{message.message}</p>
                </div>
              </article>
            ))}
          </div>
          {isLoading && <div className="loading-state"><span className="loading-dots"><i /><i /><i /></span> Connecting to the room...</div>}
          {!isLoading && messages.length === 0 && !error && <p className="no-messages">No messages yet. Start the conversation!</p>}
        </div>

        <footer className="composer-wrap">
          <p className="composer-hint">Be kind. This room is shared with everyone.</p>
          <form className="composer" onSubmit={sendMessage}>
            <label className="visually-hidden" htmlFor="message-input">Write a message</label>
            <textarea
              id="message-input"
              ref={messageInput}
              rows="1"
              maxLength="2000"
              placeholder={displayName ? 'Message #general' : 'Choose a display name to join the chat'}
              value={messageDraft}
              disabled={!displayName}
              onChange={(event) => setMessageDraft(event.target.value)}
              onKeyDown={handleMessageKeyDown}
            />
            <div className="composer-bottom">
              <span className="composer-hint-short">Enter to send <i>·</i> Shift + Enter for a new line</span>
              <div className="composer-controls">
                <span className="character-count">{messageDraft.length} / 2000</span>
                <button className="send-button" type="submit" aria-label="Send message" disabled={!messageDraft.trim() || isSending || !displayName}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 16-8-6 16-3-6-7-2Z" /><path d="m11 14 4-4" /></svg>
                </button>
              </div>
            </div>
          </form>
          {error && <p className="error-message" role="alert">{error}</p>}
        </footer>
      </section>

      {isNameDialogOpen && (
        <div className="dialog-backdrop">
          <section className="name-dialog" role="dialog" aria-modal="true" aria-labelledby="name-title">
            <span className="dialog-mark" aria-hidden="true">✳</span>
            <h2 id="name-title">{displayName ? 'Change your name' : 'What should we call you?'}</h2>
            <p>Choose a name to use in the chat. You can change it any time.</p>
            <form onSubmit={saveDisplayName}>
              <label htmlFor="name-input">Your display name</label>
              <input id="name-input" autoFocus type="text" maxLength="32" placeholder="e.g. Alex" value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} required />
              <button className="join-button" type="submit">{displayName ? 'Save name' : 'Join the conversation'} <span aria-hidden="true">→</span></button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
