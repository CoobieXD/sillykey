# SillyKey

Deterministic password generator that runs entirely in the browser. One master password + service name + year = always the same unique password. Nothing is stored, nothing is transmitted, nothing to sync.

## How It Works

Enter your master password and a service name (e.g. `gmail`, `github`). SillyKey deterministically derives a unique 24-character password. Same input always produces the same output — no database, no cloud, no account needed.

### Year Selector

The year field serves as a built-in rotation nudge. When a new year comes, it's easier to generate a fresh password than to keep selecting last year from the dropdown. If you need to reset a password mid-year, just append a suffix to the service name (e.g. `gmail2`).

### Special Characters

Generated passwords are alphanumeric (`A-Za-z0-9`). If a site requires a special character, append `!` manually — the same way every time.

## Generation Methods

### PBKDF2 (default)

The recommended method. Uses Web Crypto API with 1,000,000 iterations (above OWASP 2023 recommendation of 600,000).

```
base58(PBKDF2-SHA256(password=master, salt="sillykey:" + service + ":" + year, iterations=1000000))[0:24]
```

- Output: `A-Za-z0-9` (base58, 24 characters)
- ~80ms on desktop, ~400-800ms on mobile
- Maximum brute-force resistance

### HMAC

Instant HMAC-SHA256 with bash-compatible output. Use this when you need to reproduce the password in a terminal without the web app.

```
base64clean(HMAC-SHA256(key=master, msg=service + ":" + year))[0:24]
```

- Output: `A-Za-z0-9` (base64 with `+/=` removed, 24 characters)
- Sub-millisecond generation
- Bash equivalent shown below the form — copy and run

#### Bash One-Liner

```bash
 echo -n "gmail:2026" | openssl dgst -sha256 -hmac "YOUR_MASTER" -binary | base64 | tr -d '+/=\n' | head -c 24
```

The leading space prevents the command (containing your master password) from being saved in shell history (requires `HISTCONTROL=ignorespace` in bash or `HIST_IGNORE_SPACE` in zsh — enabled by default on macOS).

### Legacy (v1)

Preserved for backward compatibility with previously generated passwords. Only available for years 2025 and earlier.

```
base58(sha256^100000(master + service + year + "why not?"))[0:24]
```

- Output: `A-Za-z1-9` (base58, 24 characters)
- Runs in a Web Worker (100k SHA-256 iterations)
- Auto-selected when choosing year ≤ 2025

### Compatibility Methods (hidden)

Original PBKDF2 and HMAC with base64url output (`A-Za-z0-9_-`) are hidden but still functional for backward compatibility with previously generated passwords.

## Random Password Generator

Click the dice icon next to the password field to generate a cryptographically random 24-character password (`A-Za-z0-9`). The password is automatically copied to the clipboard.

## Security Features

**Cryptography**
- All crypto via native Web Crypto API (`crypto.subtle`)
- PBKDF2: 1,000,000 iterations SHA-256
- HMAC: HMAC-SHA256
- Random generation: `crypto.getRandomValues`

**Auto-Clear**
- All fields cleared after 5 minutes of inactivity
- All fields cleared instantly when switching tabs or locking screen (`visibilitychange`)
- Input elements are replaced (not just cleared) to destroy the browser's undo history — `Ctrl+Z` cannot recover the master password
- Clipboard is cleared if it still contains the generated password

**Clipboard**
- Click the background to clear the clipboard manually
- Clipboard auto-cleared on timeout only if it still holds the generated password (won't overwrite unrelated clipboard content)

**No Data Leakage**
- No network requests, no analytics, no external resources
- No `localStorage`, no cookies, no `sessionStorage`
- `<input type="password">` for master password
- `autocomplete="off"` on all fields

## Visual Feedback

- **Hash animation**: While generating, the password field shows random characters cycling at screen refresh rate (60fps / 120fps on ProMotion)
- **Identicon**: A unique visual fingerprint of your master password — helps confirm you typed it correctly without revealing it
- **Background gradient**: Changes based on master password hash, providing another visual confirmation layer

## Architecture

Static frontend, no build system, no bundler, no framework. Opens directly via `index.html` or any static server.

```
index.html      — HTML markup
styles.css      — All styles (key fob, form, bash formula, responsive)
app.js          — Main logic: generation, UI, identicon, clipboard, timers
worker.js       — Web Worker for Legacy method
sha256.js       — SHA-256 (main thread, for identicon)
sha256.min.js   — SHA-256 (js-sha256 library)
base58.js       — Base58 encoding
identicon.js    — SVG identicon generation
```

No external dependencies. No CDN. Everything runs locally.

## Development

```bash
python3 -m http.server 8000
# or
npx serve .
```

### Verification

1. **Legacy**: master=`test`, service=`gmail`, year=`2020` → `8AYCtFnWMzNnfBmUCJ64h5nu`
2. **HMAC**: Generate a password, copy the bash formula, run it — results must match
3. **PBKDF2**: Generate a password, verify it's stable on repeated input

## Password Strength

24 characters from a 62-symbol alphabet = **143 bits of entropy**.

With PBKDF2 at 1M iterations, brute-forcing a 24-character master password would take approximately 10^32 years on a top-end GPU — about 10^22 times the age of the universe.

Even with HMAC (no key stretching), a strong master password (20+ random characters) is computationally infeasible to brute-force.

## License

MIT
