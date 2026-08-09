class V2PlayerLibrary extends V2AppSection {
  #bannerNotify = null;
  #playButton = null;
  #list = null;
  #remove = false;
  #current = Object.seal({
    element: null,
    file: null
  });

  constructor(app) {
    super(app, 'library', '--book-open-reader', 'Library', 'Play, Add, Remove Music');
    Object.seal(this);
    this.addSection();

    this.#bannerNotify = new V2AppNotify(this.canvas);

    new V2AppMenu(this.canvas, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Load';
        e.addEventListener('click', () => {
          this.#openFile();
        });

        V2App.addFileDrop(e, this.canvas, ['warn'], (file) => {
          this.#readFile(file);
          // Get called again for the next file in the list.
          return true;
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Delete';
        e.addEventListener('click', () => {
          this.#remove = !this.#remove;
          this.show();
        });
      });

      menu.addElement('button', (e) => {
        e.textContent = 'Stop';
        e.classList.add('enabled');
        e.addEventListener('click', () => {
          this.app.main.stop();
        });
      });

      menu.addElement('button', (e) => {
        this.#playButton = e;
        e.classList.add('primary');
        e.textContent = 'Play';
        e.classList.add('enabled');
        e.addEventListener('click', () => {
          this.app.main.play();
        });
      });
    });

    V2App.addElement(this.canvas, 'div', (e) => {
      this.#list = e;
    });
  }

  getNotify() {
    return this.#bannerNotify;
  }

  #readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.app.main.reset();

      if (!this.app.main.show(file.name, reader.result))
        return;

      const title = this.app.main.getTitle() || file.name.substr(0, file.name.lastIndexOf('.'));
      V2PlayerDatabase.addFile(file.name, title, reader.result, () => {
        this.#current.file = file.name;
        this.show();
      });
    };

    reader.readAsArrayBuffer(file);
  }

  #openFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.mid,.midi';
    input.multiple = true;

    input.addEventListener('change', () => {
      for (const file of input.files)
        this.#readFile(file);
    }, false);

    input.click();
  }

  fetchFile(url) {
    fetch(url)
      .then((response) => {
        if (!response.ok)
          throw new Error('Status=' + response.status);

        return response.arrayBuffer();
      })
      .then((buffer) => {
        if (!this.app.main.show(url, buffer))
          return;

        const fileName = url.substr(url.lastIndexOf('/') + 1);
        const name = this.app.main.getTitle() || fileName.substr(0, fileName.lastIndexOf('.'));
        V2PlayerDatabase.addFile(fileName, name, buffer, () => {
          this.#current.file = fileName;
          this.show();
        });

        return true;
      })
      .catch((error) => {
        return false;
      });
  }

  setPlayButton(text) {
    this.#playButton.textContent = text || 'Play';
  }

  show() {
    V2PlayerDatabase.getFiles((files) => {
      this.#list.replaceChildren();

      for (const file of files) {
        const highlight = (e) => {
          if (this.#current.element)
            this.#current.element.classList.remove('highlight');

          this.#current.element = e;
          e.classList.add('highlight');
        };

        new V2AppMenu(this.#list, (menu) => {
          menu.element.classList.add('full');

          menu.addElement('button', (e) => {
            e.classList.add('grow');
            e.classList.add('ellipsis');
            e.textContent = file.title;

            if (this.#current.file === file.name)
              highlight(e);

            e.addEventListener('click', () => {
              highlight(e);
              this.app.main.reset();
              this.#current.file = file.name;
              this.app.main.show(file.name, file.buffer);
              this.app.main.play();
            });
          });

          if (this.#remove) {
            menu.addElement('button', (e) => {
              e.classList.add('delete');
              e.classList.add('warn');

              e.addEventListener('click', () => {
                V2PlayerDatabase.deleteFile(file.name, () => {
                  // Remove currently loaded file.
                  if (this.#current.file === file.name)
                    this.app.main.reset();

                  this.show();
                });
              });
            });
          }
        });
      }
    });
  }

  reset() {
    this.#bannerNotify.clear();
    this.setPlayButton();
    this.#remove = false;
    this.#current.file = null;
  }
}
