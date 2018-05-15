(function () {
	'use strict';
	const $ = (sel) => document.querySelector(sel);
	const masterEl = $('#master');
	const serviceEl = $('#service');
	const passwordEl = $('#password');
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

	function generateLegacy(master, service) {
		return new Promise((resolve) => {
			if (worker) worker.terminate();
			worker = new Worker('worker.js');
			const keys = master + service + 'why not?';
			worker.postMessage(keys);
			worker.onmessage = function (e) {
				const pass = base58_encode(hex2ascii(e.data));
				resolve(pass.substr(0, 24));
			};
		});
	}

	async function generate() {
		const master = masterEl.value;
		const service = serviceEl.value;
		if (!master || !service) { passwordEl.value = ''; return; }
		const pass = await generateLegacy(master, service);
		passwordEl.value = pass;
	}

	function init() {
		masterEl.addEventListener('input', generate);
		serviceEl.addEventListener('input', generate);
	}
	init();
})();
