import { useEffect, useMemo, useState } from "react";
import type { TelemetryFrame, TelemetryListener } from "../../../shared";
import { AC_CHART_COLORS, DC_CHART_COLORS, HISTORY_BUFFER_LEN } from "../config";
import type { ChartSeries } from "../types";

type PowerHistoryState = {
  dcV: number[];
  dcI: number[];
  acV: number[];
  acP: number[];
};

const EMPTY_HISTORY: PowerHistoryState = {
  dcV: [],
  dcI: [],
  acV: [],
  acP: [],
};

function appendSample(buf: number[], value: number): number[] {
  const next = buf.length >= HISTORY_BUFFER_LEN ? buf.slice(1) : [...buf];
  next.push(value);
  return next;
}

export function usePowerTelemetryHistory(
  subscribeTelemetry: (listener: TelemetryListener) => () => void,
) {
  const [history, setHistory] = useState<PowerHistoryState>(EMPTY_HISTORY);

  useEffect(() => {
    return subscribeTelemetry((data: TelemetryFrame) => {
      setHistory((prev) => ({
        dcV: appendSample(prev.dcV, data.dc?.voltage ?? 0),
        dcI: appendSample(prev.dcI, data.dc?.current ?? 0),
        acV: appendSample(prev.acV, data.ac?.v_rms ?? 0),
        acP: appendSample(prev.acP, data.ac?.power_watts ?? 0),
      }));
    });
  }, [subscribeTelemetry]);

  const dcCharts: ChartSeries[] = useMemo(
    () => [
      { color: DC_CHART_COLORS.voltage, values: history.dcV },
      { color: DC_CHART_COLORS.current, values: history.dcI },
    ],
    [history.dcV, history.dcI],
  );

  const acCharts: ChartSeries[] = useMemo(
    () => [
      { color: AC_CHART_COLORS.vRms, values: history.acV },
      { color: AC_CHART_COLORS.powerWatts, values: history.acP },
    ],
    [history.acV, history.acP],
  );

  return { dcCharts, acCharts };
}

