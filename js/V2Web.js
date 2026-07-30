// Avoid null !== undefined issues.
function isNull(value) {
  return value == null;
}

// The main menu/navigation.
class V2Web {
  static setup() {
    // Always scroll to the top at page reload.
    history.scrollRestoration = 'manual';
  }

  static registerServiceWorker(worker, handler) {
    if (!('serviceWorker' in navigator))
      return;

    window.addEventListener('load', () => {
      navigator.serviceWorker.register(worker, {
        updateViaCache: 'none'
      })
        .then((registration) => {
          registration.addEventListener('updatefound', () => {
            const worker = registration.installing;
            worker.addEventListener('statechange', () => {
              handler(worker.state, registration.waiting);
            });
          });
        }, () => { });
    });
  }

  static notifyUpdate(text, handler) {
    V2Web.addElementAdjacent(document.querySelector('main'), 'afterbegin', 'section', (section) => {
      V2Web.addElement(section, 'hgroup', (hg) => {
        V2Web.addElement(hg, 'h2', (e) => {
          e.textContent = 'Update';
        });

        V2Web.addElement(hg, 'p', (e) => {
          e.textContent = text;
        });
      });

      new V2WebMenu(section, (menu) => {
        menu.addElement('button', (e) => {
          e.textContent = 'Close';
          e.addEventListener('click', () => {
            section.remove();
          });
        });

        menu.addElement('button', (e) => {
          e.classList.add('primary');
          e.textContent = 'Reload';
          e.addEventListener('click', () => {
            handler();
          });
        });
      });
    });
  }

  static addNavigationSection(id, icon, title, target) {
    this.addElement(document.querySelector('nav details ul'), 'li', (li) => {
      li.id = 'nav-' + id;

      this.addElement(li, 'a', (e) => {
        e.href = target;

        if (icon)
          V2Web.addElement(e, 'i', (i) => {
            i.classList.add('icon', icon);
          });

        e.append(title);
      });
    });
  }

  static removeNavigationSection(id) {
    const e = document.querySelector('#nav-' + id);
    if (e)
      e.remove();
  }

  static addElement(element, type, handler) {
    const e = document.createElement(type);
    if (handler)
      handler(e);

    element.appendChild(e);
    return e;
  }

  static addElementAdjacent(element, position, type, handler) {
    const e = document.createElement(type);
    if (handler)
      handler(e);

    element.insertAdjacentElement(position, e);
    return e;
  }

  static addFileDrop(element, area, attributes, handler) {
    area.addEventListener('dragenter', (event) => {
      for (const attribute of attributes)
        element.classList.add(attribute);

      event.preventDefault();
      event.stopPropagation();
    });

    area.addEventListener('dragleave', (event) => {
      if (event.currentTarget.contains(event.relatedTarget))
        return;

      for (const attribute of attributes)
        element.classList.remove(attribute);

      event.preventDefault();
      event.stopPropagation();
    });

    area.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    area.addEventListener('drop', (event) => {
      for (const attribute of attributes)
        element.classList.remove(attribute);

      event.preventDefault();
      event.stopPropagation();
      if (!event.dataTransfer.items)
        return;

      for (const file of event.dataTransfer.items) {
        if (event.dataTransfer.items[0].kind !== 'file')
          continue;

        if (!handler(file.getAsFile()))
          break;
      }
    });
  }

  // Read # heading marker, split newline character into paragraphs.
  static addMarkup(element, text) {
    for (const line of text.split("\n")) {
      const match = line.match(/^#+/);
      if (match) {
        V2Web.addElement(element, 'p', (e) => {
          e.classList.add('title');
          e.textContent = line.slice(match[0].length).trim();
        });

      } else
        V2Web.addElement(element, 'p', (e) => {
          e.textContent = line;
        });
    }
  }
}

// Inline element to show a notification with a close button.
class V2WebNotify {
  #element = null;
  #elementText = null;

  constructor(canvas) {
    V2Web.addElement(canvas, 'div', (notify) => {
      this.#element = notify;
      this.#element.style.display = 'none';
      this.#element.classList.add('notify');
    });

    return Object.seal(this);
  }

  clear(text) {
    this.#element.style.display = 'none';
    this.#element.classList.remove('--info', '--warn', '--error');
    this.#element.innerHTML = '';
  }

  info(text) {
    this.clear();
    this.#element.classList.add('--info');
    this.#element.style.display = '';
    this.#element.innerHTML = text;
  }

  warn(text) {
    this.clear();
    this.#element.classList.add('--warn');
    this.#element.style.display = '';
    this.#element.innerHTML = text;
  }

