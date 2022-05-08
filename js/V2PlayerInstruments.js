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

    if (event.status == null)
      return;

    if (V2MIDI.Status.getType(event.status) == V2MIDI.Status.controlChange) {
      if (event.data[0] == V2MIDI.CC.channelVolume) {
        track.volume.value = event.data[1];
        this.#syncVolume(track, track.volume.value);
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
            if (track.manual.device == null)
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

            if (track.manual.device != null)
              instruments.set(i, track.manual.device);
          }

          if (instruments.size == 0)
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
            if (t.program != null)
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
          if (t.deviceName == selected.name)
            t.manual.device = null;

          else
            t.manual.device = selected.name;
          t.volume.disabled = false;
          t.device.input = selected.in;
          t.device.output = selected.out;
          t.select.setConnected();
          this.#syncVolume(t);

        } else {
          t.manual.device = '';
          t.volume.value = 100;
          t.volume.disabled = true;
          t.device.disconnect();
          t.select.setDisconnected();
        }

        t.manual.changed = true;
        this.#updateConfig();
      });

      t.select.addNotifier('disconnect', (selected) => {
        t.device.disconnect();
        t.select.setDisconnected();
      });

      t.select.addNotifier('add', (selected) => {
        this.#player.assignDevices();
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
      for (const [i, device] of instruments.entries()) {
        const track = this.#tracks.get(i);
        if (!track)
          continue;

        track.manual.device = device;
        this.#player.assignDevices();
      }

      this.#updateConfig(true);
    })

    this.updateSelect();
    this.#updateConfig(true);
  }

  #updateConfig(show = false) {
    let reset = false;
    let save = false;
    for (const track of this.#tracks.values()) {
      if (track.manual.device != null)
        reset = true;

      if (track.manual.changed)
        save = true;

      if (!show)
        continue;

      if (track.manual.device != null) {
        track.deviceElement.textContent = track.manual.device || '∅';
        track.deviceElement.style.visibility = '';

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
      if (track == thisTrack)
        continue;

      if (!track.device || !track.device.output)
        continue;

      if (track.device.output != thisTrack.device.output)
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
      if (device.name != track.manual.device)
        continue;

      return device;
    }
  }

  #getTaggedDevice(track) {
    if (!track.deviceName)
      return null;

    for (const device of track.select.getDevices().values()) {
      if (device.name != track.deviceName)
        continue;

      return device;
    }
  }

  #getMatchingDevice(track, programs) {
    if (track.program == null)
      return null;

    // Device match based on configured program change -> device match.
    const matchDevices = programs.get(track.program);
    if (!matchDevices)
      return null;

    for (const matchDevice of matchDevices) {
      for (const device of track.select.getDevices().values())
        if (matchDevice == device.name)
          return device;
    }

    return null;
  }

  assignDevices(programs) {
    for (const track of this.#tracks.values()) {
      // Configured to never assign a device to.
      if (track.manual.device == '') {
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
