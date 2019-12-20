# SillyKey

Deterministic password generator that runs entirely in the browser. Master password + service name + year = always the same unique password. Nothing stored, nothing transmitted, nothing to sync.

## How It Works

Enter your master password and a service name (e.g. `gmail`, `github`). SillyKey deterministically derives a unique 24-character password. Same input always produces the same output — no database, no cloud, no account needed.

### Year Selector

The year field serves as a built-in rotation nudge. When a new year comes, it's easier to generate a fresh password than to keep selecting last year from the dropdown.

## Generation Methods

### Legacy (default for older passwords)

```
base58(sha256^100000(master + service + year + "why not?"))[0:24]
```

100,000 iterations of SHA-256 in a Web Worker.

### HMAC

Instant HMAC-SHA256. Bash-compatible output.

```
base64url(HMAC-SHA256(key=master, msg=service + ":" + year))[0:24]
```

Bash equivalent shown below the form.

### PBKDF2

Uses Web Crypto API with 1,000,000 iterations.

```
base64url(PBKDF2-SHA256(password=master, salt="sillykey:" + service + ":" + year, iterations=1000000))[0:24]
```

## Random Password Generator

Click the dice icon to generate a cryptographically random 24-character password.

## Security

- All crypto via native Web Crypto API (`crypto.subtle`)
- Auto-clear after 5 minutes of inactivity
- Instant clear when switching tabs (`visibilitychange`)
- Input elements replaced (not just cleared) to destroy undo history
- Clipboard cleared if it still contains the generated password
- Click background to clear clipboard manually
- No network requests, no localStorage, no cookies

## Development

```bash
python3 -m http.server 8000
```

### Verification

1. Legacy: master=`test`, service=`gmail`, year=`2020` → `8AYCtFnWMzNnfBmUCJ64h5nu`
2. HMAC: generate, copy bash formula, run it — results must match

## License

MIT
