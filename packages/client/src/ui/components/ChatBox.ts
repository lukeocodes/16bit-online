/**
 * Chat box — MMO-style text chat.
 * Enter to focus input, type message, Enter to send.
 * Messages scroll in a translucent box at bottom-left.
 */

const MAX_MESSAGES = 50;
const FADE_AFTER_MS = 8000;

interface ChatMessage {
  senderName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export class ChatBox {
  private container: HTMLElement | null = null;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private messages: ChatMessage[] = [];
  private onSend: ((text: string) => void) | null = null;
  private isFocused = false;
  private enterHandler: ((e: KeyboardEvent) => void) | null = null;

  setOnSend(handler: (text: string) => void) {
    this.onSend = handler;
  }

  /** Returns true if the chat input is focused (should suppress game input) */
  isInputFocused(): boolean {
    return this.isFocused;
  }

  render(): HTMLElement {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; bottom: 70px; left: 12px;
      width: 320px; pointer-events: auto;
    `;

    // Messages area
    this.messagesEl = document.createElement("div");
    this.messagesEl.style.cssText = `
      max-height: 160px; overflow-y: auto; padding: 6px 8px;
      background: rgba(0, 0, 0, 0.4); border-radius: 6px 6px 0 0;
      font-family: monospace; font-size: 12px; line-height: 1.5;
      scrollbar-width: thin; scrollbar-color: #555 transparent;
    `;
    this.container.appendChild(this.messagesEl);

    // Input
    this.inputEl = document.createElement("input");
    this.inputEl.type = "text";
    this.inputEl.placeholder = "Press Enter to chat...";
    this.inputEl.maxLength = 200;
    this.inputEl.style.cssText = `
      width: 100%; box-sizing: border-box; padding: 6px 8px;
      background: rgba(0, 0, 0, 0.6); border: 1px solid #444;
      border-radius: 0 0 6px 6px; color: #e0e0e0;
      font-family: monospace; font-size: 12px; outline: none;
    `;

    this.inputEl.addEventListener("focus", () => {
      this.isFocused = true;
      this.inputEl!.placeholder = "Type message...";
      this.inputEl!.style.borderColor = "#888";
    });

    this.inputEl.addEventListener("blur", () => {
      this.isFocused = false;
      this.inputEl!.placeholder = "Press Enter to chat...";
      this.inputEl!.style.borderColor = "#444";
    });

    this.inputEl.addEventListener("keydown", (e) => {
      e.stopPropagation(); // Prevent WASD movement while typing

      if (e.key === "Enter") {
        const text = this.inputEl!.value.trim();
        if (text.length > 0 && this.onSend) {
          this.onSend(text);
          this.inputEl!.value = "";
        }
        this.inputEl!.blur();
      } else if (e.key === "Escape") {
        this.inputEl!.value = "";
        this.inputEl!.blur();
      }
    });

    this.container.appendChild(this.inputEl);

    // Global Enter key to focus chat
    this.enterHandler = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !this.isFocused && this.inputEl) {
        e.preventDefault();
        this.inputEl.focus();
      }
    };
    window.addEventListener("keydown", this.enterHandler);

    // Add welcome message
    this.addSystemMessage("Welcome! Press Enter to chat.");

    return this.container;
  }

  addMessage(senderName: string, text: string) {
    this.messages.push({ senderName, text, timestamp: Date.now(), isSystem: false });
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    this.renderMessages();
  }

  addSystemMessage(text: string) {
    this.messages.push({ senderName: "", text, timestamp: Date.now(), isSystem: true });
    if (this.messages.length > MAX_MESSAGES) this.messages.shift();
    this.renderMessages();
  }

  private renderMessages() {
    if (!this.messagesEl) return;
    const now = Date.now();

    this.messagesEl.innerHTML = "";
    for (const msg of this.messages) {
      const el = document.createElement("div");
      const age = now - msg.timestamp;
      const opacity = age > FADE_AFTER_MS ? 0.4 : 1;

      if (msg.isSystem) {
        el.style.cssText = `color: #999; font-style: italic; opacity: ${opacity};`;
        el.textContent = msg.text;
      } else {
        el.style.cssText = `color: #e0e0e0; opacity: ${opacity};`;
        const nameSpan = document.createElement("span");
        nameSpan.textContent = `${msg.senderName}: `;
        nameSpan.style.cssText = "color: #5dade2; font-weight: bold;";
        el.appendChild(nameSpan);
        el.appendChild(document.createTextNode(msg.text));
      }

      this.messagesEl.appendChild(el);
    }

    // Auto-scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  dispose() {
    if (this.enterHandler) {
      window.removeEventListener("keydown", this.enterHandler);
    }
    this.container = null;
    this.messagesEl = null;
    this.inputEl = null;
    this.messages = [];
  }
}
