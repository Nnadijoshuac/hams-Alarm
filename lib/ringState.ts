/** Which ring session the ring screen is currently showing (prevents opening it twice). */
let openKey: string | null = null;

export const ringScreen = {
  get openKey() {
    return openKey;
  },
  open(key: string) {
    openKey = key;
  },
  close(key: string) {
    if (openKey === key) openKey = null;
  },
};
