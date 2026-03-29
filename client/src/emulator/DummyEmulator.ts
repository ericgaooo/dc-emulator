import type { Button, EmulatorAdapter } from "./EmulatorAdapter";

export class DummyEmulator implements EmulatorAdapter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private romName = "No ROM loaded";
  private x = 80;
  private y = 72;
  private pressed = new Set<Button>();

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = 160;
    this.canvas.height = 144;

    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create canvas context");
    this.ctx = ctx;

    this.draw();
  }

  async loadRom(_data: Uint8Array, fileName: string): Promise<void> {
    this.romName = fileName;
    this.x = 80;
    this.y = 72;
    this.draw();
  }

  press(button: Button) {
    this.pressed.add(button);
  }

  release(button: Button) {
    this.pressed.delete(button);
  }

  frame() {
    if (this.pressed.has("LEFT")) this.x -= 1;
    if (this.pressed.has("RIGHT")) this.x += 1;
    if (this.pressed.has("UP")) this.y -= 1;
    if (this.pressed.has("DOWN")) this.y += 1;

    this.x = Math.max(6, Math.min(154, this.x));
    this.y = Math.max(10, Math.min(138, this.y));

    this.draw();
  }

  getFrameCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  async saveState(): Promise<string> {
    return JSON.stringify({
      romName: this.romName,
      x: this.x,
      y: this.y,
    });
  }

  async loadState(state: string): Promise<void> {
    const parsed = JSON.parse(state);
    this.romName = parsed.romName ?? this.romName;
    this.x = parsed.x ?? this.x;
    this.y = parsed.y ?? this.y;
    this.draw();
  }

  getStatus(): string {
    return this.romName;
  }

  private draw() {
    const { ctx } = this;

    ctx.fillStyle = "#d9f7be";
    ctx.fillRect(0, 0, 160, 144);

    ctx.fillStyle = "#a0d911";
    for (let y = 0; y < 144; y += 16) {
      for (let x = 0; x < 160; x += 16) {
        if ((x + y) % 32 === 0) ctx.fillRect(x, y, 16, 16);
      }
    }

    ctx.fillStyle = "#1f1f1f";
    ctx.font = "8px monospace";
    ctx.fillText("Discord Activity Emulator Shell", 6, 10);
    ctx.fillText(this.romName, 6, 22);

    ctx.fillStyle = "#1677ff";
    ctx.fillRect(this.x - 4, this.y - 4, 8, 8);

    ctx.fillStyle = "#262626";
    ctx.fillText("Use arrow keys + Z/X + Enter/Shift", 6, 138);
  }
}