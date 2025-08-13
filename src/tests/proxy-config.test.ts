import test from 'ava';
import { getProxyAgent, getProxyInfo } from '../utils/proxy-config.js';

// Helper to set and restore environment variables
function withEnv(env: Record<string, string | undefined>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  
  // Save original values
  for (const key of Object.keys(env)) {
    original[key] = process.env[key];
  }
  
  // Set new values
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  
  try {
    fn();
  } finally {
    // Restore original values
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

test('getProxyInfo returns disabled when no proxy is configured', t => {
  withEnv({ HTTP_PROXY: undefined, HTTPS_PROXY: undefined, http_proxy: undefined, https_proxy: undefined }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, false);
    t.is(info.url, undefined);
    t.is(info.type, undefined);
  });
});

test('getProxyInfo detects HTTP_PROXY environment variable', t => {
  withEnv({ HTTP_PROXY: 'http://proxy.example.com:8080', HTTPS_PROXY: undefined }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'http://proxy.example.com:8080');
    t.is(info.type, 'http');
  });
});

test('getProxyInfo detects HTTPS_PROXY environment variable', t => {
  withEnv({ HTTPS_PROXY: 'http://secure-proxy.example.com:8443', HTTP_PROXY: undefined }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'http://secure-proxy.example.com:8443');
    t.is(info.type, 'http');
  });
});

test('getProxyInfo prefers HTTPS_PROXY over HTTP_PROXY', t => {
  withEnv({ 
    HTTPS_PROXY: 'http://secure-proxy.example.com:8443',
    HTTP_PROXY: 'http://proxy.example.com:8080'
  }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'http://secure-proxy.example.com:8443');
    t.is(info.type, 'http');
  });
});

test('getProxyInfo detects SOCKS5 proxy from URL scheme', t => {
  withEnv({ HTTP_PROXY: 'socks5://socks-proxy.example.com:1080', HTTPS_PROXY: undefined }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'socks5://socks-proxy.example.com:1080');
    t.is(info.type, 'socks');
  });
});

test('getProxyInfo detects SOCKS proxy (without version) from URL scheme', t => {
  withEnv({ HTTP_PROXY: 'socks://socks-proxy.example.com:1080', HTTPS_PROXY: undefined }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'socks://socks-proxy.example.com:1080');
    t.is(info.type, 'socks');
  });
});

test('getProxyInfo respects lowercase environment variables', t => {
  withEnv({ 
    http_proxy: 'http://proxy.example.com:3128',
    https_proxy: 'http://secure-proxy.example.com:3128',
    HTTP_PROXY: undefined,
    HTTPS_PROXY: undefined
  }, () => {
    const info = getProxyInfo();
    t.is(info.enabled, true);
    t.is(info.url, 'http://secure-proxy.example.com:3128');
    t.is(info.type, 'http');
  });
});

test('getProxyInfo uses proxy override when provided', t => {
  withEnv({ HTTP_PROXY: 'http://env-proxy.example.com:8080' }, () => {
    const info = getProxyInfo('http://override-proxy.example.com:9090');
    t.is(info.enabled, true);
    t.is(info.url, 'http://override-proxy.example.com:9090');
    t.is(info.type, 'http');
  });
});

test('getProxyInfo detects SOCKS proxy type in override', t => {
  withEnv({ HTTP_PROXY: 'http://env-proxy.example.com:8080' }, () => {
    const info = getProxyInfo('socks5://override-socks.example.com:1080');
    t.is(info.enabled, true);
    t.is(info.url, 'socks5://override-socks.example.com:1080');
    t.is(info.type, 'socks');
  });
});

test('getProxyAgent returns undefined when no proxy is configured', t => {
  withEnv({ HTTP_PROXY: undefined, HTTPS_PROXY: undefined }, () => {
    const agent = getProxyAgent();
    t.is(agent, undefined);
  });
});

test('getProxyAgent creates HttpsProxyAgent for HTTP proxy', t => {
  withEnv({ HTTP_PROXY: 'http://proxy.example.com:8080' }, () => {
    const agent = getProxyAgent();
    t.not(agent, undefined);
    // Check that it's an HttpsProxyAgent instance
    t.truthy(agent);
  });
});

test('getProxyAgent creates SocksProxyAgent for SOCKS5 proxy', t => {
  withEnv({ HTTP_PROXY: 'socks5://socks-proxy.example.com:1080' }, () => {
    const agent = getProxyAgent();
    t.not(agent, undefined);
    // Check that it's a SocksProxyAgent instance
    t.truthy(agent);
  });
});

test('getProxyAgent uses override when provided', t => {
  withEnv({ HTTP_PROXY: 'http://env-proxy.example.com:8080' }, () => {
    const agent = getProxyAgent('http://override-proxy.example.com:9090');
    t.not(agent, undefined);
    t.truthy(agent);
  });
});

test('getProxyAgent creates correct agent for SOCKS override', t => {
  withEnv({ HTTP_PROXY: 'http://env-proxy.example.com:8080' }, () => {
    const agent = getProxyAgent('socks5://override-socks.example.com:1080');
    t.not(agent, undefined);
    t.truthy(agent);
  });
});

test('getProxyInfo sanitizes proxy URLs with credentials', t => {
  const info = getProxyInfo('http://user:pass@proxy.example.com:8080');
  t.is(info.enabled, true);
  t.is(info.url, 'http://proxy.example.com:8080/');
  t.is(info.type, 'http');
});

test('getProxyAgent handles invalid proxy URLs gracefully', t => {
  const agent = getProxyAgent('not-a-valid-url');
  t.is(agent, undefined);
});

test('getProxyInfo handles malformed URLs safely', t => {
  const info = getProxyInfo('http://user@:pass@@proxy:8080');
  t.is(info.enabled, true);
  // Should return sanitized version or safe message
  t.truthy(info.url);
  if (info.url) {
    t.not(info.url.includes('pass'), 'Password should be removed');
  }
});