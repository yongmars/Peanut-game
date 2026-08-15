if (location.protocol === "https:" && "serviceWorker" in navigator) {
  let registration;

  const update = () => registration?.update().catch(() => undefined);

  navigator.serviceWorker
    .register("/sw.js", { scope: "/", updateViaCache: "none" })
    .then((currentRegistration) => {
      registration = currentRegistration;
      update();
    })
    .catch((error) => {
      console.warn("Service worker registration failed", error);
    });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") update();
  });
}
