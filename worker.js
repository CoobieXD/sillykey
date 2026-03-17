self.importScripts('sha256.min.js');
self.onmessage = function(e) {
	try {
		var hash = e.data;
		for (var i = 0; i < 100000; i++) {
			hash = sha256(hash);
		}
		self.postMessage(hash);
	} catch (err) {
		self.postMessage({ error: err.message });
	}
};
