import { useState, type FormEvent } from "react";

export function LoginView({
  error,
  onSubmit,
}: {
  error: string;
  onSubmit: (pin: string) => Promise<boolean>;
}) {
  const [pin, setPin] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const ok = await onSubmit(pin);
    if (ok) setPin("");
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="kicker">ATE POWER HMI</div>
        <h1>Operator sign-in</h1>
        <p>LAN console for Keysight N5746A DCPS and AC6803B ACPS. PIN required.</p>
        <label>
          PIN
          <input
            type="password"
            value={pin}
            onChange={(ev) => setPin(ev.target.value)}
            autoFocus
            autoComplete="current-password"
          />
        </label>
        {error ? <div className="error">{error}</div> : null}
        <button type="submit">Enter console</button>
      </form>
    </div>
  );
}
