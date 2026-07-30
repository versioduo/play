class V2MIDISelect {
  element = null;
  #notifiers = Object.seal({
    select: [],
    disconnect: [],
    add: []
  });
  #devices = null;

  constructor(canvas, handler) {
    V2Web.addElement(canvas, 'select', (s) => {
      this.element = s;
      s.disabled = true;
      s.addEventListener('change', () => {
        if (s.value === '') {
          for (const notifier of this.#notifiers.select)
            notifier(null);

        } else {
          for (const notifier of this.#notifiers.select)
            notifier(this.#devices.get(s.value));
        }
      });

      V2Web.addElement(s, 'option', (e) => {
        e.textContent = 'Connect to ...';
        e.value = '';
      });

      if (handler)
        handler(s);
    });

    return Object.seal(this);
  }

  update(devices) {
    this.#devices = devices;
    let add = false;

    // Delete the option/entry for no longer existing devices. Create a shallow
    // copy to iterate over, we delete elements from the list.
    Array.from(this.element.options, (option) => {
      if (option.value === '')
        return;

      if (!devices.has(option.value)) {
        if (option.selected)
          for (const notifier of this.#notifiers.disconnect)
            notifier();

        option.remove();
      }
    });

    // Insert all new devices.
    let after = this.element.options[0];
    for (const [id, device] of devices) {
      // Find the index of the existing entry.
      const index = Array.from(this.element.options).findIndex((option) => {
        return option.value === id;
      });

      // Skip the existing entry, but remember the index to insert the next new entry after.
      if (index > 0) {
        after = this.element.options[index];
        continue;
      }

      add = true;

      V2Web.addElementAdjacent(after, 'afterend', 'option', (e) => {
        after = e;
        e.value = id;
        e.text = device.name + (device.instance > 0 ? ' #' + (device.instance + 1) : '');
      });
    }

    this.element.disabled = this.element.options.length === 1;

    if (add)
      for (const notifier of this.#notifiers.add)
        notifier();
  }

  getDevices() {
    return this.#devices || new Map();
  }

  selectEntry(device) {
    for (const option of this.element.options) {
      if (option.value !== device.id)
        continue;

      option.selected = true;
      break;
    }
  }

  select(device) {
    this.selectEntry(device);
    for (const notifier of this.#notifiers.select)
      notifier(device);
  }

  setConnected() {
    this.element.options[0].text = 'Disconnect ...';
  }

  setDisconnected() {
    this.element.options[0].text = 'Connect to ...';
    this.element.selectedIndex = 0;
  }

  addNotifier(type, handler) {
    this.#notifiers[type].push(handler);
  }

  remove() {
    this.#devices = null;
  }
}
