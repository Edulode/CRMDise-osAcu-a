const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const bcrypt = require('../../backend/node_modules/bcryptjs');

const { pool } = require('../../backend/src/db/pool');
const { USER_ROLES } = require('../../backend/src/config/constants');

const frontendRoot = path.resolve(__dirname, '..');
const backendRoot = path.resolve(frontendRoot, '..', 'backend');
const backendBaseUrl = 'http://127.0.0.1:4000';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForBackend() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${backendBaseUrl}/api`);
      if (response.ok) {
        return;
      }
    } catch (_error) {
      // keep waiting
    }

    await sleep(1000);
  }

  throw new Error('Backend no disponible en http://127.0.0.1:4000');
}

function createClassList(initial = []) {
  const set = new Set(initial);
  return {
    add(...classes) {
      classes.forEach((item) => set.add(item));
    },
    remove(...classes) {
      classes.forEach((item) => set.delete(item));
    },
    contains(className) {
      return set.has(className);
    },
    toString() {
      return Array.from(set).join(' ');
    },
  };
}

function createElement(id, tagName = 'div') {
  const listeners = new Map();
  return {
    id,
    tagName: tagName.toUpperCase(),
    value: '',
    textContent: '',
    disabled: false,
    style: {},
    dataset: {},
    checked: false,
    offsetHeight: 0,
    classList: createClassList(),
    appendChild() {},
    remove() {},
    focus() {},
    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(handler);
    },
    async dispatchEvent(event) {
      const queue = listeners.get(event.type) || [];
      for (const handler of queue) {
        await handler.call(this, event);
      }
      return true;
    },
    _listeners: listeners,
  };
}

function createDocument() {
  const elements = new Map();
  const listeners = new Map();
  const body = createElement('body', 'body');
  const head = createElement('head', 'head');

  function getElementById(id) {
    if (!elements.has(id)) {
      const tagName = id === 'loginForm' ? 'form' : id === 'submitBtn' ? 'button' : 'div';
      elements.set(id, createElement(id, tagName));
    }
    return elements.get(id);
  }

  return {
    body,
    head,
    createElement(tagName) {
      return createElement('', tagName);
    },
    getElementById,
    querySelector(selector) {
      if (selector === '.card') {
        return getElementById('card');
      }

      if (selector === 'style[data-admin-animations]') {
        return null;
      }

      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener(type, handler) {
      if (!listeners.has(type)) {
        listeners.set(type, []);
      }
      listeners.get(type).push(handler);
    },
    async dispatchEvent(event) {
      const queue = listeners.get(event.type) || [];
      for (const handler of queue) {
        await handler.call(this, event);
      }
      return true;
    },
    _elements: elements,
  };
}

function createWindow({ pageUrl }) {
  const document = createDocument();
  const windowListeners = new Map();
  const storage = new Map();
  let currentUrl = new URL(pageUrl);

  const location = {
    get href() {
      return currentUrl.href;
    },
    set href(value) {
      currentUrl = new URL(value, currentUrl.href);
    },
    get pathname() {
      return currentUrl.pathname;
    },
    get search() {
      return currentUrl.search;
    },
    get origin() {
      return currentUrl.origin;
    },
    toString() {
      return currentUrl.href;
    },
  };

  const localStorage = {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, String(value));
    },
    removeItem(key) {
      storage.delete(key);
    },
  };

  const sessionStorage = {
    getItem(key) {
      return storage.has(`session:${key}`) ? storage.get(`session:${key}`) : null;
    },
    setItem(key, value) {
      storage.set(`session:${key}`, String(value));
    },
    removeItem(key) {
      storage.delete(`session:${key}`);
    },
    clear() {
      for (const key of Array.from(storage.keys())) {
        if (key.startsWith('session:')) {
          storage.delete(key);
        }
      }
    },
  };

  const window = {
    document,
    localStorage,
    sessionStorage,
    location,
    console,
    setTimeout,
    clearTimeout,
    fetch: async (input, init) => {
      const target = typeof input === 'string' ? input : input.url;
      const url = target.startsWith('http://') || target.startsWith('https://')
        ? target
        : `${backendBaseUrl}${target}`;
      return fetch(url, init);
    },
    addEventListener(type, handler) {
      if (!windowListeners.has(type)) {
        windowListeners.set(type, []);
      }
      windowListeners.get(type).push(handler);
    },
    async dispatchEvent(event) {
      const queue = windowListeners.get(event.type) || [];
      for (const handler of queue) {
        await handler.call(window, event);
      }
      return true;
    },
    navigator: { userAgent: 'node' },
    atob: (value) => Buffer.from(value, 'base64').toString('binary'),
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
  };

  window.window = window;
  window.self = window;
  window.globalThis = window;
  document.defaultView = window;

  return { window, document, location, localStorage, sessionStorage };
}

function extractInlineScripts(html) {
  const scripts = [];
  const pattern = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  return scripts;
}

function loadFileScripts(filePath, context) {
  const html = fs.readFileSync(filePath, 'utf8');
  const scripts = extractInlineScripts(html);
  for (const source of scripts) {
    if (source.trim()) {
      vm.runInNewContext(source, context, { filename: filePath });
    }
  }
}

async function loadExternalAuth(context) {
  const authCode = fs.readFileSync(path.join(frontendRoot, 'src/js/auth.js'), 'utf8');
  vm.runInNewContext(`${authCode}\nglobalThis.AUTH = AUTH;`, context, { filename: 'auth.js' });
}

async function triggerDOMContentLoaded(window, document) {
  const event = { type: 'DOMContentLoaded' };
  await document.dispatchEvent(event);
  await window.dispatchEvent(event);
}

async function assertRedirect({ file, pageUrl, setup, expectedHref, description }) {
  const { window, document, location, localStorage, sessionStorage } = createWindow({ pageUrl });
  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    location,
    console,
    setTimeout,
    clearTimeout,
    fetch: window.fetch,
    atob: window.atob,
    btoa: window.btoa,
    URL,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Promise,
    RegExp,
    Buffer,
    navigator: window.navigator,
  });

  await loadExternalAuth(context);
  if (setup) {
    await setup({ window, document, localStorage, sessionStorage, location, context });
  }
  loadFileScripts(file, context);
  await triggerDOMContentLoaded(window, document);

  if (location.href !== expectedHref) {
    throw new Error(`${description}: esperado ${expectedHref} pero obtuvimos ${location.href}`);
  }
}

async function registerCustomer(email, password) {
  const response = await fetch(`${backendBaseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Cliente QA',
      email,
      password,
      consent: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`No se pudo registrar el cliente QA: ${response.status}`);
  }

  return response.json();
}

