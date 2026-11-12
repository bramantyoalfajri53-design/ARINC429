import { useEffect, useRef, useState } from "react";

export function SetpointInput(props: {
  value: number;
  disabled: boolean;
  step: string;
  min: number;
  max: number;
  onCommit: (n: number) => void;
}) {
  const [text, setText] = useState(String(props.value));
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(String(props.value));
  }, [props.value]);
  return (
    <input
      type="number"
      step={props.step}
      min={props.min}
      max={props.max}
      disabled={props.disabled}
      value={text}
      onFocus={() => {
        focused.current = true;
      }}
      onChange={(ev) => setText(ev.target.value)}
      onBlur={() => {
        focused.current = false;
        const n = Number(text);
        if (!Number.isNaN(n)) props.onCommit(n);
      }}
    />
  );
}

