(function () {
	'use strict';
	const $ = (sel) => document.querySelector(sel);
	const masterEl = $('#master');
	const serviceEl = $('#service');
	const passwordEl = $('#password');
	let worker = null;

	function generateLegacy(master, service) {
		return new Promise((resolve) => {
			if (worker) worker.terminate();
			worker = new Worker('worker.js');
			const keys = master + service + 'why not?';
			worker.postMessage(keys);
			worker.onmessage = function (e) {
				resolve(e.data.substr(0, 24));
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
