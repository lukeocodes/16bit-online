/**
 * Quest panel — shows active quests with objectives and progress.
 * Toggled by 'J' key (journal).
 */

export interface QuestObjective {
  description: string;
  current: number;
  target: number;
}

export interface QuestInfo {
  questId: string;
  name: string;
  objectives: QuestObjective[];
  completed: boolean;
}

export class QuestPanel {
  private container: HTMLElement;
  private questList: HTMLElement;
  private visible = false;
  private quests: QuestInfo[] = [];
  private onTurnIn: ((questId: string) => void) | null = null;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute; top: 50%; right: 20px; transform: translateY(-50%);
      width: 280px; max-height: 400px; background: #16213eee; border: 2px solid #444;
      border-radius: 10px; padding: 14px; pointer-events: auto; display: none;
      font-family: 'Segoe UI', system-ui, sans-serif; color: #e0e0e0;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6); overflow-y: auto;
    `;

    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;";
    const title = document.createElement("h3");
    title.textContent = "Quests (J)";
    title.style.cssText = "margin:0; font-size:14px; color:#ffcc44;";
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText = "background:none; border:none; color:#888; font-size:16px; cursor:pointer;";
    closeBtn.onclick = () => this.toggle();
    header.appendChild(title);
    header.appendChild(closeBtn);
    this.container.appendChild(header);

    this.questList = document.createElement("div");
    this.questList.style.cssText = "display:flex; flex-direction:column; gap:8px;";
    this.container.appendChild(this.questList);
  }

  getElement(): HTMLElement { return this.container; }
  setOnTurnIn(handler: (questId: string) => void) { this.onTurnIn = handler; }

  toggle(): void {
    this.visible = !this.visible;
    this.container.style.display = this.visible ? "block" : "none";
    if (this.visible) this.render();
  }

  isVisible(): boolean { return this.visible; }

  updateQuests(quests: QuestInfo[]): void {
    this.quests = quests;
    if (this.visible) this.render();
  }

  private render(): void {
    this.questList.innerHTML = "";

    if (this.quests.length === 0) {
      const empty = document.createElement("div");
      empty.style.cssText = "color:#666; font-size:12px; text-align:center; padding:20px 0;";
      empty.textContent = "No active quests. Talk to NPCs to find quests.";
      this.questList.appendChild(empty);
      return;
    }

    for (const quest of this.quests) {
      const card = document.createElement("div");
      card.style.cssText = `
        background: #0a0a1a88; border: 1px solid ${quest.completed ? "#44cc44" : "#333"};
        border-radius: 6px; padding: 10px;
      `;

      const name = document.createElement("div");
      name.style.cssText = `font-size:13px; font-weight:bold; color:${quest.completed ? "#44cc44" : "#88ddff"}; margin-bottom:6px;`;
      name.textContent = quest.completed ? `✓ ${quest.name}` : quest.name;
      card.appendChild(name);

      for (const obj of quest.objectives) {
        const objEl = document.createElement("div");
        objEl.style.cssText = "font-size:11px; color:#aaa; margin-bottom:3px; display:flex; justify-content:space-between;";
        const desc = document.createElement("span");
        desc.textContent = obj.description;
        const count = document.createElement("span");
        count.style.color = obj.current >= obj.target ? "#44cc44" : "#cccc44";
        count.textContent = `${obj.current}/${obj.target}`;
        objEl.appendChild(desc);
        objEl.appendChild(count);
        card.appendChild(objEl);
      }

      if (quest.completed) {
        const turnInBtn = document.createElement("button");
        turnInBtn.textContent = "Turn In";
        turnInBtn.style.cssText = `
          margin-top:6px; width:100%; padding:4px 0; background:#44cc44; color:#000;
          border:none; border-radius:4px; cursor:pointer; font-size:11px; font-weight:bold;
        `;
        turnInBtn.onclick = () => this.onTurnIn?.(quest.questId);
        card.appendChild(turnInBtn);
      }

      this.questList.appendChild(card);
    }
  }
}
