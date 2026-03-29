import type { Button } from "../emulator/EmulatorAdapter";

type Props = {
  onTap: (button: Button) => void;
};

const buttons: Button[] = [
  "UP",
  "DOWN",
  "LEFT",
  "RIGHT",
  "A",
  "B",
  "START",
  "SELECT",
];

export function Controls({ onTap }: Props) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, minmax(80px, 1fr))",
        gap: 10,
        width: "100%",
        maxWidth: 640,
      }}
    >
      {buttons.map((button) => (
        <button
          key={button}
          onClick={() => onTap(button)}
          style={{
            padding: "14px 12px",
            borderRadius: 12,
            border: "1px solid #303030",
            background: "#171717",
            color: "white",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {button}
        </button>
      ))}
    </div>
  );
}