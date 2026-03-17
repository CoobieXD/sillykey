(function () {
	'use strict';

	// --- Config ---
	const PASSWORD_LENGTH = 24;
	const CLEAR_TIMEOUT = 300; // seconds
	const LEGACY_SALT = 'why not?';
	const PBKDF2_ITERATIONS = 1000000;
	const PBKDF2_SALT_PREFIX = 'sillykey:';

	// --- DOM refs ---
	const $ = (sel) => document.querySelector(sel);
	let masterEl = $('#master');
	let serviceEl = $('#service');
	const yearEl = $('#year');
	const methodEl = $('#method');
	const passwordEl = $('#password');
	const hashIconEl = $('#hash-icon');
	const btnEye = $('#btn-eye');
	const btnCopy = $('#btn-copy');
	const btnDice = $('#btn-dice');
	const btnCopyBash = $('#btn-copy-bash');
	const bashFormulaEl = $('.bash-formula');
	const bashCodeEl = $('#bash-code');
const copyFeedbackEl = $('#copy-feedback');

	// --- State ---
	let clearTimer = null;
	let worker = null;
	let debounceTimer = null;
	let hashAnimationId = null;

	// --- Hash animation (visual noise during generation) ---
	const ALPHABET_BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
	const ALPHABET_BASE64URL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
	const ALPHABET_ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

	function randomString(alphabet, len) {
		const buf = new Uint8Array(len);
		crypto.getRandomValues(buf);
		let result = '';
		for (let i = 0; i < len; i++) {
			result += alphabet[buf[i] % alphabet.length];
		}
		return result;
	}

	function startHashAnimation(method) {
		stopHashAnimation();
		const alphabet = (method === 'legacy' || method === 'pbkdf2-58') ? ALPHABET_BASE58
			: method === 'hmac-clean' ? ALPHABET_ALNUM : ALPHABET_BASE64URL;
		const step = () => {
			passwordEl.value = randomString(alphabet, PASSWORD_LENGTH);
			hashAnimationId = requestAnimationFrame(step);
		};
		hashAnimationId = requestAnimationFrame(step);
	}

	function stopHashAnimation() {
		if (hashAnimationId !== null) {
			cancelAnimationFrame(hashAnimationId);
			hashAnimationId = null;
		}
	}

	// --- Utility: ArrayBuffer → Base64url ---
	function arrayBufferToBase64url(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary)
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
	}

	// --- Utility: ArrayBuffer → Base64 clean (A-Za-z0-9 only) ---
	function arrayBufferToBase64clean(buffer) {
		const bytes = new Uint8Array(buffer);
		let binary = '';
		for (let i = 0; i < bytes.length; i++) {
			binary += String.fromCharCode(bytes[i]);
		}
		return btoa(binary).replace(/[+/=]/g, '');
	}

	// --- Utility: ArrayBuffer → Base58 ---
	function arrayBufferToBase58(buffer) {
		const bytes = new Uint8Array(buffer);
		return Base58.encode(Array.from(bytes));
	}

	// --- Utility: hex → ASCII (for legacy) ---
	function hexToAscii(s) {
		const hex = s.toString();
		let str = '';
		for (let n = 0; n < hex.length; n += 2) {
			str += String.fromCharCode(parseInt(hex.substring(n, n + 2), 16));
		}
		return str;
	}

	// --- Utility: Base58 encode (for legacy) ---
	function base58Encode(text) {
		const bytes = [];
		for (let i = 0; i < text.length; i++) {
			bytes.push(text[i].charCodeAt(0));
		}
		return Base58.encode(bytes);
	}

	// --- Utility: text encoder ---
	const encoder = new TextEncoder();

	// --- Generation methods ---

	// Legacy (v1): Web Worker, 100k SHA-256 iterations
	function generateLegacy(master, service, year) {
		return new Promise((resolve, reject) => {
			if (worker) worker.terminate();
			worker = new Worker('worker.js');
			const keys = master + service + year + LEGACY_SALT;
			worker.postMessage(keys);
			worker.onmessage = function (e) {
				const pass = base58Encode(hexToAscii(e.data));
				resolve(pass.substring(0, PASSWORD_LENGTH));
			};
			worker.onerror = function (err) {
				reject(new Error('Worker error: ' + err.message));
			};
		});
	}

	// HMAC: crypto.subtle, instant
	async function generateHMAC(master, service, year) {
		const keyData = encoder.encode(master);
		const msgData = encoder.encode(service + ':' + year);
		const key = await crypto.subtle.importKey(
			'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
		);
		const sig = await crypto.subtle.sign('HMAC', key, msgData);
		return arrayBufferToBase64url(sig).substring(0, PASSWORD_LENGTH);
	}

	// HMAC-clean: HMAC-SHA256, base64 without special chars
	async function generateHMACclean(master, service, year) {
		const keyData = encoder.encode(master);
		const msgData = encoder.encode(service + ':' + year);
		const key = await crypto.subtle.importKey(
			'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
		);
		const sig = await crypto.subtle.sign('HMAC', key, msgData);
		return arrayBufferToBase64clean(sig).substring(0, PASSWORD_LENGTH);
	}

	// PBKDF2: crypto.subtle, 1M iterations
	async function generatePBKDF2(master, service, year) {
		const keyMaterial = await crypto.subtle.importKey(
			'raw', encoder.encode(master), 'PBKDF2', false, ['deriveBits']
		);
		const salt = encoder.encode(PBKDF2_SALT_PREFIX + service + ':' + year);
		const bits = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
			keyMaterial, 256
		);
		return arrayBufferToBase64url(bits).substring(0, PASSWORD_LENGTH);
	}

	// PBKDF2-58: same as PBKDF2 but base58 output
	async function generatePBKDF2_58(master, service, year) {
		const keyMaterial = await crypto.subtle.importKey(
			'raw', encoder.encode(master), 'PBKDF2', false, ['deriveBits']
		);
		const salt = encoder.encode(PBKDF2_SALT_PREFIX + service + ':' + year);
		const bits = await crypto.subtle.deriveBits(
			{ name: 'PBKDF2', salt: salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
			keyMaterial, 256
		);
		return arrayBufferToBase58(bits).substring(0, PASSWORD_LENGTH);
	}

	// --- Identicon ---
	function updateIdenticon(master) {
		if (!master) {
			hashIconEl.style.display = 'none';
			return;
		}
		const options = {
			size: 16,
			margin: 0,
			foreground: [16, 40, 48, 255],
			background: [0, 0, 0, 0],
			saturation: 0.5,
			format: 'svg'
		};
		const data = new Identicon(sha256(master), options).toString();
		hashIconEl.src = 'data:image/svg+xml;base64,' + data;
		hashIconEl.style.display = 'block';
	}

	// --- Background gradient fingerprint (crossfade) ---
	const bgA = $('#bg-a');
	const bgB = $('#bg-b');
	let bgCurrent = 'a'; // which layer is visible

	function buildGradient(hash) {
		const h1 = parseInt(hash.substring(0, 3), 16) % 360;
		const h2 = parseInt(hash.substring(3, 6), 16) % 360;
		const h3 = parseInt(hash.substring(6, 9), 16) % 360;
		const x1 = parseInt(hash.substring(9, 11), 16) % 80 + 10;
		const y1 = parseInt(hash.substring(11, 13), 16) % 80 + 10;
		const x2 = parseInt(hash.substring(13, 15), 16) % 80 + 10;
		const y2 = parseInt(hash.substring(15, 17), 16) % 80 + 10;
		return `radial-gradient(ellipse at ${x1}% ${y1}%, hsla(${h1}, 80%, 65%, 0.5) 0%, transparent 55%),
			radial-gradient(ellipse at ${x2}% ${y2}%, hsla(${h2}, 70%, 60%, 0.4) 0%, transparent 50%),
			linear-gradient(${h3}deg, hsla(${h1}, 50%, 85%, 1), hsla(${h2}, 45%, 80%, 1))`;
	}

	function updateBackground(master) {
		const next = bgCurrent === 'a' ? bgB : bgA;
		const prev = bgCurrent === 'a' ? bgA : bgB;
		if (!master) {
			next.style.background = 'radial-gradient(ellipse at 30% 40%, rgba(135,206,235,0.6) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(173,216,230,0.5) 0%, transparent 55%), #b8d4e3';
		} else {
			next.style.background = buildGradient(sha256(master));
		}
		next.style.opacity = '1';
		prev.style.opacity = '0';
		bgCurrent = bgCurrent === 'a' ? 'b' : 'a';
	}

	// --- Year selector ---
	const LEGACY_CUTOFF = 2025; // legacy available for years <= this

	function initYearSelector() {
		const currentYear = new Date().getFullYear();
		yearEl.innerHTML = '';
		for (let y = 2018; y <= currentYear; y++) {
			const opt = document.createElement('option');
			opt.value = y;
			opt.textContent = y;
			if (y === currentYear) opt.selected = true;
			yearEl.appendChild(opt);
		}
		updateMethodForYear();
	}

	function updateMethodForYear() {
		const year = parseInt(yearEl.value, 10);
		const legacyOpt = methodEl.querySelector('option[value="legacy"]');
		if (year <= LEGACY_CUTOFF) {
			// Show legacy and auto-select it
			if (!legacyOpt) {
				const opt = document.createElement('option');
				opt.value = 'legacy';
				opt.textContent = 'Legacy (v1)';
				methodEl.appendChild(opt);
			}
			methodEl.value = 'legacy';
		} else {
			// Remove legacy option
			if (legacyOpt) legacyOpt.remove();
			if (methodEl.value === 'legacy') methodEl.value = 'pbkdf2-58';
		}
	}

	// --- Bash formula ---
	function updateBashFormula(method, service, year) {
		if (method === 'hmac' && service) {
			const cmd = ` echo -n "${service}:${year}" | openssl dgst -sha256 -hmac "YOUR_MASTER" -binary | base64 | tr '+/' '-_' | head -c ${PASSWORD_LENGTH}`;
			bashCodeEl.textContent = cmd;
			bashFormulaEl.classList.add('visible');
		} else if (method === 'hmac-clean' && service) {
			const cmd = ` echo -n "${service}:${year}" | openssl dgst -sha256 -hmac "YOUR_MASTER" -binary | base64 | tr -d '+/=\\n' | head -c ${PASSWORD_LENGTH}`;
			bashCodeEl.textContent = cmd;
			bashFormulaEl.classList.add('visible');
		} else {
			bashFormulaEl.classList.remove('visible');
		}
	}

	// --- Generate password ---
	async function generate() {
		const master = masterEl.value;
		const service = serviceEl.value;
		const year = yearEl.value;
		const method = methodEl.value;

		updateIdenticon(master);
		updateBackground(master);
		updateBashFormula(method, service, year);

		if (!master || !service) {
			stopHashAnimation();
				passwordEl.value = '';
			return;
		}

		try {
			let pass;
			if (method === 'legacy') {
				pass = await generateLegacy(master, service, year);
			} else if (method === 'hmac') {
				pass = await generateHMAC(master, service, year);
			} else if (method === 'hmac-clean') {
				pass = await generateHMACclean(master, service, year);
			} else if (method === 'pbkdf2-58') {
				pass = await generatePBKDF2_58(master, service, year);
			} else {
				pass = await generatePBKDF2(master, service, year);
			}
			stopHashAnimation();
				passwordEl.value = pass;
		} catch (err) {
			console.error('Generation error:', err);
			stopHashAnimation();
				passwordEl.value = '';
		}
	}

	// --- Clear all sensitive data ---
	function purgeInput(el) {
		// Replace element to kill undo history
		const fresh = el.cloneNode(false);
		el.parentNode.replaceChild(fresh, el);
		return fresh;
	}

	function clearAll() {
		const lastPassword = passwordEl.value;
		masterEl = purgeInput(masterEl);
		serviceEl = purgeInput(serviceEl);
		passwordEl.value = '';
		hashIconEl.style.display = 'none';
		// Clear clipboard only if it still contains the generated password
		if (lastPassword) {
			navigator.clipboard.readText().then(clip => {
				if (clip === lastPassword) navigator.clipboard.writeText('');
			}).catch(() => {});
		}
		bashFormulaEl.classList.remove('visible');
		stopHashAnimation();
		if (worker) { worker.terminate(); worker = null; }
		if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null; }
		// Re-bind events on fresh elements
		masterEl.addEventListener('input', onInputChange);
		serviceEl.addEventListener('input', onInputChange);
	}

	// --- Debounced input handler ---
	function onInputChange() {
		// Reset clear timer
		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = setTimeout(clearAll, CLEAR_TIMEOUT * 1000);

		const method = methodEl.value;

		// Start animation and show generating indicator
		if (masterEl.value && serviceEl.value) {
			startHashAnimation(method);
		} else {
			stopHashAnimation();
			passwordEl.value = '';
		}
		btnDice.style.display = (!masterEl.value && !serviceEl.value) ? '' : 'none';

		// Debounce the actual crypto — longer for legacy (heavy worker)
		if (debounceTimer) clearTimeout(debounceTimer);
		const delay = method === 'legacy' ? 300 : 50;
		debounceTimer = setTimeout(generate, delay);
	}

	// --- Copy to clipboard ---
	async function copyText(text) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
			showCopyFeedback();
		} catch {
			// Fallback for non-HTTPS
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
			showCopyFeedback();
		}
	}

	function showCopyFeedback(text) {
		copyFeedbackEl.textContent = text || 'Copied';
		copyFeedbackEl.classList.add('show');
		setTimeout(() => copyFeedbackEl.classList.remove('show'), 1200);
	}

	// --- Random password ---
	function generateRandom() {
		const buf = new Uint8Array(PASSWORD_LENGTH);
		crypto.getRandomValues(buf);
		let pass = '';
		for (let i = 0; i < PASSWORD_LENGTH; i++) {
			pass += ALPHABET_ALNUM[buf[i] % ALPHABET_ALNUM.length];
		}
		startHashAnimation('hmac-clean');
		setTimeout(() => {
			stopHashAnimation();
			passwordEl.value = pass;
			copyText(pass);
		}, 300);
	}

	// --- Eye toggle (master password) ---
	let masterVisible = false;
	function toggleMasterVisibility() {
		masterVisible = !masterVisible;
		masterEl.type = masterVisible ? 'text' : 'password';
		btnEye.innerHTML = masterVisible ? SVG_EYE_OFF : SVG_EYE;
	}

	// --- SVG Icons ---
	const SVG_EYE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
	const SVG_EYE_OFF = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
	const SVG_COPY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
	const SVG_LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>';
	const SVG_SIGNAL = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="1" y="14" width="4" height="8" rx="1"/><rect x="7" y="10" width="4" height="12" rx="1"/><rect x="13" y="6" width="4" height="16" rx="1"/><rect x="19" y="2" width="4" height="20" rx="1"/></svg>';
	const SVG_BATTERY = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="6" width="18" height="12" rx="2"/><line x1="23" y1="10" x2="23" y2="14"/><rect x="3" y="8" width="4" height="8" fill="currentColor" rx="0.5"/><rect x="8" y="8" width="4" height="8" fill="currentColor" rx="0.5"/><rect x="13" y="8" width="4" height="8" fill="currentColor" rx="0.5"/></svg>';
	const SVG_DICE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="8.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/><circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none"/></svg>';

	// --- Init ---
	function init() {
		initYearSelector();

		// Set SVG icons
		btnEye.innerHTML = SVG_EYE;
		btnCopy.innerHTML = SVG_COPY;
		btnDice.innerHTML = SVG_DICE;
		btnCopyBash.innerHTML = SVG_COPY;

		// Status bar icons
		const statusBar = $('#status-bar');
		statusBar.querySelector('.icon-signal').innerHTML = SVG_SIGNAL;
		statusBar.querySelector('.icon-lock').innerHTML = SVG_LOCK;
		statusBar.querySelector('.icon-battery').innerHTML = SVG_BATTERY;

		// Event listeners
		masterEl.addEventListener('input', onInputChange);
		serviceEl.addEventListener('input', onInputChange);
		yearEl.addEventListener('change', () => { updateMethodForYear(); onInputChange(); });
		methodEl.addEventListener('change', onInputChange);

		btnEye.addEventListener('click', toggleMasterVisibility);
		btnDice.addEventListener('click', generateRandom);
		btnCopy.addEventListener('click', () => copyText(passwordEl.value));
		btnCopyBash.addEventListener('click', () => copyText(bashCodeEl.textContent));

		// Select password on click
		passwordEl.addEventListener('click', function () {
			this.select();
		});

		// Clear clipboard on background click
		document.body.addEventListener('click', (e) => {
			if (e.target === document.body || e.target.classList.contains('bg-layer')) {
				navigator.clipboard.writeText('').then(() => showCopyFeedback('Clipboard cleared'));
			}
		});

		// Clear on tab hide (switched away or screen locked)
		document.addEventListener('visibilitychange', () => {
			if (document.hidden) clearAll();
		});

		// Initial clear timer
		clearTimer = setTimeout(clearAll, CLEAR_TIMEOUT * 1000);
	}

	init();
})();
