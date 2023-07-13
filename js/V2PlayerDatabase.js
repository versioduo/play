// © Kay Sievers <kay@versioduo.com>, 2019-2022
// SPDX-License-Identifier: Apache-2.0

class V2PlayerDatabase {
  static #getStore(store, handler) {
    const request = window.indexedDB.open('play', 3);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files'))
        db.createObjectStore('files', {
          keyPath: 'name'
        });

      if (!db.objectStoreNames.contains('instruments'))
        db.createObjectStore('instruments', {
          keyPath: 'name'
        });

      if (!db.objectStoreNames.contains('devices'))
        db.createObjectStore('devices', {
          keyPath: 'name'
        });
    };

    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(store, 'readwrite');
      transaction.oncomplete = () => {
        db.close();
      };

      if (handler)
        handler(transaction.objectStore(store));
    };
  }

  static addFile(name, title, buffer, handler) {
    this.#getStore('files', (store) => {
      store.put({
        name: name,
        title: title,
        buffer: buffer
      }).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }

  static getFiles(handler) {
    const files = [];

    this.#getStore('files', (store) => {
      store.openCursor().onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          files.push(cursor.value);
          cursor.continue();

        } else
          handler(files);
      };
    });
  }

  static deleteFile(name, handler) {
    this.#getStore('instruments', (store) => {
      store.delete(name);
    });

    this.#getStore('files', (store) => {
      store.delete(name).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }

  static getInstruments(name, handler) {
    this.#getStore('instruments', (store) => {
      const request = store.get(name);
      request.onsuccess = () => {
        if (request.result && request.result.tracks)
          handler(request.result.tracks);
      };
    });
  }

  static addInstruments(name, tracks, handler) {
    this.#getStore('instruments', (store) => {
      store.put({
        name: name,
        tracks: tracks
      }).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }

  static deleteInstruments(name, handler) {
    this.#getStore('instruments', (store) => {
      store.delete(name).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }

  static getDevices(name, handler) {
    this.#getStore('devices', (store) => {
      const request = store.get(name);
      request.onsuccess = () => {
        if (request.result && request.result.data)
          handler(request.result.data);
      };
    });
  }

  static addDevices(name, data, handler) {
    this.#getStore('devices', (store) => {
      store.put({
        name: name,
        data: data
      }).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }

  static deleteDevices(name, handler) {
    this.#getStore('devices', (store) => {
      store.delete(name).onsuccess = () => {
        if (handler)
          handler();
      };
    });
  }
}