  error(text) {
    this.clear();
    this.#element.classList.add('--error');
    this.#element.style.display = '';
    this.#element.innerHTML = text;
  }
}

// A row of buttons and input elements.
class V2WebMenu {
  element = null;

  constructor(element, handler) {
    V2Web.addElement(element, 'menu', (e) => {
      this.element = e;

      if (handler)
        handler(this);
    });

    return Object.seal(this);
  }

  addItem(handler) {
    V2Web.addElement(this.element, 'li', (li) => {
      if (handler)
        handler(li);
    });
  }

  addElement(element, handler) {
    this.addItem((li) => {
      V2Web.addElement(li, element, (e) => {
        if (handler)
          handler(e);
      });
    });
  }

  remove() {
    this.element.remove();
  }
}

class V2WebTabs {
  current = null;
  element = null;

  #elementsTabs = null;
  #tabs = {};
  #notifiers = [];

  constructor(element, handler) {
    V2Web.addElement(element, 'div', (tabs) => {
      this.element = tabs;

      new V2WebMenu(tabs, (menu) => {
        menu.element.classList.add('bar');
        this.#elementsTabs = menu;
      });
    });

    if (handler)
      handler(this);

    return Object.seal(this);
  }

  addNotifier(handler) {
    this.#notifiers.push(handler);
  }

  addTab(name, icon, text, handler) {
    this.#tabs[name] = {};

    this.#elementsTabs.addElement('button', (e) => {
      e.addEventListener('click', () => {
        // Do not switch inactive tabs.
        if (!this.current)
          return;

        this.switchTab(name);
      });

      V2Web.addElement(e, 'i', (i) => {
        i.classList.add('icon', icon);
      });
      e.append(text);
      this.#tabs[name].tab = e;
    });

    V2Web.addElement(this.element, 'div', (e) => {
      if (handler)
        handler(e);

      e.style.display = 'none';
      this.#tabs[name].canvas = e;
    });
  }

  switchTab(name) {
    for (const id of Object.keys(this.#tabs)) {
      if (id === name) {
        this.#tabs[id].tab.classList.add('info');
        this.#tabs[id].canvas.style.display = '';

      } else {
        this.#tabs[id].tab.classList.remove('info');
        this.#tabs[id].canvas.style.display = 'none';
      }
    }

    this.current = name;

    for (const notifier of this.#notifiers)
      notifier(name);
  }

  // Clear the tab's content.
  resetTab(name) {
    const canvas = this.#tabs[name].canvas;
    while (canvas.firstChild)
      canvas.firstChild.remove();
  }

  remove() {
    this.element.remove();
  }
}

class V2WebModule {
  canvas = null;
  id = null;

  #header = Object.seal({
    element: null,
    icon: null,
    title: null,
  });

  constructor(id, icon, title, subtitle) {
    if (id)
      this.id = id;

    this.canvas = document.createElement('section');
    if (this.id)
      this.canvas.id = id;

    V2Web.addElement(this.canvas, 'hgroup', (e) => {
      this.#header.element = e;
    });

    if (title) {
      this.title(icon, title, subtitle);
    }
  }

  title(icon, title, subtitle) {
    this.#header.icon = icon || null;
    this.#header.title = title || null;

    while (this.#header.element.firstChild)
      this.#header.element.firstChild.remove();

    if (!title)
      return;

    V2Web.addElement(this.#header.element, 'h2', (e) => {
      if (icon)
        V2Web.addElement(e, 'i', (i) => {
          i.classList.add('icon', icon);
        });

      e.append(title);
    });

    if (subtitle) {
      V2Web.addElement(this.#header.element, 'p', (e) => {
        e.textContent = subtitle;
      });
    }
  }

  attach() {
    if (this.canvas.parentNode)
      return;

    if (this.id && this.#header.title)
      V2Web.addNavigationSection(this.id, this.#header.icon, this.#header.title, '#' + this.id);

    document.querySelector('main').appendChild(this.canvas);
  }

  detach() {
    if (!this.canvas.parentNode)
      return;

    if (this.id && this.#header.title)
      V2Web.removeNavigationSection(this.id);

    this.canvas.remove();
  }

  show() {
    if (this.id)
      V2Web.addNavigationSection(this.id, this.#header.icon, this.#header.title, '#' + this.id);

    this.canvas.style.display = '';
  }

  hide() {
    if (this.id)
      V2Web.removeNavigationSection(this.id);

    this.canvas.style.display = 'none';
  }

  reset() {
    while (this.canvas.firstChild)
      this.canvas.firstChild.remove();
  }
}
