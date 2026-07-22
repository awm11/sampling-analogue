import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Tooltip,
} from "recharts";

export default function SamplingDemo() {
  const [bitDepth, setBitDepth] = useState(4);
  const [samplingRate, setSamplingRate] = useState(16);
  const [signalType, setSignalType] = useState("composite");

  const levels = Math.pow(2, bitDepth);
  const maxIndex = levels - 1;

  // Keep binary-friendly tick spacing
  const tickStep = Math.max(2, Math.pow(2, bitDepth - 2));

  const quantizationTicks = Array.from(
    { length: levels / tickStep + 1 },
    (_, i) => i * tickStep
  );

  // Signal generator
  const analogueSignal = (t) => {
    switch (signalType) {
      case "sine":
        return (
          Math.sin(2 * Math.PI * 2 * t) + 1
        ) / 2;

      case "square":
        return Math.sin(2 * Math.PI * 2 * t) >= 0
          ? 1
          : 0;

      case "triangle":
        return (
          0.5 *
          (1 +
            (2 *
              Math.abs(
                2 *
                  (t -
                    Math.floor(t + 0.5))
              ) -
              1))
        );

      case "sawtooth":
        return (t * 2) % 1;
      
      case "composite2":
        const yRaw2 =
          0.6 * Math.sin(2 * Math.PI * 2 * t) +
          0.3 * Math.sin(2 * Math.PI * 6 * t);

        return (yRaw2 + 1) / 2;

      case "composite":
      default:
        const yRaw =
          0.7 * Math.sin(2 * Math.PI * 2 * t) +
          0.25 * Math.sin(2 * Math.PI * 7 * t);

        return (yRaw + 1) / 2;
    }
  };

  // Analogue waveform
  const analogueData = useMemo(() => {
    const pts = [];

    for (let i = 0; i <= 1000; i++) {
      const t = i / 1000;

      pts.push({
        t,
        y: analogueSignal(t),
      });
    }

    return pts;
  }, [signalType]);

  // Sampled and quantised waveform
  const sampledData = useMemo(() => {
    const samples = [];

    for (let i = 0; i < samplingRate; i++) {
      const t = i / (samplingRate - 1);

      const analogueValue = analogueSignal(t);

      const quantizedIndex = Math.round(
        analogueValue * maxIndex
      );

      samples.push({
        t,
        y: quantizedIndex,
      });
    }

    return samples;
  }, [samplingRate, maxIndex, signalType]);

  // Sample-and-hold staircase
  const stairData = useMemo(() => {
    const pts = [];

    for (let i = 0; i < sampledData.length - 1; i++) {
      pts.push(sampledData[i]);

      pts.push({
        t: sampledData[i + 1].t,
        y: sampledData[i].y,
      });
    }

    pts.push(sampledData[sampledData.length - 1]);

    return pts;
  }, [sampledData]);
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>

      <h2>Sampling & Quantization Demo</h2>

      <div
        style={{
          display: "flex",
          gap: 40,
          marginBottom: 24,
        }}
      >

        {/* Signal selector */}
        <div>
          <label>
            Signal:
          </label>

          <br />

          <select
            value={signalType}
            onChange={(e) =>
              setSignalType(e.target.value)
            }
          >
            <option value="composite">
              Composite wave
            </option>

            <option value="composite2">
              Composite wave 2
            </option>

            <option value="sine">
              Sine wave
            </option>

            <option value="square">
              Square wave
            </option>

            <option value="triangle">
              Triangle wave
            </option>

            <option value="sawtooth">
              Sawtooth wave
            </option>

          </select>
        </div>


        <div>
          <label>
            Bit Depth: <b>{bitDepth} bits</b>
          </label>

          <br />

          <input
            type="range"
            min="1"
            max="8"
            value={bitDepth}
            onChange={(e) =>
              setBitDepth(Number(e.target.value))
            }
            style={{ width: 250 }}
          />

          <div>
            {levels} quantization levels
          </div>
        </div>


        <div>
          <label>
            Sampling rate (kHz): <b>{samplingRate}</b>
          </label>

          <br />

          <input
            type="range"
            min="4"
            max="64"
            value={samplingRate}
            onChange={(e) =>
              setSamplingRate(Number(e.target.value))
            }
            style={{ width: 250 }}
          />
        </div>

      </div>


      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 60,
          height: 420,
        }}
      >

        {/* Analogue signal */}
        <div>

          <h3>
            Analogue Signal
          </h3>

          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{
              background: "white",
              padding: 10,
              borderRadius: 8,
            }}
          >

            <LineChart data={analogueData}>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 1]}
                label={{
                  value: "time (ms)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />

              <YAxis
                domain={[0, 1]}
              />

              <Tooltip />

              <Line
                type="monotone"
                dataKey="y"
                dot={false}
                strokeWidth={2}
              />

            </LineChart>

          </ResponsiveContainer>

        </div>



        {/* Quantised signal */}
        <div>
          <h3>
            Sampled Signal (Quantized Index)
          </h3>


          <ResponsiveContainer
            width="100%"
            height="100%"
            style={{
              background: "white",
              padding: 10,
              borderRadius: 8,
            }}
          >

            <ScatterChart>

              <CartesianGrid
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="t"
                type="number"
                domain={[0, 1]}
                label={{
                  value: "time (ms)",
                  position: "insideBottom",
                  offset: -5,
                }}
              />


              <YAxis
                domain={[0, levels]}
                ticks={quantizationTicks}
                allowDecimals={false}
              />


              <Tooltip />


              <Line
                data={stairData}
                type="stepAfter"
                dataKey="y"
                dot={false}
                strokeWidth={2}
              />


              <Scatter
                data={sampledData}
              />


            </ScatterChart>

          </ResponsiveContainer>

        </div>

      </div>

    </div>
  );
}