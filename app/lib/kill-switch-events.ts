type KillCallback = () => void;
let _cb: KillCallback | null = null;

export const killSwitchEvents = {
  register(cb: KillCallback) { _cb = cb; },
  unregister() { _cb = null; },
  fire() { _cb?.(); },
};
