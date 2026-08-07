class V2PlayerDisplay extends V2AppSection {
  #title = null;
  #creator = null;
  #progress = null;
  #marker = null;
  #keySignature = null;
  #timeSignature = null;
  #time = null;

  constructor(app) {
    super(app, 'display');
    Object.seal(this);
    super.addSection();

    V2App.addElement(this.canvas, 'hgroup', (hg) => {
      V2App.addElement(hg, 'h2', (e) => {
        this.#title = e;
      });

      V2App.addElement(hg, 'p', (e) => {
        this.#creator = e;
      });
    });

    V2App.addElement(this.canvas, 'progress', (e) => {
      this.#progress = e;
      e.value = 0;
    });

    V2App.addElement(this.canvas, 'ul', (l) => {
      l.classList.add('line');

      V2App.addElement(l, 'li', (e) => {
        this.#marker = e;
      });

      V2App.addElement(l, 'li', (e) => {
        this.#keySignature = e;
      });

      V2App.addElement(l, 'li', (e) => {
        this.#timeSignature = e;
      });

      V2App.addElement(l, 'li', (e) => {
        this.#time = e;
      });
    });
  }

  showProgress(timeSec, runtimeSec) {
    this.#progress.value = timeSec / runtimeSec;
    const minutes = Math.trunc(runtimeSec / 60);
    const seconds = Math.trunc(runtimeSec % 60);
    this.#time.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  }

  showMarker(marker) {
    this.#marker.textContent = marker || '';
  }

  showKeySignature(signature) {
    this.#keySignature.textContent = signature || '';
  }

  showTimeSignature(signature) {
    this.#timeSignature.textContent = signature || '';
  }

  show(title, creator) {
    this.#title.textContent = title;
    this.#creator.textContent = creator;
  }

  showVersion() {
    this.#timeSignature.innerHTML = '<a href=' + document.querySelector('link[rel="source"]').href +
      ' target="software">' + document.querySelector('meta[name="name"]').content +
      '</a>, version ' + Number(document.querySelector('meta[name="version"]').content);
  }

  reset() {
    this.#progress.value = 0;
    this.#marker.textContent = '';
    this.#keySignature.textContent = '';
    this.#timeSignature.textContent = '';
    this.#time.textContent = '';
  }
}