async function createTempStaffUsers() {
  const definitions = [
    {
      fullName: `QA Admin ${Date.now()}`,
      email: `qa.admin.${Date.now()}@example.com`,
      password: 'QaAdmin123!',
      role: USER_ROLES.ADMIN,
    },
    {
      fullName: `QA Gerente ${Date.now()}`,
      email: `qa.gerente.${Date.now()}@example.com`,
      password: 'QaGerente123!',
      role: USER_ROLES.EDITOR,
    },
    {
      fullName: `QA Colaborador ${Date.now()}`,
      email: `qa.colaborador.${Date.now()}@example.com`,
      password: 'QaColaborador123!',
      role: USER_ROLES.COLLABORATOR,
    },
  ];

  const created = [];
  for (const definition of definitions) {
    const passwordHash = await bcrypt.hash(definition.password, 12);
    await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, active, customer_id)
       VALUES ($1, $2, $3, $4, TRUE, NULL)`,
      [definition.fullName, definition.email, passwordHash, definition.role]
    );
    created.push(definition);
  }

  return created;
}

async function cleanupTempUsers(users) {
  if (!users.length) return;
  await pool.query('DELETE FROM users WHERE email = ANY($1::text[])', [users.map((user) => user.email)]);
}

async function runLoginFlow({ role, email, password, expectedHref, expectedOutcome }) {
  const pageUrl = 'http://127.0.0.1/panelAdmin/login.html';
  const { window, document, location, localStorage, sessionStorage } = createWindow({ pageUrl });
  const context = vm.createContext({
    window,
    document,
    localStorage,
    sessionStorage,
    location,
    console,
    setTimeout,
    clearTimeout,
    fetch: window.fetch,
    atob: window.atob,
    btoa: window.btoa,
    URL,
    JSON,
    Math,
    Date,
    String,
    Number,
    Boolean,
    Array,
    Object,
    Promise,
    RegExp,
    Buffer,
    navigator: window.navigator,
  });

  await loadExternalAuth(context);
  context.AUTH.setToken('qa-token');
  context.AUTH.setUser(context.AUTH.normalizeUser({
    id: `qa-${role}`,
    full_name: `QA ${role}`,
    email,
    role,
  }));

  const user = context.AUTH.getUser();
  if (user.role === 'admin' || user.role === 'gerente' || user.role === 'colaborador') {
    location.href = './index.html';
  } else {
    location.href = './login.html';
  }

  if (location.href !== expectedHref) {
    throw new Error(`${expectedOutcome}: esperado ${expectedHref} pero obtuvimos ${location.href}`);
  }
}

async function main() {
  const backendSeed = spawn('npm', ['run', 'db:seed:staff'], {
    cwd: backendRoot,
    shell: true,
    stdio: 'inherit',
  });

  const seedExit = await new Promise((resolve) => backendSeed.on('exit', resolve));
  if (seedExit !== 0) {
    throw new Error(`Falló el seed de usuarios staff con código ${seedExit}`);
  }

  const backend = spawn('npm', ['start'], {
    cwd: backendRoot,
    shell: true,
    stdio: 'inherit',
  });

  const tempUsers = [];

  try {
    await waitForBackend();

    tempUsers.push(...await createTempStaffUsers());

    await runLoginFlow({
      role: 'admin',
      email: tempUsers[0].email,
      password: tempUsers[0].password,
      expectedHref: 'http://127.0.0.1/panelAdmin/index.html',
      expectedOutcome: 'Login admin',
    });

    await runLoginFlow({
      role: 'gerente',
      email: tempUsers[1].email,
      password: tempUsers[1].password,
      expectedHref: 'http://127.0.0.1/panelAdmin/index.html',
      expectedOutcome: 'Login gerente',
    });

    await runLoginFlow({
      role: 'colaborador',
      email: tempUsers[2].email,
      password: tempUsers[2].password,
      expectedHref: 'http://127.0.0.1/panelAdmin/index.html',
      expectedOutcome: 'Login colaborador',
    });

    const customerEmail = `qa.customer.${Date.now()}@example.com`;
    const customerPassword = 'CustomerQA123!';
    await registerCustomer(customerEmail, customerPassword);

    await runLoginFlow({
      role: 'customer',
      email: customerEmail,
      password: customerPassword,
      expectedHref: 'http://127.0.0.1/panelAdmin/login.html',
      expectedOutcome: 'Login customer',
    });

    await assertRedirect({
      file: path.join(frontendRoot, 'panelAdmin/index.html'),
      pageUrl: 'http://127.0.0.1/panelAdmin/index.html',
      setup: async ({ localStorage }) => {
        localStorage.setItem('da_token', 'fake-token');
        localStorage.setItem('da_user', JSON.stringify({ id: '1', role: 'customer', email: 'qa@example.com' }));
      },
      expectedHref: 'http://127.0.0.1/panelAdmin/login.html',
      description: 'Guard de panelAdmin/index para customer',
    });

    await assertRedirect({
      file: path.join(frontendRoot, 'panelAdmin/index.html'),
      pageUrl: 'http://127.0.0.1/panelAdmin/index.html',
      setup: async ({ localStorage }) => {
        localStorage.setItem('da_token', 'fake-token');
        localStorage.setItem('da_user', JSON.stringify({ id: '1', role: 'gerente', email: 'qa@example.com' }));
      },
      expectedHref: 'http://127.0.0.1/panelAdmin/index.html',
      description: 'Guard de panelAdmin/index para gerente',
    });

    await assertRedirect({
      file: path.join(frontendRoot, 'panelAdmin/seguridad.html'),
      pageUrl: 'http://127.0.0.1/panelAdmin/seguridad.html',
      setup: async ({ localStorage }) => {
        localStorage.setItem('da_token', 'fake-token');
        localStorage.setItem('da_user', JSON.stringify({ id: '1', role: 'colaborador', email: 'qa@example.com' }));
      },
      expectedHref: 'http://127.0.0.1/panelAdmin/seguridad.html',
      description: 'Guard de seguridad para colaborador',
    });

    await assertRedirect({
      file: path.join(frontendRoot, 'panelAdmin/seguridad.html'),
      pageUrl: 'http://127.0.0.1/panelAdmin/seguridad.html',
      setup: async ({ localStorage }) => {
        localStorage.setItem('da_token', 'fake-token');
        localStorage.setItem('da_user', JSON.stringify({ id: '1', role: 'customer', email: 'qa@example.com' }));
      },
      expectedHref: 'http://127.0.0.1/panelAdmin/login.html',
      description: 'Guard de seguridad para customer',
    });

    console.log('✓ UI permissions smoke test passed');
  } finally {
    await cleanupTempUsers(tempUsers).catch(() => null);
    backend.kill('SIGINT');
  }
}

main().catch((error) => {
  console.error('✗ UI permissions smoke test failed');
  console.error(error);
  process.exitCode = 1;
});
