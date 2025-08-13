import { JSDOM } from 'jsdom';
import { cleanup } from '@testing-library/react';

// Set up DOM environment with more comprehensive configuration
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
	url: 'http://localhost',
	pretendToBeVisual: true,
	resources: 'usable',
	runScripts: 'dangerously',
	includeNodeLocations: true,
});

// Set up globals in correct order
global.window = dom.window;
global.document = dom.window.document;

// Handle navigator separately since it might be read-only
if (typeof global.navigator === 'undefined') {
  try {
    global.navigator = dom.window.navigator;
  } catch (error) {
    // Ignore if navigator is read-only
  }
}

// Add important DOM globals that React needs
const importantGlobals = [
	'HTMLElement',
	'HTMLInputElement', 
	'HTMLButtonElement',
	'HTMLDivElement',
	'Event',
	'CustomEvent',
	'MouseEvent',
	'KeyboardEvent',
	'requestAnimationFrame',
	'cancelAnimationFrame',
	'getComputedStyle',
	'MutationObserver',
	'ResizeObserver'
];

importantGlobals.forEach(property => {
	if (dom.window[property] && typeof global[property] === 'undefined') {
		try {
			global[property] = dom.window[property];
		} catch (error) {
			// Ignore read-only properties
		}
	}
});

// Add remaining window properties
Object.keys(dom.window).forEach(property => {
	if (typeof global[property] === 'undefined') {
		try {
			global[property] = dom.window[property];
		} catch (error) {
			// Ignore read-only properties
		}
	}
});

// Add requestAnimationFrame if it doesn't exist
if (!global.requestAnimationFrame) {
	global.requestAnimationFrame = (callback) => {
		return setTimeout(callback, 16);
	};
	global.cancelAnimationFrame = (id) => {
		clearTimeout(id);
	};
}

// React 18+ specific fixes
if (!global.IS_REACT_ACT_ENVIRONMENT) {
	global.IS_REACT_ACT_ENVIRONMENT = true;
}

// Add TextEncoder/TextDecoder if they don't exist
if (!global.TextEncoder) {
	const { TextEncoder, TextDecoder } = require('util');
	global.TextEncoder = TextEncoder;
	global.TextDecoder = TextDecoder;
}

// Export cleanup for manual use in tests
export { cleanup };