import './style.css'

// ── Terminal content definitions ──────────────────────────────────────────────
// Each tab has a command string and an array of output lines.
// Lines are HTML strings. null = blank line.

// Use shorter bars on narrow screens so output doesn't wrap
const isMobile = () => window.innerWidth < 640

const G  = s => `<span class="text-green-500">${s}</span>`
const Y  = s => `<span class="text-yellow-500">${s}</span>`
const R  = s => `<span class="text-red-500">${s}</span>`
const W  = s => `<span class="text-zinc-100">${s}</span>`
const D  = s => `<span class="text-zinc-500">${s}</span>`
const DK = s => `<span class="text-zinc-600">${s}</span>`
const B  = s => `<span class="font-bold text-zinc-100">${s}</span>`
const DOT = `<span class="text-zinc-700"> · </span>`

// Build tab content — bar widths adapt to screen size
function buildTabs() {
  const mobile = isMobile()
  // Desktop: 12-char bars. Mobile: 7-char bars so lines don't wrap.
  const bar = (filled, total, color) => {
    const f = mobile ? Math.round(filled * 7 / total) : filled
    const e = mobile ? 7 - f : total - filled
    const fn = { G, Y, R }[color] || G
    return fn('█'.repeat(f)) + DK('░'.repeat(e))
  }

  return {
    status: {
      command: 'lumen status',
      statusBar: 'lumen · garmin · synced 2m ago · try: lumen ask "..."',
      lines: [
        null,
        D('saturday, may 10'),
        null,
        B('Recovery'),
        `  ${G('78')}${DK('/100')}  ${bar(9,12,'G')}  ${DK('78%')}`,
        `  ${D('hrv ')}${W('62ms')}${DOT}${D('rhr ')}${W('47bpm')}${DOT}${D('spo2 ')}${W('98.4%')}`,
        null,
        B('Sleep'),
        `  ${G('84')}${DK('/100')}  ${bar(10,12,'G')}  ${DK('84%')}`,
        `  ${W('8h 22m')}${DOT}${W('91%')}${D(' efficient')}`,
        null,
        `  ${D('deep ')} ${W('1h 18m')}  ${bar(3,12,'Y')}  ${DK('22%')}`,
        `  ${D('rem  ')} ${W('2h 14m')}  ${bar(3,12,'Y')}  ${DK('27%')}`,
        `  ${D('light')} ${W('4h 50m')}  ${bar(6,12,'G')}  ${DK('51%')}`,
        null,
        B('Activity'),
        `  ${W('9,234')}${D(' steps')}${DOT}${W('2,140')}${D(' kcal')}${DOT}${W('42min')}${D(' active')}`,
        null,
        DK('lumen · garmin · try: lumen ask "..." for insights'),
      ],
    },

    ask: {
      command: mobile ? 'lumen ask "ready to train today?"' : 'lumen ask "am I ready to train hard today?"',
      statusBar: 'lumen · powered by anthropic claude',
      lines: [
        null,
        `${DK('❯ ')}${W('am I ready to train hard today?')}`,
        null,
        `Your HRV is ${W('62ms')} — 8% above your 30-day average.`,
        `Recovery is solid at ${G('78/100')} and you slept ${W('8h 22m')}.`,
        `All signals point green. ${G('Push the heavy session.')}`,
        null,
        `Fuel well beforehand — yesterday's burn`,
        `(${W('2,140 kcal')}) means you need a solid pre-workout meal.`,
        null,
        DK('lumen · try: lumen plan for a full day plan'),
      ],
    },

    recovery: {
      command: 'lumen recovery',
      statusBar: 'lumen · garmin · 7-day trend',
      lines: [
        null,
        D('7-day recovery trend'),
        null,
        `  ${W('may 10')}  ${G('78')}${DK('/100')}  ${bar(9,12,'G')}  ${DK('78%')}`,
        `  ${W('may 09')}  ${Y('52')}${DK('/100')}  ${bar(6,12,'Y')}  ${DK('52%')}`,
        `  ${W('may 08')}  ${G('81')}${DK('/100')}  ${bar(10,12,'G')}  ${DK('81%')}`,
        `  ${W('may 07')}  ${G('89')}${DK('/100')}  ${bar(11,12,'G')}  ${DK('89%')}`,
        `  ${W('may 06')}  ${R('45')}${DK('/100')}  ${bar(5,12,'R')}  ${DK('45%')}`,
        `  ${W('may 05')}  ${G('73')}${DK('/100')}  ${bar(9,12,'G')}  ${DK('73%')}`,
        `  ${W('may 04')}  ${Y('67')}${DK('/100')}  ${bar(8,12,'Y')}  ${DK('67%')}`,
        null,
        `  ${D('avg ')}${G('69')}${DK('/100')}${DOT}${D('hrv ')}${W('58ms')}${DOT}${D('rhr ')}${W('47bpm')}`,
        null,
        DK('lumen · garmin'),
      ],
    },

    goals: {
      command: 'lumen goals',
      statusBar: 'lumen · try: lumen ask "am I on track?"',
      lines: [
        null,
        B('Goals'),
        null,
        `  🎯  ${W('run 5k under 25min')}${DOT}${G('on track')}`,
        `  😴  ${W('avg 8h sleep')}${DOT}${Y('7h 48m · almost there')}`,
        `  💪  ${W('recovery ≥ 67 / 7 days')}${DOT}${Y('⚡ 3d streak')}`,
        `  ❤️   ${W('rhr under 45bpm')}${DOT}${D('47bpm · trending down')}`,
        null,
        DK('lumen · try: lumen ask "am I on track?"'),
      ],
    },

    plan: {
      command: 'lumen plan',
      statusBar: 'lumen · ai-generated daily plan',
      lines: [
        null,
        D('saturday, may 10'),
        null,
        B('Morning Assessment'),
        `  Recovery ${G('78/100')} with HRV trending up.`,
        `  Green light — don't hold back today.`,
        null,
        B('Training Priority'),
        `  Heavy strength or tempo run. Body is primed.`,
        `  Aim for 75–85% max effort.`,
        null,
        B('Evening Optimization'),
        `  Target 8h sleep. Avoid screens after 10pm.`,
        `  Deep sleep at 22% — needs to hit 25%+.`,
        null,
        DK('lumen · try: lumen ask "..." for follow-ups'),
      ],
    },
  }
}

