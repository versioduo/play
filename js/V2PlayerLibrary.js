class V2PlayerLibrary extends V2WebModule {
  #player = null;
  #bannerNotify = null;
  #playButton = null;
  #element = null;
  #list = null;
  #remove = false;
  #current = Object.seal({
    element: null,
    file: null
  });

  constructor(player) {
    super('library', '--book-open-reader', 'Library', 'Play, Add, Remove Music');
    this.attach();

    this.#player = player;
    this.#bannerNotify = new V2WebNotify(this.canvas);

    V2Web.addElement(this.canvas, 'div', (e) => {
      this.#element = e;
    });

    new V2WebMenu(this.#element, (menu) => {
      menu.addElement('button', (e) => {
        e.textContent = 'Load';
        e.addEventListener('click', () => {
          this.#openFile();
        });

        V2Web.addFileDrop(e, this.#element, ['warn'], (file) => {
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
          this.#player.stop();
        });
      });

      menu.addElement('button', (e) => {
        this.#playButton = e;
        e.classList.add('primary');
        e.textContent = 'Play';
        e.classList.add('enabled');
        e.addEventListener('click', () => {
          this.#player.play();
        });
      });
    });

    V2Web.addElement(this.#element, 'div', (e) => {
      this.#list = e;
    });

    return Object.seal(this);
  }

  getNotify() {
    return this.#bannerNotify;
  }

  #readFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      this.#player.reset();

      if (!this.#player.show(file.name, reader.result))
        return;

      const title = this.#player.getTitle() || file.name.substr(0, file.name.lastIndexOf('.'));
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
        if (!this.#player.show(url, buffer))
          return;

        const fileName = url.substr(url.lastIndexOf('/') + 1);
        const name = this.#player.getTitle() || fileName.substr(0, fileName.lastIndexOf('.'));
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
      while (this.#list.firstChild)
        this.#list.firstChild.remove();

      for (const file of files) {
        const highlight = (e) => {
          if (this.#current.element)
            this.#current.element.classList.remove('highlight');

          this.#current.element = e;
          e.classList.add('highlight');
        };

        new V2WebMenu(this.#list, (menu) => {
          menu.element.classList.add('full');

          menu.addElement('button', (e) => {
            e.classList.add('grow');
            e.classList.add('ellipsis');
            e.textContent = file.title;

            if (this.#current.file === file.name)
              highlight(e);

            e.addEventListener('click', () => {
              highlight(e);
              this.#player.reset();
              this.#current.file = file.name;
              this.#player.show(file.name, file.buffer);
              this.#player.play();
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
                    this.#player.reset();

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
