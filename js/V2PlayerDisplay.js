// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2PlayerDisplay extends V2WebModule {
  #title = Object.seal({
    element: null,
    content: null
  });
  #copyright = null;
  #progress = null;
  #marker = null;
  #keySignature = null;
  #timeSignature = null;
  #time = null;

  constructor() {
    super();
    super.attach();
    super.hide();

    V2Web.addElement(this.canvas, 'div', (div) => {
      this.#title.element = div;
      div.classList.add('mb-1');

      V2Web.addElement(div, 'div', (e) => {
        this.#title.content = e;
        e.classList.add('ellipsis');
      });
    });

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#copyright = e;
      e.classList.add('ellipsis');
      e.classList.add('mb-5');
    });

    V2Web.addElement(this.canvas, 'progress', (e) => {
      this.#progress = e;
      e.classList.add('progress');
      e.classList.add('is-small');
      e.classList.add('mb-2');
      e.value = 0;
    });

    V2Web.addElement(this.canvas, 'div', (line) => {
      line.classList.add('is-flex');
      line.classList.add('is-justify-content-space-between');

      V2Web.addElement(line, 'div', (e) => {
        this.#marker = e;
        e.classList.add('mr-2');
        e.classList.add('ellipsis');
      });

      V2Web.addElement(line, 'div', (right) => {
        right.classList.add('is-flex');
        right.classList.add('is-justify-content-end');

        V2Web.addElement(right, 'div', (e) => {
          this.#keySignature = e;
          e.classList.add('mr-2');
        });

        V2Web.addElement(right, 'div', (e) => {
          this.#timeSignature = e;
          e.classList.add('mr-2');
        });

        V2Web.addElement(right, 'div', (e) => {
          this.#time = e;
        });
      });
    });

    window.onresize = () => {
      this.#scaleTitle();
    };

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

  show(title, copyright) {
    this.#title.content.textContent = title;
    this.#copyright.textContent = copyright;
    super.show();
    this.#scaleTitle();
  }

  showVersion() {
    this.#timeSignature.innerHTML = '<a href=' + document.querySelector('link[rel="source"]').href +
      ' target="software">' + document.querySelector('meta[name="name"]').content +
      '</a>, version ' + Number(document.querySelector('meta[name="version"]').content);

    super.show();
  }

  reset() {
    super.hide();
    this.#title.content.textContent = '';
    this.#copyright.textContent = '';
    this.#progress.value = 0;
    this.#marker.textContent = '';
    this.#keySignature.textContent = '';
    this.#timeSignature.textContent = '';
    this.#time.textContent = '';
  }

  #scaleTitle() {
    if (this.#title.content.textContent === '')
      return;

    // Configure the measurement wrapper to take the size of the text content.
    this.#title.content.style.position = 'absolute';

    // Reduce the font size until we possibly fit into the container.
    for (let i = 2; i > 1.2; i -= 0.1) {
      this.#title.content.style.fontSize = i + 'rem';
      if (this.#title.content.clientWidth < this.#title.element.clientWidth)
        break;
    }

    // Remove the measurement wrapper settings.
    this.#title.content.style.position = '';
  }
}
