type StarCallback = () => void;
let _callback: StarCallback | null = null;

export const starEvents = {
  register(cb: StarCallback) { _callback = cb; },
  unregister() { _callback = null; },
  fire() { _callback?.(); },
};
