// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2PlayerDevices extends V2WebModule {
  #player = null;
  #midi = null;

  #list = null;
  #buttons = Object.seal({
    reset: null,
    add: null
  });
  #add = Object.seal({
    program: null,
    device: null,
    select: null
  });
  #programs = null;

  constructor(player, midi) {
    super('devices', 'Devices', 'Automatically match instruments to devices');

    this.#player = player;
    this.#midi = midi;
    this.#programs = new Map();
  }

  getPrograms(program) {
    return this.#programs;
  }

  #updateMatches() {
    while (this.#list.firstChild)
      this.#list.firstChild.remove();

    for (const [program, devices] of this.#programs.entries()) {
      V2Web.addElement(this.#list, 'div', (list) => {
        list.classList.add('mb-5');

        V2Web.addElement(list, 'div', (e) => {
          e.classList.add('mb-1');
          e.classList.add('is-size-4');
          e.textContent = V2MIDI.GM.Program.Name[program];
        });

        for (const [index, device] of devices.entries()) {
          new V2WebField(list, (field) => {
            field.addButton((e) => {
              e.classList.add('has-background-light');
              e.classList.add('inactive');
              e.tabIndex = -1;
              e.textContent = device;
            });

            field.addButton((e) => {
              e.textContent = '✕';
              e.addEventListener('click', () => {
                devices.splice(index, 1);

                if (devices.length === 0)
                  this.#programs.delete(program);

                V2PlayerDatabase.addDevices('programs', this.#programs);
                this.#updateMatches();
              });
            });
          });
        }
      });
    }

    this.#player.assignDevices(this.#programs);
  }

  show() {
    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
        this.#buttons.reset = e;
        e.textContent = 'Reset';
        e.disabled = true;
        e.addEventListener('click', () => {
          this.#programs = new Map();
          V2PlayerDatabase.deleteDevices('programs');
          e.disabled = true;
          this.#updateMatches();
        });
      });

      V2Web.addButton(buttons, (e) => {
        this.#buttons.add = e;
        e.classList.add('is-link');
        e.textContent = 'Add';
        e.disabled = true;
        e.addEventListener('click', () => {
          if (!this.#add.device)
            return;

          const program = this.#add.program.value - 1;
          const devices = this.#programs.get(program);
          if (devices) {
            const exists = devices.findIndex((e) => {
              return e === this.#add.device;
            });
            if (exists < 0)
              devices.unshift(this.#add.device);

          } else {
            this.#programs.set(program, [this.#add.device]);
            this.#programs = new Map([...this.#programs.entries()].sort(([p], [p2]) => {
              return p - p2;
            }));
          }

          V2PlayerDatabase.addDevices('programs', this.#programs);
          this.#buttons.reset.disabled = false;
          this.#updateMatches();
        });
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#list = e;
    });

    this.#add.select = new V2MIDISelect(this.canvas, (e) => {
      e.classList.add('my-4');
    });
    this.#midi.addNotifier('state', (event) => {
      this.#add.select.update(this.#midi.getDevices('output'));
    });

    this.#add.select.addNotifier('select', (selected) => {
      if (selected) {
        this.#add.device = selected.name;
        this.#buttons.add.disabled = false;

      } else {
        this.#add.device = null;
        this.#buttons.add.disabled = true;
      }
    });

    {
      let text = null;
      let range = null;

      const update = (number) => {
        this.#add.program.value = number;
        text.textContent = V2MIDI.GM.Program.Name[number - 1];
        range.value = number;
      };

      new V2WebField(this.canvas, (field) => {
        field.addButton((e) => {
          e.classList.add('width-label');
          e.classList.add('has-background-grey-lighter');
          e.classList.add('inactive');
          e.tabIndex = -1;
          e.textContent = 'Program';
        });

        field.addButton((e) => {
          text = e;
          e.classList.add('width-text-wide');
          e.classList.add('has-background-light');
          e.classList.add('inactive');
          e.tabIndex = -1;
        });

        field.addInput('number', (e) => {
          this.#add.program = e;
          e.classList.add('width-number');
          e.min = 1;
          e.max = 128;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2Web.addElement(this.canvas, 'input', (e) => {
        range = e;
        e.classList.add('range');
        e.type = 'range';
        e.min = 1;
        e.max = 128;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(V2MIDI.GM.Program.acousticGrandPiano + 1);
    }

    V2PlayerDatabase.getDevices('programs', (devices) => {
      this.#programs = devices;
      this.#buttons.reset.disabled = false;
      this.#updateMatches();
    });

    this.#add.select.update(this.#midi.getDevices('output'));
    super.attach();
  }

  reset() {
    super.reset();
    super.detach();
  }
}
