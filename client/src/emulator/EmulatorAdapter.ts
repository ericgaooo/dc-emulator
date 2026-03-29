export type Button =
  | "UP"
  | "DOWN"
  | "LEFT"
  | "RIGHT"
  | "A"
  | "B"
  | "START"
  | "SELECT";

export interface EmulatorAdapter {
  loadRom(data: Uint8Array, fileName: string): Promise<void>;
  press(button: Button): void;
  release(button: Button): void;
  frame(): void;
  getFrameCanvas(): HTMLCanvasElement;
  saveState(): Promise<string>;
  loadState(state: string): Promise<void>;
  getStatus(): string;
}