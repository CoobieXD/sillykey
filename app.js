(function () {
	'use strict';
	const PASSWORD_LENGTH = 24;
	const CLEAR_TIMEOUT = 300;
	const LEGACY_SALT = 'why not?';

	const $ = (sel) => document.querySelector(sel);
	let masterEl = $('#master');
	let serviceEl = $('#service');
	const yearEl = $('#year');
	const passwordEl = $('#password');
	const hashIconEl = $('#hash_icon');
	const btnCopy = $('#btn-copy');
	let clearTimer = null;
	let worker = null;

	function hex2ascii(s) {
		const hex = s.toString();
		let str = '';
		for (let n = 0; n < hex.length; n += 2) {
			str += String.fromCharCode(parseInt(hex.substr(n, 2), 16));
		}
		return str;
	}

	function base58_encode(text) {
		const bytes = [];
		for (let i = 0; i < text.length; i++) {
			bytes.push(text[i].charCodeAt(0));
		}
		return Base58.encode(bytes);
	}

	function generateLegacy(master, service, year) {
		return new Promise((resolve) => {
			if (worker) worker.terminate();
			worker = new Worker('worker.js');
			const keys = master + service + year + LEGACY_SALT;
			worker.postMessage(keys);
			worker.onmessage = function (e) {
				const pass = base58_encode(hex2ascii(e.data));
				resolve(pass.substr(0, PASSWORD_LENGTH));
			};
		});
	}

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

	const bgA = $('#bg-a');
	const bgB = $('#bg-b');
	let bgCurrent = 'a';

	function buildGradient(hash) {
		const h1 = parseInt(hash.substr(0, 3), 16) % 360;
		const h2 = parseInt(hash.substr(3, 3), 16) % 360;
		const h3 = parseInt(hash.substr(6, 3), 16) % 360;
		const x1 = parseInt(hash.substr(9, 2), 16) % 80 + 10;
		const y1 = parseInt(hash.substr(11, 2), 16) % 80 + 10;
		const x2 = parseInt(hash.substr(13, 2), 16) % 80 + 10;
		const y2 = parseInt(hash.substr(15, 2), 16) % 80 + 10;
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

	async function copyText(text) {
		if (!text) return;
		try {
			await navigator.clipboard.writeText(text);
		} catch {
			const ta = document.createElement('textarea');
			ta.value = text;
			ta.style.position = 'fixed';
			ta.style.opacity = '0';
			document.body.appendChild(ta);
			ta.select();
			document.execCommand('copy');
			document.body.removeChild(ta);
		}
	}

	function initYearSelector() {
		const currentYear = new Date().getFullYear();
		for (let y = 2018; y <= currentYear; y++) {
			const opt = document.createElement('option');
			opt.value = y;
			opt.textContent = y;
			if (y === currentYear) opt.selected = true;
			yearEl.appendChild(opt);
		}
	}

	function purgeInput(el) {
		const fresh = el.cloneNode(false);
		el.parentNode.replaceChild(fresh, el);
		return fresh;
	}

	function clearAll() {
		masterEl = purgeInput(masterEl);
		serviceEl = purgeInput(serviceEl);
		passwordEl.value = '';
		hashIconEl.style.display = 'none';
		if (worker) { worker.terminate(); worker = null; }
		masterEl.addEventListener('input', generate);
		serviceEl.addEventListener('input', generate);
	}

	async function generate() {
		if (clearTimer) clearTimeout(clearTimer);
		clearTimer = setTimeout(clearAll, CLEAR_TIMEOUT * 1000);

		const master = masterEl.value;
		const service = serviceEl.value;
		const year = yearEl.value;
		updateIdenticon(master);
		updateBackground(master);
		if (!master || !service) { passwordEl.value = ''; return; }
		try {
			const pass = await generateLegacy(master, service, year);
			passwordEl.value = pass;
		} catch (err) {
			console.error('Generation error:', err);
			passwordEl.value = '';
		}
	}

	function init() {
		initYearSelector();
		masterEl.addEventListener('input', generate);
		serviceEl.addEventListener('input', generate);
		yearEl.addEventListener('change', generate);
		btnCopy.addEventListener('click', () => copyText(passwordEl.value));

		document.addEventListener('visibilitychange', () => {
			if (document.hidden) clearAll();
		});

		clearTimer = setTimeout(clearAll, CLEAR_TIMEOUT * 1000);
	}
	init();
})();
