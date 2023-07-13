// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2PlayerInstruments extends V2WebModule {
  #player = null;
  #midi = null;
  #midiFile = null;
  #buttons = Object.seal({
    reset: null,
    save: null
  });
  #tracks = new Map();

  constructor(player, midi, midiFile) {
    super('instruments', 'Instruments', 'Manually assign devices to MIDI tracks');

    this.#player = player;
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
    this.attach();

    V2Web.addButtons(this.canvas, (buttons) => {
      V2Web.addButton(buttons, (e) => {
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
            this.#player.assignDevices();
          }

          this.#updateConfig(true);
        });
      });

      V2Web.addButton(buttons, (e) => {
        this.#buttons.save = e;
        e.textContent = 'Save';
        e.classList.add('is-link');
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

      // Single track files have no separate track title.
      if (i > 0) {
        V2Web.addElement(this.canvas, 'div', (e) => {
          e.classList.add('ellipsis');
          e.classList.add('my-1');
          e.classList.add('is-size-4');
          e.textContent = track.getTag('title') || 'Track';
        });
      }

      V2Web.addElement(this.canvas, 'div', (line) => {
        line.classList.add('is-flex');
        line.classList.add('is-justify-content-space-between');
        line.classList.add('is-size-6');
        line.classList.add('mb-2');

        V2Web.addElement(line, 'div', (e) => {
          e.classList.add('ellipsis');
          e.classList.add('mr-2');

          const instrument = track.getTag('instrument');
          if (instrument) {
            e.textContent = instrument;

          } else {
            t.program = track.getProgram();
            if (t.program !== null)
              e.textContent = V2MIDI.GM.Program.Name[t.program];
          }
        });

        V2Web.addElement(line, 'div', (e) => {
          e.classList.add('tag');
          e.classList.add('is-medium');
          e.classList.add('ellipsis');
          t.deviceElement = e;
        });
      });

      t.select = new V2MIDISelect(this.canvas);
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

      t.select.addNotifier('disconnect', (selected) => {
        t.manual.channel.selectedIndex = 0;
        t.device.disconnect();
        t.select.setDisconnected();
      });

      t.select.addNotifier('add', (selected) => {
        this.#player.assignDevices();
      });

      new V2WebField(this.canvas, (field, element) => {
        element.classList.add('mt-2');

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
            t.manual.channel = select;
            select.disabled = true;

            V2Web.addElement(select, 'option', (e) => {
              e.value = -1;
              e.text = '–';
            });

            for (let i = 0; i < 16; i++) {
              V2Web.addElement(select, 'option', (e) => {
                e.value = i;
                e.text = i + 1;
              });
            }

            e.addEventListener('change', () => {
              t.manual.changed = true;
              this.#updateConfig();
            });
          });
        });
      });

      V2Web.addElement(this.canvas, 'input', (e) => {
        t.volume = e;
        e.classList.add('range');
        e.type = 'range';
        e.max = 127;
        e.value = 100;
        e.disabled = true;
        e.classList.add('mt-5');
        e.addEventListener('input', () => {
          this.#syncVolume(t, e.value);
          t.device.sendControlChange(0, V2MIDI.CC.channelVolume, e.value);
        });
      });

      this.#tracks.set(i, t);
    }

    V2PlayerDatabase.getInstruments(name, (instruments) => {
      for (const [i, entry] of instruments.entries()) {
        const track = this.#tracks.get(i);
        if (!track)
          continue;

        track.manual.device = entry.device;
        track.manual.channel.value = entry.channel;
        track.manual.channel.disabled = false;
        this.#player.assignDevices();
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
      track.select.select(device);
      track.select.setConnected();
      this.#syncVolume(track);
    }
  }

  updateSelect() {
    const devices = this.#midi.getDevices('output');
    for (const track of this.#tracks.values()) {
      track.select.update(devices);
      this.#player.assignDevices();
    }
  }

  silence() {
    for (const track of this.#tracks.values()) {
      track.volume.value = 100;
      track.device.sendControlChange(0, V2MIDI.CC.allNotesOff);
    }
  }

  reset() {
    super.reset();
    this.detach();
    this.silence();
    for (const track of this.#tracks.values())
      track.device.disconnect();

    this.#tracks = new Map();
  }
}
