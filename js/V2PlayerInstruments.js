class V2PlayerInstruments extends V2AppSection {
  #midi = null;
  #midiFile = null;
  #buttons = Object.seal({
    reset: null,
    save: null
  });
  #tracks = new Map();

  constructor(app, midi, midiFile) {
    super(app, 'instruments', '--gear', 'Instruments', 'Manually Assign Devices to MIDI Tracks');
    Object.seal(this);

    this.#midi = midi;
    this.#midiFile = midiFile;
  }

  handleEvent(i, event) {
    const track = this.#tracks.get(i);
    if (!track || !track.device.output)
      return;

    if (event.status === null)
      return;

    if (V2MIDI.Status.getType(event.status) === V2MIDI.Status.controlChange) {
      if (event.data[0] === V2MIDI.CC.channelVolume) {
        track.volume.value = event.data[1];
        this.#syncVolume(track, track.volume.value);
      }
    }

    if (track.manual.channel.value >= 0) {
      switch (V2MIDI.Status.getType(event.status)) {
        case V2MIDI.Status.noteOn:
        case V2MIDI.Status.noteOff:
        case V2MIDI.Status.aftertouch:
        case V2MIDI.Status.controlChange:
        case V2MIDI.Status.programChange:
        case V2MIDI.Status.aftertouchChannel:
        case V2MIDI.Status.pitchBend:
          event.status = V2MIDI.Status.getType(event.status) | Number(track.manual.channel.value);
          break;
      }
    }

    this.#tracks.get(i).device.sendMessage([event.status, ...event.data]);
  }

  show(name) {
    this.addSection();

    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        this.#buttons.reset = e;
        e.textContent = 'Reset';
        e.disabled = true;
        e.addEventListener('click', () => {
          V2PlayerDatabase.deleteInstruments(name);
          for (const track of this.#tracks.values()) {
            if (track.manual.device === null)
              continue;

            track.manual.device = null;
            track.manual.changed = false;
            track.device.disconnect();
            track.select.setDisconnected();
            this.app.player.assignDevices();
          }

          this.#updateConfig(true);
        });
      });

      menu.addElement('button', (e) => {
        this.#buttons.save = e;
        e.textContent = 'Save';
        e.classList.add('primary');
        e.disabled = true;
        e.addEventListener('click', () => {
          let instruments = new Map();

          for (const [i, track] of this.#tracks.entries()) {
            track.manual.changed = false;

            if (track.manual.device !== null)
              instruments.set(i, {
                device: track.manual.device,
                channel: Number(track.manual.channel.value)
              });
          }

          if (instruments.size === 0)
            V2PlayerDatabase.deleteInstruments(name);

          else
            V2PlayerDatabase.addInstruments(name, instruments);

          this.#updateConfig(true);
        });
      });
    });


    V2App.addElement(this.canvas, 'ul', (cards) => {
      cards.classList.add('cards', '--grid');

      for (const [i, track] of this.#midiFile.tracks.entries()) {
        if (!track.hasMIDIMessages())
          continue;

        const t = Object.seal({
          deviceElement: null,
          program: null,
          manual: Object.seal({
            device: null,
            channel: null,
            changed: false
          }),
          select: null,
          device: new V2MIDIDevice(),
          deviceName: this.#midiFile.tracks[i].getTag('deviceName'),
          volume: null
        });

        V2App.addElement(cards, 'li', (card) => {
          // Single track files have no separate track title.
          if (i > 0) {
            V2App.addElement(card, 'hgroup', (hg) => {
              V2App.addElement(hg, 'h3', (e) => {
                e.textContent = track.getTag('title') || 'Track';
              });
            });
          }

          V2App.addElement(card, 'p', (e) => {
            e.classList.add('center');

            const instrument = track.getTag('instrument');
            if (instrument) {
              e.textContent = instrument;

            } else {
              t.program = track.getProgram();
              if (t.program !== null)
                e.textContent = V2MIDI.GM.Program.Name[t.program];
            }
          });

          V2App.addElement(card, 'p', (e) => {
            t.deviceElement = e;
            e.classList.add('center');
          });

          new V2AppMenu(card, (menu) => {
            menu.addElement('span', (e) => {
              e.textContent = 'Device';
            });

            menu.addItem((li) => {
              t.select = new V2MIDISelect(li);
              t.select.element.classList.add('grow');

              t.select.addNotifier('select', (selected) => {
                if (selected) {
                  if (t.deviceName === selected.name && Number(t.manual.channel.value) === -1)
                    t.manual.device = null;
                  else
                    t.manual.device = selected.name;

                  t.manual.channel.disabled = false;
                  t.volume.disabled = false;
                  t.device.input = selected.in;
                  t.device.output = selected.out;
                  t.select.setConnected();
                  this.#syncVolume(t);

                } else {
                  t.manual.device = '';
                  t.manual.channel.selectedIndex = 0;
                  t.manual.channel.disabled = true;
                  t.volume.value = 100;
                  t.volume.disabled = true;
                  t.device.disconnect();
                  t.select.setDisconnected();
                }

                t.manual.changed = true;
                this.#updateConfig();
              });
            });
          });

          t.select.addNotifier('disconnect', (selected) => {
            t.manual.channel.selectedIndex = 0;
            t.device.disconnect();
            t.select.setDisconnected();
          });

          t.select.addNotifier('add', (selected) => {
            this.app.player.assignDevices();
          });

          new V2AppMenu(card, (menu) => {
            menu.addElement('span', (e) => {
              e.textContent = 'Channel';
            });

            menu.addElement('select', (select) => {
              t.manual.channel = select;
              select.disabled = true;

              V2App.addElement(select, 'option', (e) => {
                e.value = -1;
                e.text = '–';
              });

              for (let i = 0; i < 16; i++) {
                V2App.addElement(select, 'option', (e) => {
                  e.value = i;
                  e.text = i + 1;
                });
              }

              select.addEventListener('change', () => {
                t.manual.changed = true;
                this.#updateConfig();
              });
            });
          });

          V2App.addElement(card, 'input', (e) => {
            t.volume = e;
            e.style.marginTop = '2.5rem';
            e.type = 'range';
            e.max = 127;
            e.value = 100;
            e.disabled = true;
            e.addEventListener('input', () => {
              this.#syncVolume(t, e.value);
              t.device.sendControlChange(0, V2MIDI.CC.channelVolume, e.value);
            });
          });
        });

        this.#tracks.set(i, t);
      }
    });

    V2PlayerDatabase.getInstruments(name, (instruments) => {
      for (const [i, entry] of instruments.entries()) {
        const track = this.#tracks.get(i);
        if (!track)
          continue;

        track.manual.device = entry.device;
        track.manual.channel.value = entry.channel;
        track.manual.channel.disabled = false;
        this.app.player.assignDevices();
      }
    });

    this.updateSelect();
    this.#updateConfig(true);
  }

  #updateConfig(show = false) {
    let reset = false;
    let save = false;
    for (const track of this.#tracks.values()) {
      if (track.manual.device !== null)
        reset = true;

      if (track.manual.changed)
        save = true;

      if (!show)
        continue;

      if (track.manual.device !== null) {
        track.deviceElement.textContent = track.manual.device || '∅';
        track.deviceElement.style.visibility = '';
        track.manual.channel.disabled = false;

      } else if (track.deviceName) {
        track.deviceElement.textContent = track.deviceName;
        track.deviceElement.style.visibility = '';

      } else {
        track.deviceElement.textContent = '';
        track.deviceElement.style.visibility = 'hidden';
      }
    }

    this.#buttons.reset.disabled = !reset;
    this.#buttons.save.disabled = !save;
  }

  #syncVolume(thisTrack, value = null) {
    for (const track of this.#tracks.values()) {
      if (track === thisTrack)
        continue;

      if (!track.device || !track.device.output)
        continue;

      if (track.device.output !== thisTrack.device.output)
        continue;

      // Copy the volume from another track with the same device assigned.
      if (!value) {
        thisTrack.volume.value = track.volume.value;
        break;
      }

      // Copy the value to all tracks with the same device assigned.
      track.volume.value = value;
    }
  }

  #getConfiguredDevice(track) {
    if (!track.manual.device)
      return null;

    for (const device of track.select.getDevices().values()) {
      if (device.name !== track.manual.device)
        continue;

      return device;
    }
  }

  #getTaggedDevice(track) {
    if (!track.deviceName)
      return null;

    for (const device of track.select.getDevices().values()) {
      if (device.name !== track.deviceName)
        continue;

      return device;
    }
  }

  #getMatchingDevice(track, programs) {
    if (track.program === null)
      return null;

    // Device match based on configured program change -> device match.
    const matchDevices = programs.get(track.program);
    if (!matchDevices)
      return null;

    for (const matchDevice of matchDevices) {
      for (const device of track.select.getDevices().values())
        if (matchDevice === device.name)
          return device;
    }

    return null;
  }

  assignDevices(programs) {
    for (const track of this.#tracks.values()) {
      // Configured to never assign a device to.
      if (track.manual.device === '') {
        track.device.disconnect();
        track.select.setDisconnected();
        continue;
      }

      let device = this.#getConfiguredDevice(track);
      if (!device)
        device = this.#getTaggedDevice(track);

      if (!device)
        device = this.#getMatchingDevice(track, programs);

      if (!device) {
        track.device.disconnect();
        track.select.setDisconnected();
        continue;
      }

      track.volume.disabled = false;
      track.device.input = device.in;
      track.device.output = device.out;
      track.select.selectEntry(device);
      track.select.setConnected();
      this.#syncVolume(track);
    }
  }

  updateSelect() {
    const devices = this.#midi.getDevices('output');
    for (const track of this.#tracks.values()) {
      track.select.update(devices);
      this.app.player.assignDevices();
    }
  }

  silence() {
    for (const track of this.#tracks.values()) {
      track.volume.value = 100;
      track.device.sendControlChange(0, V2MIDI.CC.allNotesOff);
    }
  }

  reset() {
    this.removeSection();

    for (const track of this.#tracks.values())
      track.device.disconnect();

    this.#tracks = new Map();
  }
}
