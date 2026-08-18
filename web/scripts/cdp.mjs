/* A minimal Chrome DevTools Protocol client.
 *
 * Shared by shoot.mjs (screenshots) and verify-seam.mjs (the backend-off proof), so we
 * drive a real browser without taking on Puppeteer. Node's built-in WebSocket is all it
 * needs — this file has no dependencies at all.
 */
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';

export const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/** Launch headless Chrome with a throwaway profile. Returns the child process. */
export function launchChrome({ port, profile }) {
  rmSync(profile, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ]);
  chrome.on('error', (error) => {
    console.error('could not start Chrome:', error.message);
    process.exit(1);
  });
  return chrome;
}

/** Poll the DevTools endpoint until a page target appears. */
export async function pageTarget(port, attempts = 60) {
  for (let i = 0; i < attempts; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page;
    } catch {
      /* not up yet */
    }
    await wait(100);
  }
  throw new Error('Chrome DevTools endpoint never came up');
}

/** Connect to a target. `send` returns the result; `on` subscribes to protocol events. */
export async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl);
  const pending = new Map();
  const handlers = new Map();
  let nextId = 1;

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== undefined) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
      return;
    }
    for (const handler of handlers.get(message.method) ?? []) handler(message.params);
  });

  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve);
    socket.addEventListener('error', () => reject(new Error('CDP socket failed')));
  });

  return {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(method, handler) {
      if (!handlers.has(method)) handlers.set(method, []);
      handlers.get(method).push(handler);
    },
    close: () => socket.close(),
  };
}

/**
 * Evaluate an expression in the page and return its value. Rejects if the page threw,
 * so a broken check fails the script instead of quietly returning undefined.
 */
export async function evaluate(cdp, expression) {
  const result = await cdp.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? 'page threw');
  }
  return result.result.value;
}

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Wait for an HTTP endpoint to start answering. */
export async function waitForServer(url, attempts = 200) {
  for (let i = 0; i < attempts; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await wait(100);
    }
  }
  throw new Error(`server at ${url} never came up`);
}
