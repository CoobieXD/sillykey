# SillyKey

Deterministic password generator. Master password + service name + year = always the same unique password. Nothing stored, nothing transmitted.

## How It Works

Enter your master password and a service name (e.g. `gmail`). SillyKey generates a unique 24-character password using iterated SHA-256 hashing.

### Algorithm

```
base58(sha256^100000(master + service + year + "why not?"))[0:24]
```

100,000 iterations of SHA-256 run in a Web Worker.

## Usage

Open `index.html` in a browser, or serve with any static server:

```bash
python3 -m http.server 8000
```

## Security

- All crypto runs locally in the browser
- No network requests, no storage, no cookies
- Fields auto-clear after 5 minutes of inactivity
- Fields clear when switching tabs

## License

MIT
