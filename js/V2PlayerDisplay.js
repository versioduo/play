class V2PlayerDisplay extends V2WebModule {
  #progress = null;
  #marker = null;
  #keySignature = null;
  #timeSignature = null;
  #time = null;

  constructor() {
    super();
    super.attach();
    super.hide();

    V2Web.addElement(this.canvas, 'progress', (e) => {
      this.#progress = e;
      e.value = 0;
    });

    V2Web.addElement(this.canvas, 'ul', (l) => {
      l.classList.add('line');

      V2Web.addElement(l, 'li', (e) => {
        this.#marker = e;
      });

      V2Web.addElement(l, 'li', (e) => {
        this.#keySignature = e;
      });

      V2Web.addElement(l, 'li', (e) => {
        this.#timeSignature = e;
      });

      V2Web.addElement(l, 'li', (e) => {
        this.#time = e;
      });
    });

    return Object.seal(this);
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
    this.title('', title, creator);
    super.show();
  }

  showVersion() {
    this.#timeSignature.innerHTML = '<a href=' + document.querySelector('link[rel="source"]').href +
      ' target="software">' + document.querySelector('meta[name="name"]').content +
      '</a>, version ' + Number(document.querySelector('meta[name="version"]').content);

    super.show();
  }

  reset() {
    super.hide();
    this.#progress.value = 0;
    this.#marker.textContent = '';
    this.#keySignature.textContent = '';
    this.#timeSignature.textContent = '';
    this.#time.textContent = '';
  }
}
