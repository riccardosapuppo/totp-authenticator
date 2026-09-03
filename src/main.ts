import { bootstrapApplication } from '@angular/platform-browser';

import { AppComponent } from './app/app.component';

/**
 * Nothing here installs a service worker, and this makes sure nothing has.
 *
 * A service worker outlives the version that installed it and the page that
 * registered it: it goes on answering from its own cache long after the code
 * that put it there is gone. This runs on `localhost:4200`, an origin shared
 * with every other thing anybody has ever developed on that port — so a worker
 * left by an unrelated project can serve a page this application no longer has,
 * and can hold an old bundle in front of a vault whose format has moved on. The
 * symptom is a stale screen that only Ctrl+F5 fixes, which sends people looking
 * at caching headers that were right all along.
 */
if ('serviceWorker' in navigator) {
  void navigator.serviceWorker
    .getRegistrations()
    .then((workers) => Promise.all(workers.map((one) => one.unregister())))
    .then(async (undone) => {
      if (undone.length > 0) console.info(`unregistered ${undone.length} service worker(s) left on this origin`);
      if (!('caches' in globalThis)) return;

      const names = await caches.keys();
      await Promise.all(names.map((one) => caches.delete(one)));
    })
    .catch(() => {
      /* a browser that will not say has nothing for us to undo */
    });
}

bootstrapApplication(AppComponent).catch((error: unknown) => console.error(error));

