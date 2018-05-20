(function () {
	'use strict';
	const PASSWORD_LENGTH = 24;
	const $ = (sel) => document.querySelector(sel);
	const masterEl = $('#master');
	const serviceEl = $('#service');
	const yearEl = $('#year');
	const passwordEl = $('#password');
	const btnCopy = $('#btn-copy');
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
			const keys = master + service + year + 'why not?';
			worker.postMessage(keys);
			worker.onmessage = function (e) {
				const pass = base58_encode(hex2ascii(e.data));
				resolve(pass.substr(0, PASSWORD_LENGTH));
			};
		});
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

	async function generate() {
		const master = masterEl.value;
		const service = serviceEl.value;
		const year = yearEl.value;
		if (!master || !service) { passwordEl.value = ''; return; }
		const pass = await generateLegacy(master, service, year);
		passwordEl.value = pass;
	}

	function init() {
		initYearSelector();
		masterEl.addEventListener('input', generate);
		serviceEl.addEventListener('input', generate);
		yearEl.addEventListener('change', generate);
		btnCopy.addEventListener('click', () => copyText(passwordEl.value));
	}
	init();
})();
