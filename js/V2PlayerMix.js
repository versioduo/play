// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2PlayerMix extends V2WebModule {
  #player = null;
  #midi = null;
  #buttons = Object.seal({
    reset: null,
    save: null
  });
  #input = Object.seal({
    name: null,
    select: null,
    device: null
  });
  #output = Object.seal({
    name: null,
    select: null,
    device: null
  });
  #channel = null;
  #transpose = null;
  #manual = false;
  #config = null;

  constructor(player, midi) {
    super('mix', 'Mix', 'Forward MIDI messages between devices');
    this.#player = player;
    this.#midi = midi;

    this.#midi.addNotifier('state', (event) => {
      this.#update();
    });

    return Object.seal(this);
  }

  #assignDevices() {
    if (!this.#config)
      return;

    let input = null;
    let output = null;

    // Try to connect the configured devices.
    for (const device of this.#input.select.getDevices().values()) {
      if (device.name !== this.#config.input)
        continue;

      input = device;
      break;
    }

    for (const device of this.#output.select.getDevices().values()) {
      if (device.name !== this.#config.output)
        continue;

      output = device;
      break;
    }

    if (!input || !output) {
      this.#disconnect(this.#input);
      this.#disconnect(this.#output);
      return;
    }

    // Do not reconnect the identical device.
    if (this.#input.device.getID() === input.id)
      return;

    this.#connect(this.#input, input);
    this.#input.select.select(input);
    this.#input.device.input.onmidimessage = this.#input.device.handleMessage.bind(this.#input.device);

    this.#connect(this.#output, output);
    this.#output.select.select(output);
  }

  #update() {
    let input = this.#midi.getDevices('input');
    let output = this.#midi.getDevices('output');

    // Ensure that we are not forwarding from/to the same device.
    if (this.#output.device)
      input.delete(this.#output.device.getID());

    if (this.#input.device)
      output.delete(this.#input.device.getID());

    this.#input.select.update(input);
    this.#output.select.update(output);

    if (this.#manual)
      this.#buttons.save.disabled = (!this.#input.device.input || !this.#output.device.output);

    else
      this.#assignDevices();
  }

  #connect(direction, device) {
    direction.device.disconnect();

    direction.device.input = device.in;
    direction.device.output = device.out;
    direction.select.setConnected();
  }

  #disconnect(direction) {
    direction.device.disconnect();
    direction.select.setDisconnected();
  }

  show() {
    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        this.#buttons.reset = e;
        e.textContent = 'Reset';
        e.disabled = true;
        e.addEventListener('click', () => {
          V2PlayerDatabase.deleteDevices('mix');
          e.disabled = true;

          this.#config = null;
          this.#manual = false;
          this.#input.name.textContent = '';
          this.#input.name.style.visibility = 'hidden';
          this.#output.name.textContent = '';
          this.#output.name.style.visibility = 'hidden';
          this.#transpose.value = 0;
          this.#channel.value = '';

          this.#disconnect(this.#input);
          this.#disconnect(this.#output);
        });
      });

      V2Web.addButton(buttons, (e) => {
        this.#buttons.save = e;
        e.classList.add('is-link');
        e.textContent = 'Save';
        e.disabled = true;
        e.addEventListener('click', () => {
          if (!this.#input.device || !this.#output.device)
            return;

          this.#config = Object.seal({
            input: this.#input.device.input.name,
            output: this.#output.device.output.name,
            transpose: this.#transpose.value,
            channel: null
          });

          if (this.#channel.value !== '')
            this.#config.channel = this.#channel.value - 1;

          V2PlayerDatabase.addDevices('mix', this.#config);

          this.#input.name.textContent = this.#config.input;
          this.#input.name.style.visibility = '';
          this.#output.name.textContent = this.#config.output;
          this.#output.name.style.visibility = '';

          this.#manual = false;
          this.#buttons.save.disabled = true;
          this.#buttons.reset.disabled = false;
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (line) => {
      line.classList.add('is-flex');
      line.classList.add('is-justify-content-space-between');
      line.classList.add('my-1');
      line.classList.add('is-align-items-center');

      V2Web.addElement(line, 'div', (e) => {
        e.classList.add('is-size-4');
        e.classList.add('mr-2');
        e.textContent = 'Input';
      });

      V2Web.addElement(line, 'div', (e) => {
        this.#input.name = e;
        this.#input.name.style.visibility = 'hidden';
        e.classList.add('tag');
        e.classList.add('is-medium');
        e.classList.add('ellipsis');
      });
    });

    this.#input.select = new V2MIDISelect(this.canvas, (e) => {
      e.classList.add('mb-3');
    });

    this.#input.select.addNotifier('select', (device) => {
      if (device) {
        this.#connect(this.#input, device);
        this.#input.device.input.onmidimessage = this.#input.device.handleMessage.bind(this.#input.device);

      } else
        this.#disconnect(this.#input);

      this.#manual = true;
      this.#update();
    });

    this.#input.device = new V2MIDIDevice();
    this.#input.device.addNotifier('message', (message) => {
      if (!this.#output.device)
        return;

      const status = V2MIDI.Status.getType(message[0]);
      switch (status) {
        case V2MIDI.Status.noteOn:
        case V2MIDI.Status.noteOff:
        case V2MIDI.Status.aftertouch:
          if (this.#transpose.value !== 0) {
            let note = message[1] + Number(this.#transpose.value);
            if (note < 0)
              note = 0;
            else if (note > 127)
              note = 127;

            message[1] = note;
          }

          if (this.#channel.value !== '')
            message[0] = status | (this.#channel.value - 1);
          break;
      }

      this.#output.device.sendMessage(message);
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Transpose';
        e.tabIndex = -1;
      });

      field.addElement('span', (e) => {
        e.classList.add('select');

        V2Web.addElement(e, 'select', (select) => {
          this.#transpose = select;

          for (const i of [48, 36, 24, 12, 0, -12, -24, -36, -48]) {
            V2Web.addElement(select, 'option', (e) => {
              e.value = i;
              e.text = (i > 0) ? '+' + i : i;

              if (i === 0)
                e.selected = true;
            });
          }

          e.addEventListener('change', () => {
            this.#manual = true;
            this.#update();
          });
        });
      });
    });

    new V2WebField(this.canvas, (field) => {
      field.addButton((e) => {
        e.classList.add('width-label');
        e.classList.add('has-background-grey-lighter');
        e.classList.add('inactive');
        e.textContent = 'Channel';
        e.tabIndex = -1;
      });

      field.addElement('span', (e) => {
        e.classList.add('select');

        V2Web.addElement(e, 'select', (select) => {
          this.#channel = select;

          V2Web.addElement(select, 'option', (e) => {
            e.value = '';
            e.text = '–';
            e.selected = true;
          });

          for (let i = 1; i < 17; i++) {
            V2Web.addElement(select, 'option', (e) => {
              e.value = i;
              e.text = i;
            });
          }

          e.addEventListener('change', () => {
            this.#manual = true;
            this.#update();
          });
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (line) => {
      line.classList.add('is-flex');
      line.classList.add('is-justify-content-space-between');
      line.classList.add('my-1');
      line.classList.add('is-align-items-center');

      V2Web.addElement(line, 'div', (e) => {
        e.classList.add('is-size-4');
        e.classList.add('mr-2');
        e.textContent = 'Output';
      });

      V2Web.addElement(line, 'div', (e) => {
        this.#output.name = e;
        this.#output.name.style.visibility = 'hidden';
        e.classList.add('tag');
        e.classList.add('is-medium');
        e.classList.add('ellipsis');
      });
    });

    this.#output.select = new V2MIDISelect(this.canvas, (e) => {
      e.classList.add('mb-3');
    });

    this.#output.select.addNotifier('select', (device) => {
      if (device)
        this.#connect(this.#output, device);

      else
        this.#disconnect(this.#output);

      this.#manual = true;
      this.#update();
    });

    this.#output.device = new V2MIDIDevice();

    V2PlayerDatabase.getDevices('mix', (config) => {
      this.#config = config;

      this.#input.name.textContent = this.#config.input;
      this.#input.name.style.visibility = '';
      this.#output.name.textContent = this.#config.output;
      this.#output.name.style.visibility = '';

      this.#transpose.value = this.#config.transpose;
      if (this.#config.channel)
        this.#channel.value = this.#config.channel + 1;

      this.#buttons.reset.disabled = false;
      this.#update();
    });

    this.#update();
    super.attach();
  }

  reset() {
    this.#buttons.reset = null;
    this.#buttons.save = null;

    this.#input.select = null;
    if (this.#input.device) {
      this.#input.device.disconnect();
      this.#input.device = null;
    }

    this.#output.select = null;
    if (this.#output.device) {
      this.#output.device.disconnect();
      this.#output.device = null;
    }

    this.#channel = null;
    this.#transpose = null;
    this.#manual = false;
    this.#config = null;

    super.reset();
    super.detach();
  }
}
