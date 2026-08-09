class V2Main {
  #midi = null;
  #midiFile = null;
  #wakeLock = null;

  #display = null;
  #library = null;
  #instruments = null;
  #devices = null;
  #mix = null;

  constructor(app) {
    Object.seal(this);
    app.main = this;

    this.#display = app.addSection(V2PlayerDisplay);
    this.#display.showVersion();

    this.#library = app.addSection(V2PlayerLibrary);

    this.#midi = new V2MIDI();
    this.#midi.setup((error) => {
      if (error) {
        this.#library.getNotify().error(error);
        return;
      }

      this.#instruments.updateSelect();
    });

    // Subscribe to device connect/disconnect events.
    this.#midi.addNotifier('state', (event) => {
      this.#instruments.updateSelect();
    });

    this.#setEnabled(false);

    this.#midiFile = new V2MIDIFilePlayer();
    this.#midiFile.addNotifier('stop', () => {
      this.#releaseWakeLock();
      this.#library.getNotify().clear();
      this.#library.setPlayButton();
      this.#display.showKeySignature();
      this.#display.showTimeSignature();
      this.#display.showMarker();
    });

    this.#midiFile.addNotifier('position', (timeSec, runtimeSec) => {
      this.#display.showProgress(timeSec, runtimeSec);
    });

    this.#library.show();

    this.#instruments = app.addSection(V2PlayerInstruments, [this.#midi, this.#midiFile]);
    this.#midiFile.addNotifier('event', (i, event) => {
      if (event.meta === V2MIDIFile.Meta.marker)
        this.#display.showMarker(new TextDecoder().decode(event.data));

      else if (event.meta === V2MIDIFile.Meta.keySignature)
        this.#display.showKeySignature(event.getKeySignature());

      else if (event.meta === V2MIDIFile.Meta.timeSignature)
        this.#display.showTimeSignature(event.getTimeSignature());

      this.#instruments.handleEvent(i, event);
    });

    this.#devices = app.addSection(V2PlayerDevices, [this.#midi]);
    this.#devices.show();

    this.#mix = app.addSection(V2PlayerMix, [this.#midi]);
    this.#mix.show();
  }

  // Dim UI elements when no file is loaded.
  #setEnabled(enabled) {
    for (const e of document.querySelectorAll('.enabled'))
      e.disabled = !enabled;
  }

  getTitle() {
    return this.#midiFile.tracks[0].getTag('title');
  }

  requestFile(url) {
    return this.#library.fetchFile(url);
  }

  show(name, buffer) {
    const error = this.#midiFile.loadBuffer(buffer);
    if (error) {
      this.reset();
      this.#library.getNotify().error('Unable to parse the MIDI file: <i>' + error + '</i>');
      return false;
    }

    this.#display.show(this.getTitle() || 'File', this.#midiFile.tracks[0].getTag('creator'));
    this.#instruments.show(name);
    this.#devices.show();
    this.#mix.show();
    this.#setEnabled(true);
    return true;
  }

  reset() {
    this.#midiFile.stop();
    this.#setEnabled(false);

    this.#display.reset();
    this.#library.reset();
    this.#instruments.reset();
    this.#devices.reset();
    this.#mix.reset();
  }

  #releaseWakeLock() {
    if (!this.#wakeLock)
      return;

    this.#wakeLock.onrelease = null;
    this.#wakeLock.release();
    this.#wakeLock = null;
  }

  #pause() {
    this.#releaseWakeLock();
    this.#midiFile.pause();
    this.#library.setPlayButton();
  }

  play() {
    if (this.#midiFile.isPlaying()) {
      this.#pause();
      return;
    }

    const requestWakeLock = async () => {
      if (!navigator.wakeLock)
        return;

      this.#wakeLock = await navigator.wakeLock.request('screen');
      this.#wakeLock.onrelease = () => {
        const playing = this.#midiFile.isPlaying();
        this.#pause();

        if (playing)
          this.#library.getNotify().warn('The playback was paused because the application moved to the background.');
      };
    };

    this.#library.getNotify().clear();
    requestWakeLock();
    this.#midiFile.play();
    this.#library.setPlayButton('Pause');
  }

  stop() {
    this.#releaseWakeLock();
    this.#midiFile.stop();
    this.#display.showMarker();
    this.#library.getNotify().clear();
    this.#library.setPlayButton();
    this.#instruments.silence();
  }

  assignDevices() {
    this.#instruments.assignDevices(this.#devices.getPrograms());
  }
}
