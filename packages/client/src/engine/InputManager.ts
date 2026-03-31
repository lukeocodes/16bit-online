export interface InputState {
  moveForward: boolean;
  moveBackward: boolean;
  moveLeft: boolean;
  moveRight: boolean;
}

type KeyAction = keyof InputState;

const DEFAULT_BINDINGS: Record<string, KeyAction> = {
  KeyW: "moveForward",
  KeyS: "moveBackward",
  KeyA: "moveLeft",
  KeyD: "moveRight",
  ArrowUp: "moveForward",
  ArrowDown: "moveBackward",
  ArrowLeft: "moveLeft",
  ArrowRight: "moveRight",
};

export class InputManager {
  private state: InputState = {
    moveForward: false,
    moveBackward: false,
    moveLeft: false,
    moveRight: false,
  };

  private bindings: Record<string, KeyAction>;
  private enabled = true;
  private onRightClick: ((screenX: number, screenY: number) => void) | null = null;
  private onLeftClick: ((screenX: number, screenY: number) => void) | null = null;
  private onToggleAutoAttack: (() => void) | null = null;
  private onTabTarget: (() => void) | null = null;
  private onAbilityUse: ((slot: number) => void) | null = null;
  private onToggleInventory: (() => void) | null = null;
  private onToggleQuests: (() => void) | null = null;
  private mouseX = 0;
  private mouseY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.bindings = { ...DEFAULT_BINDINGS };

    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));

    // Reset all keys when window loses focus
    window.addEventListener("blur", () => this.resetAll());

    // Track mouse position
    canvas.addEventListener("pointermove", (e) => {
      this.mouseX = e.offsetX;
      this.mouseY = e.offsetY;
    });

    // Suppress native context menu so right-click is always available for game actions
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    // Use pointerdown for both buttons — fires before any context menu and works
    // reliably on canvas elements across all browsers and input methods
    canvas.addEventListener("pointerdown", (e) => {
      if (!this.enabled) return;
      if (e.button === 0 && this.onLeftClick) {
        this.onLeftClick(e.offsetX, e.offsetY);
      } else if (e.button === 2 && this.onRightClick) {
        this.onRightClick(e.offsetX, e.offsetY);
      }
    });

    // Allow canvas to receive focus
    canvas.tabIndex = 1;
  }

  getState(): Readonly<InputState> {
    return this.state;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) this.resetAll();
  }

  setOnLeftClick(handler: (screenX: number, screenY: number) => void) {
    this.onLeftClick = handler;
  }

  setOnRightClick(handler: (screenX: number, screenY: number) => void) {
    this.onRightClick = handler;
  }

  setOnToggleAutoAttack(handler: () => void) {
    this.onToggleAutoAttack = handler;
  }

  setOnTabTarget(handler: () => void) {
    this.onTabTarget = handler;
  }

  setOnAbilityUse(handler: (slot: number) => void) {
    this.onAbilityUse = handler;
  }

  setOnToggleInventory(handler: () => void) {
    this.onToggleInventory = handler;
  }

  setOnToggleQuests(handler: () => void) {
    this.onToggleQuests = handler;
  }

  getMousePosition(): { x: number; y: number } {
    return { x: this.mouseX, y: this.mouseY };
  }

  rebind(code: string, action: KeyAction) {
    this.bindings[code] = action;
  }

  private onKey(e: KeyboardEvent, pressed: boolean) {
    if (!this.enabled) return;
    // Don't capture input when typing in a text field (chat, etc.)
    const tag = (document.activeElement as HTMLElement)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    // Caps Lock toggles auto-attack (fire on keydown only)
    if (e.code === "CapsLock" && pressed) {
      e.preventDefault();
      if (this.onToggleAutoAttack) this.onToggleAutoAttack();
      return;
    }

    // Number keys 2-6 for ability slots (on keydown only)
    if (pressed && e.code >= "Digit2" && e.code <= "Digit6") {
      const slot = parseInt(e.code.charAt(5)) - 1; // 2→1, 3→2, etc.
      if (this.onAbilityUse) this.onAbilityUse(slot);
      return;
    }

    // I key toggles inventory
    if (e.code === "KeyI" && pressed) {
      if (this.onToggleInventory) this.onToggleInventory();
      return;
    }

    // J key toggles quest journal
    if (e.code === "KeyJ" && pressed) {
      if (this.onToggleQuests) this.onToggleQuests();
      return;
    }

    // Tab cycles through nearby targets
    if (e.code === "Tab" && pressed) {
      e.preventDefault();
      if (this.onTabTarget) this.onTabTarget();
      return;
    }

    const action = this.bindings[e.code];
    if (action) {
      e.preventDefault();
      this.state[action] = pressed;
    }
  }

  private resetAll() {
    this.state.moveForward = false;
    this.state.moveBackward = false;
    this.state.moveLeft = false;
    this.state.moveRight = false;
  }
}
