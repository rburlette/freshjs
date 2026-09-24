// Evaluate from a real page script: DevTools page.evaluate can bypass eval CSP.
window.cspBlocksEval = (() => {try {new Function('return 1');return false;} catch {return true;}})();
