self.addEventListener("install", (event) => {
  event.waitUntil(
    fetch(new Request("/", { cache: "reload", credentials: "same-origin" }))
      .then((response) => {
        if (!response.ok) return;
        return caches.open("rakkasei-pages").then((cache) => cache.put("/", response));
      })
      .catch(() => undefined),
  );
});
