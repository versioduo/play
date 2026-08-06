class V2PlayerDevices extends V2AppSection {
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

  constructor(app, midi) {
    super(app, 'devices', '--right-to-bracket', 'Devices', 'Automatically Match Instruments to Devices');
    Object.seal(this);

    this.#midi = midi;
    this.#programs = new Map();
  }

  getPrograms(program) {
    return this.#programs;
  }

  #updateMatches() {
    this.#list.replaceChildren();

    for (const [program, devices] of this.#programs.entries()) {
      V2App.addElement(this.#list, 'li', (li) => {
        li.id = this.id + '.programs.' + program;

        V2App.addElement(li, 'hgroup', (hg) => {
          V2App.addElement(hg, 'h3', (e) => {
            e.textContent = V2MIDI.GM.Program.Name[program];
          });
        });

        for (const [index, device] of devices.entries()) {
          new V2AppMenu(li, (menu) => {
            menu.addElement('span', (e) => {
              e.textContent = device;
            });

            menu.addElement('button', (e) => {
              e.classList.add('field');
              e.classList.add('warn');

              V2App.addElement(e, 'i', (i) => {
                i.classList.add('icon', '--xmark', '--nospace');
              });
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

    this.app.player.assignDevices(this.#programs);
  }

  show() {
    super.addSection();

    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
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

      menu.addElement('button', (e) => {
        this.#buttons.add = e;
        e.classList.add('primary');
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

    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('span', (e) => {
        e.textContent = 'Device';
      });

      menu.addItem((li) => {
        this.#add.select = new V2MIDISelect(li);
      });
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

      new V2AppMenu(this.canvas, (menu) => {
        menu.element.classList.add('full');

        menu.addElement('span', (e) => {
          e.classList.add('label');
          e.textContent = 'Program';
        });

        menu.addElement('button', (e) => {
          e.classList.add('grow');
          text = e;
        });

        menu.addElement('input', (e) => {
          this.#add.program = e;
          e.type = 'number';
          e.min = 1;
          e.max = 128;
          e.addEventListener('input', () => {
            update(e.value);
          });
        });
      });

      V2App.addElement(this.canvas, 'input', (e) => {
        range = e;
        e.type = 'range';
        e.min = 1;
        e.max = 128;
        e.addEventListener('input', () => {
          update(e.value);
        });
      });

      update(V2MIDI.GM.Program.acousticGrandPiano + 1);
    }

    V2App.addElement(this.canvas, 'ul', (e) => {
      this.#list = e;
      e.id = this.id + '.programs';
      e.classList.add('cards', '--grid');
    });

    V2PlayerDatabase.getDevices('programs', (devices) => {
      this.#programs = devices;
      this.#buttons.reset.disabled = false;
      this.#updateMatches();
    });

    this.#add.select.update(this.#midi.getDevices('output'));
  }

  reset() {
    super.removeSection();
  }
}