// ── Typing engine ─────────────────────────────────────────────────────────────

const CHAR_DELAY    = 38   // ms per character while typing the command
const LINE_DELAY    = 55   // ms between output lines
const BLANK_DELAY   = 28   // ms for blank lines (faster)
const PAUSE_AFTER_CMD = 220 // ms pause between command and output

let currentAnimation = null  // AbortController for cancelling in-progress anim

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function typeTab(name, signal) {
  const tab = buildTabs()[name]
  if (!tab) return

  const output = document.getElementById('terminal-output')
  const statusBar = document.getElementById('status-bar')
  if (!output) return

  // Clear and set status bar
  output.innerHTML = ''
  if (statusBar) statusBar.textContent = tab.statusBar

  // ── 1. Prompt line ──
  const promptLine = document.createElement('div')
  output.appendChild(promptLine)

  const promptSpan = document.createElement('span')
  promptSpan.className = 'text-zinc-500'
  promptSpan.textContent = '~ $ '
  promptLine.appendChild(promptSpan)

  const cmdSpan = document.createElement('span')
  cmdSpan.className = 'text-zinc-100'
  promptLine.appendChild(cmdSpan)

  // Blinking cursor while typing
  const typingCursor = document.createElement('span')
  typingCursor.className = 'cursor'
  promptLine.appendChild(typingCursor)

  // ── 2. Type the command character by character ──
  for (const char of tab.command) {
    if (signal?.aborted) return
    cmdSpan.textContent += char
    await sleep(CHAR_DELAY + Math.random() * 18) // slight jitter = more realistic
  }

  // Remove cursor from command line
  typingCursor.remove()

  await sleep(PAUSE_AFTER_CMD)
  if (signal?.aborted) return

  // ── 3. Reveal output lines ──
  for (const line of tab.lines) {
    if (signal?.aborted) return

    const lineEl = document.createElement('div')

    if (line === null) {
      lineEl.innerHTML = '&nbsp;'
      lineEl.className = 'leading-[0.6]'
      output.appendChild(lineEl)
      await sleep(BLANK_DELAY)
    } else {
      lineEl.innerHTML = line
      lineEl.className = 'text-zinc-300'
      output.appendChild(lineEl)
      await sleep(LINE_DELAY)
    }

    output.scrollTop = output.scrollHeight
  }

  if (signal?.aborted) return

  // ── 4. Blinking cursor at the end ──
  const endLine = document.createElement('div')
  const endCursor = document.createElement('span')
  endCursor.className = 'cursor'
  endLine.appendChild(endCursor)
  output.appendChild(endLine)
  output.scrollTop = output.scrollHeight
}

// ── Tab switching ─────────────────────────────────────────────────────────────

let activeTab = 'status'

function switchTab(name) {
  if (name === activeTab && currentAnimation) return  // already running this tab

  // Cancel any running animation
  if (currentAnimation) {
    currentAnimation.abort()
  }

  // Update tab button styles
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === name
    btn.classList.toggle('text-zinc-100', isActive)
    btn.classList.toggle('bg-zinc-950', isActive)
    btn.classList.toggle('text-zinc-400', !isActive)
  })

  activeTab = name

  // Start new animation
  const controller = new AbortController()
  currentAnimation = controller
  typeTab(name, controller.signal).then(() => {
    if (currentAnimation === controller) currentAnimation = null
  })
}

function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  })

  // Boot with Status tab
  switchTab('status')
}

// ── Copy install command ──────────────────────────────────────────────────────

function initCopyButtons() {
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      navigator.clipboard.writeText('npm install -g lumen-health').catch(() => {})

      const textEl = btn.querySelector('.copy-text')
      const iconEl = btn.querySelector('.copy-icon')
      if (!textEl) return

      const orig = textEl.textContent
      textEl.textContent = '✓ copied!'
      if (iconEl) iconEl.style.display = 'none'

      setTimeout(() => {
        textEl.textContent = orig
        if (iconEl) iconEl.style.display = ''
      }, 2000)
    })
  })
}

// ── Scroll reveal ─────────────────────────────────────────────────────────────

function initScrollReveal() {
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible')
          observer.unobserve(entry.target)
        }
      })
    },
    { threshold: 0.08 },
  )
  document.querySelectorAll('.reveal').forEach(el => observer.observe(el))
}

// ── Boot ──────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initTabs()
  initCopyButtons()
  initScrollReveal()
})
