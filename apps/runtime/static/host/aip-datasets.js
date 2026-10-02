/* Sustantix AIP — dataset registry. Datasets are registered as JSON text and parsed on
   every request, so each consumer receives a fresh object graph exactly as the original
   inline literal would have produced. */
(function () {
  'use strict';
  var store = Object.create(null);
  Object.defineProperty(window, '__AIP_REG', {
    value: function (hash, jsonText) { store[hash] = jsonText; },
    writable: false, configurable: false
  });
  Object.defineProperty(window, '__AIP_DS', {
    value: function (hash) {
      var text = store[hash];
      if (typeof text !== 'string') throw new Error('AIP dataset not loaded: ' + hash);
      return JSON.parse(text);
    },
    writable: false, configurable: false
  });
})();
