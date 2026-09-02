import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TWO_PI = Math.PI * 2
const DEFAULTS = { signalType: 'composite', bitDepth: 4, samplingRate: 16 }

const SIGNALS = {
  composite: {
    label: '2 + 7 kHz composite',
    shortLabel: '2 + 7 kHz',
    detail: 'Two sine waves reveal aliasing clearly.',
    frequencies: [2, 7],
    highestFrequency: 7,
  },
  composite2: {
    label: '3 + 5 kHz composite',
    shortLabel: '3 + 5 kHz',
    detail: 'A gentler two-frequency signal.',
    frequencies: [3, 5],
    highestFrequency: 5,
  },
  sine: {
    label: '2 kHz sine wave',
    shortLabel: '2 kHz sine',
    detail: 'A single, band-limited frequency.',
    frequencies: [2],
    highestFrequency: 2,
  },
  square: {
    label: '2 kHz square wave',
    shortLabel: '2 kHz square',
    detail: 'Sharp edges contain many harmonics.',
    frequencies: [2],
    fundamental: 2,
    harmonics: true,
  },
  triangle: {
    label: '2 kHz triangle wave',
    shortLabel: '2 kHz triangle',
    detail: 'Straight edges add weaker harmonics.',
    frequencies: [2],
    fundamental: 2,
    harmonics: true,
  },
  sawtooth: {
    label: '2 kHz sawtooth wave',
    shortLabel: '2 kHz sawtooth',
    detail: 'A discontinuity produces strong harmonics.',
    frequencies: [2],
    fundamental: 2,
    harmonics: true,
  },
}

const STAGES = [
  { id: 1, label: 'Source', hint: 'Continuous signal' },
  { id: 2, label: 'Sample', hint: 'Measure in time' },
  { id: 3, label: 'Quantise', hint: 'Round and encode' },
]

const PRESETS = [
  {
    id: 'aliasing',
    title: 'Reveal aliasing',
    description: '10 kHz sampling cannot preserve the 7 kHz component.',
    values: { signalType: 'composite', samplingRate: 10, bitDepth: 8 },
  },
  {
    id: 'coarse',
    title: 'Coarse quantisation',
    description: 'A clean sine wave squeezed into only four levels.',
    values: { signalType: 'sine', samplingRate: 32, bitDepth: 2 },
  },
  {
    id: 'clear',
    title: 'Clear digital copy',
    description: 'Plenty of samples and amplitude levels.',
    values: { signalType: 'composite', samplingRate: 32, bitDepth: 8 },
  },
]

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function signalValue(type, timeMs) {
  if (type === 'sine') return 0.5 + 0.43 * Math.sin(TWO_PI * 2 * timeMs)
  if (type === 'square') return Math.sin(TWO_PI * 2 * timeMs) >= 0 ? 0.9 : 0.1

  if (type === 'triangle') {
    const phase = 2 * timeMs
    const triangle = 2 * Math.abs(2 * (phase - Math.floor(phase + 0.5))) - 1
    return 0.5 + 0.4 * triangle
  }

  if (type === 'sawtooth') {
    const phase = ((2 * timeMs) % 1 + 1) % 1
    return 0.1 + 0.8 * phase
  }

  if (type === 'composite2') {
    return clamp(
      0.5 +
        0.28 * Math.sin(TWO_PI * 3 * timeMs) +
        0.18 * Math.sin(TWO_PI * 5 * timeMs),
    )
  }

  return clamp(
    0.5 +
      0.34 * Math.sin(TWO_PI * 2 * timeMs) +
      0.14 * Math.sin(TWO_PI * 7 * timeMs),
  )
}

function quantise(value, maxIndex) {
  const index = Math.round(clamp(value) * maxIndex)
  return { index, value: index / maxIndex }
}

function sinc(value) {
  if (Math.abs(value) < 1e-8) return 1
  return Math.sin(Math.PI * value) / (Math.PI * value)
}

function formatNumber(value, digits = 2) {
  return Number(value.toFixed(digits)).toString()
}

function useCompactChart() {
  const [compact, setCompact] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 700px)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(max-width: 700px)')
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return compact
}

function createLinePath(data, x, y, key = 'value') {
  return data
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.t)} ${y(point[key])}`)
    .join(' ')
}

function SamplingChart({
  analogueData,
  sampledData,
  reconstructedData,
  activeStage,
  levels,
  showLevels,
  showReconstruction,
  inspectedSample,
  signalLabel,
}) {
  const compact = useCompactChart()
  const width = compact ? 700 : 1100
  const height = compact ? 560 : 520
  const margin = compact
    ? { top: 42, right: 28, bottom: 76, left: 76 }
    : { top: 36, right: 40, bottom: 62, left: 74 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = height - margin.top - margin.bottom
  const x = (time) => margin.left + time * plotWidth
  const y = (value) => margin.top + (1 - value) * plotHeight
  const xTicks = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1]
  const yTicks = [0, 0.25, 0.5, 0.75, 1]
  const analoguePath = createLinePath(analogueData, x, y)
  const reconstructedPath = createLinePath(reconstructedData, x, y)

  const staircasePath = sampledData.reduce((path, sample, index) => {
    const nextTime = index < sampledData.length - 1 ? sampledData[index + 1].t : 1
    const start = index === 0 ? `M ${x(sample.t)} ${y(sample.quantisedValue)}` : ''
    const horizontal = `L ${x(nextTime)} ${y(sample.quantisedValue)}`
    const vertical =
      index < sampledData.length - 1
        ? `L ${x(nextTime)} ${y(sampledData[index + 1].quantisedValue)}`
        : ''
    return `${path} ${start} ${horizontal} ${vertical}`
  }, '')

  const lineEvery = Math.max(1, Math.ceil((levels - 1) / 16))
  const levelIndexes = Array.from({ length: levels }, (_, index) => index).filter(
    (index) => index % lineEvery === 0 || index === levels - 1,
  )

  return (
    <div className="chart-shell">
      <div className="chart-legend" aria-label="Chart legend">
        <span><i className="legend-line analogue" />Analogue</span>
        {activeStage >= 2 && <span><i className="legend-dot sampled" />Samples</span>}
        {activeStage >= 3 && <span><i className="legend-line quantised" />Quantised</span>}
        {activeStage >= 3 && showReconstruction && (
          <span><i className="legend-line reconstructed" />Reconstructed estimate</span>
        )}
      </div>

      <svg
        className="sampling-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-labelledby="sampling-chart-title sampling-chart-description"
      >
        <title id="sampling-chart-title">Sampling and quantisation of {signalLabel}</title>
        <desc id="sampling-chart-description">
          The analogue waveform is shown against time. Sampling markers, quantised levels, and a
          reconstructed estimate appear as the learning stages are selected.
        </desc>

        <rect className="plot-background" x={margin.left} y={margin.top} width={plotWidth} height={plotHeight} rx="18" />

        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line className="grid-line major" x1={margin.left} x2={width - margin.right} y1={y(tick)} y2={y(tick)} />
            <text className="axis-tick" x={margin.left - 18} y={y(tick) + 5} textAnchor="end">
              {formatNumber(tick, 2)}
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line className="grid-line major" x1={x(tick)} x2={x(tick)} y1={margin.top} y2={height - margin.bottom} />
            <text className="axis-tick" x={x(tick)} y={height - margin.bottom + 30} textAnchor="middle">
              {formatNumber(tick, 2)}
            </text>
          </g>
        ))}

        {activeStage >= 3 && showLevels && levelIndexes.map((index) => {
          const value = index / (levels - 1)
          return <line key={`level-${index}`} className="quantisation-level" x1={margin.left} x2={width - margin.right} y1={y(value)} y2={y(value)} />
        })}

        <text className="axis-label" x={margin.left + plotWidth / 2} y={height - 12} textAnchor="middle">Time / ms</text>
        <text className="axis-label" transform={`translate(22 ${margin.top + plotHeight / 2}) rotate(-90)`} textAnchor="middle">Normalised amplitude</text>

        <path className="wave-path analogue-path" d={analoguePath} />

        {activeStage >= 2 && sampledData.map((sample, index) => (
          <g key={`sample-${index}`}>
            <line className="sample-stem" x1={x(sample.t)} x2={x(sample.t)} y1={y(0)} y2={y(sample.analogueValue)} />
            <circle className="sample-point" cx={x(sample.t)} cy={y(sample.analogueValue)} r={compact ? 6 : 5} />
          </g>
        ))}

        {activeStage >= 3 && (
          <>
            <path className="wave-path quantised-path" d={staircasePath} />
            {sampledData.map((sample, index) => (
              <g key={`quantised-${index}`}>
                <line className="error-line" x1={x(sample.t)} x2={x(sample.t)} y1={y(sample.analogueValue)} y2={y(sample.quantisedValue)} />
                <circle className="quantised-point" cx={x(sample.t)} cy={y(sample.quantisedValue)} r={compact ? 6.5 : 5.5} />
              </g>
            ))}
            {showReconstruction && <path className="wave-path reconstructed-path" d={reconstructedPath} />}
          </>
        )}

        {sampledData[inspectedSample] && activeStage >= 2 && (
          <g className="inspection-marker">
            <line x1={x(sampledData[inspectedSample].t)} x2={x(sampledData[inspectedSample].t)} y1={margin.top - 10} y2={height - margin.bottom + 10} />
            <rect
              x={Math.min(width - margin.right - 94, Math.max(margin.left, x(sampledData[inspectedSample].t) - 47))}
              y={margin.top - 28}
              width="94"
              height="28"
              rx="14"
            />
            <text
              x={Math.min(width - margin.right - 47, Math.max(margin.left + 47, x(sampledData[inspectedSample].t)))}
              y={margin.top - 9}
              textAnchor="middle"
            >
              sample {inspectedSample + 1}
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

function ErrorPlot({ sampledData }) {
  const compact = useCompactChart()
  const width = compact ? 700 : 1000
  const height = 150
  const left = 16
  const right = 16
  const middle = 72
  const plotWidth = width - left - right
  const largestError = Math.max(...sampledData.map((sample) => Math.abs(sample.error)), 0.001)
  const scale = 48 / largestError
  const barWidth = Math.max(2, Math.min(14, (plotWidth / sampledData.length) * 0.55))

  return (
    <svg className="error-plot" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Quantisation error for every sample">
      <line className="error-zero" x1={left} x2={width - right} y1={middle} y2={middle} />
      {sampledData.map((sample, index) => {
        const x = left + ((index + 0.5) / sampledData.length) * plotWidth
        const barHeight = Math.abs(sample.error) * scale
        const y = sample.error >= 0 ? middle - barHeight : middle
        return (
          <rect
            key={`error-${index}`}
            className={sample.error >= 0 ? 'error-bar positive' : 'error-bar negative'}
            x={x - barWidth / 2}
            y={y}
            width={barWidth}
            height={Math.max(1.5, barHeight)}
            rx="2"
          />
        )
      })}
      <text className="error-label" x={left} y="22">Quantised − analogue</text>
      <text className="error-label muted" x={width - right} y={middle - 8} textAnchor="end">0 error</text>
      <text className="error-label muted" x={width - right} y={height - 10} textAnchor="end">sample number →</text>
    </svg>
  )
}

function StatusBadge({ tone, children }) {
  return <span className={`status-badge ${tone}`}>{children}</span>
}

export default function SamplingDemo() {
  const [bitDepth, setBitDepth] = useState(DEFAULTS.bitDepth)
  const [samplingRate, setSamplingRate] = useState(DEFAULTS.samplingRate)
  const [signalType, setSignalType] = useState(DEFAULTS.signalType)
  const [activeStage, setActiveStage] = useState(3)
  const [showLevels, setShowLevels] = useState(true)
  const [showReconstruction, setShowReconstruction] = useState(true)
  const [inspectedSample, setInspectedSample] = useState(3)

  const levels = 2 ** bitDepth
  const maxIndex = levels - 1
  const signal = SIGNALS[signalType]

  const analogueData = useMemo(
    () => Array.from({ length: 701 }, (_, index) => {
      const t = index / 700
      return { t, value: signalValue(signalType, t) }
    }),
    [signalType],
  )

  const sampledData = useMemo(
    () => Array.from({ length: samplingRate }, (_, index) => {
      const t = index / samplingRate
      const analogueValue = signalValue(signalType, t)
      const quantised = quantise(analogueValue, maxIndex)
      return {
        t,
        analogueValue,
        quantisedValue: quantised.value,
        quantisedIndex: quantised.index,
        error: quantised.value - analogueValue,
        binary: quantised.index.toString(2).padStart(bitDepth, '0'),
      }
    }),
    [bitDepth, maxIndex, samplingRate, signalType],
  )

  const reconstructedData = useMemo(() => {
    const supportSamples = Array.from({ length: samplingRate * 3 }, (_, index) => {
      const sampleIndex = index - samplingRate
      const t = sampleIndex / samplingRate
      const value = quantise(signalValue(signalType, t), maxIndex).value
      return { t, value }
    })

    return Array.from({ length: 401 }, (_, index) => {
      const t = index / 400
      const value = supportSamples.reduce(
        (sum, sample) => sum + sample.value * sinc((t - sample.t) * samplingRate),
        0,
      )
      return { t, value: clamp(value, -0.08, 1.08) }
    })
  }, [maxIndex, samplingRate, signalType])

  const quantisationStep = 1 / maxIndex
  const samplePeriodMicroseconds = 1000 / samplingRate
  const maximumError = Math.max(...sampledData.map((sample) => Math.abs(sample.error)))
  const meanError = sampledData.reduce((sum, sample) => sum + Math.abs(sample.error), 0) / sampledData.length
  const inspected = sampledData[inspectedSample]

  const nyquist = useMemo(() => {
    if (signal.harmonics) {
      const fundamentalLimit = signal.fundamental * 2
      if (samplingRate <= fundamentalLimit) {
        return {
          tone: 'danger',
          label: 'Fundamental at risk',
          title: 'Aliasing changes the apparent frequency.',
          body: `The ${signal.fundamental} kHz fundamental needs more than ${fundamentalLimit} kHz sampling. Its harmonics need substantially more.`,
        }
      }

      return {
        tone: 'warning',
        label: 'Harmonics limited',
        title: 'The main shape is captured, but its edges soften.',
        body: `A ${signal.fundamental} kHz ${signalType} wave contains harmonics above its fundamental, so there is no single finite Nyquist rate for a perfect edge.`,
      }
    }

    const requiredRate = signal.highestFrequency * 2
    if (samplingRate < requiredRate) {
      return {
        tone: 'danger',
        label: 'Aliasing likely',
        title: 'The sample rate is below the Nyquist limit.',
        body: `${signal.highestFrequency} kHz needs more than ${requiredRate} kHz sampling. The reconstructed signal can appear to contain a different, lower frequency.`,
      }
    }

    if (samplingRate < requiredRate * 1.25) {
      return {
        tone: 'warning',
        label: 'At the limit',
        title: 'The rule is met, but there is very little margin.',
        body: `The theoretical limit is ${requiredRate} kHz. Real filters and measurements work better with some headroom.`,
      }
    }

    return {
      tone: 'good',
      label: 'Above Nyquist',
      title: 'The timing resolution is sufficient for this signal.',
      body: `${samplingRate} kHz is safely above twice the highest component (${signal.highestFrequency} kHz).`,
    }
  }, [samplingRate, signal, signalType])

  const quantisationInsight = bitDepth <= 3
    ? `With only ${levels} levels, each rounding step is easy to see. Raising the bit depth reduces the staircase and error.`
    : `With ${levels} levels, the maximum possible rounding error is half a step: ${formatNumber(quantisationStep / 2, 4)} of full scale.`

  const applyPreset = (preset) => {
    setSignalType(preset.values.signalType)
    setSamplingRate(preset.values.samplingRate)
    setBitDepth(preset.values.bitDepth)
    setActiveStage(3)
    setInspectedSample(3)
  }

  const resetDemo = () => {
    setSignalType(DEFAULTS.signalType)
    setSamplingRate(DEFAULTS.samplingRate)
    setBitDepth(DEFAULTS.bitDepth)
    setActiveStage(3)
    setShowLevels(true)
    setShowReconstruction(true)
    setInspectedSample(3)
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Signal Lab home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span><strong>Signal Lab</strong><small>Sampling &amp; quantisation</small></span>
        </a>
        <span className="lesson-pill">Interactive lesson · 1 ms window</span>
      </header>

      <main id="top">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">From analogue to digital</p>
            <h1 id="page-title">See every measurement become a number.</h1>
          </div>
          <p className="intro-copy">Change the clock and bit depth, then follow one signal through sampling, rounding, and binary encoding.</p>
        </section>

        <section className="workbench" aria-label="Interactive sampling experiment">
          <aside className="control-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">Experiment controls</p><h2>Set the conditions</h2></div>
              <button className="text-button" type="button" onClick={resetDemo}>Reset</button>
            </div>

            <div className="controls-grid">
              <div className="control-section">
                <label className="control-label" htmlFor="signal-type"><span><b>1</b> Signal source</span></label>
                <select id="signal-type" value={signalType} onChange={(event) => setSignalType(event.target.value)}>
                  {Object.entries(SIGNALS).map(([value, option]) => (
                    <option key={value} value={value}>{option.label}</option>
                  ))}
                </select>
                <p className="control-help">{signal.detail}</p>
              </div>

              <div className="control-section">
                <div className="control-label">
                  <label htmlFor="sampling-rate"><span><b>2</b> Sampling rate</span></label>
                  <output htmlFor="sampling-rate">{samplingRate} kHz</output>
                </div>
                <input
                  id="sampling-rate"
                  className="range sampling-range"
                  type="range"
                  min="4"
                  max="64"
                  step="1"
                  value={samplingRate}
                  onChange={(event) => {
                    const nextRate = Number(event.target.value)
                    setSamplingRate(nextRate)
                    setInspectedSample((current) => Math.min(current, nextRate - 1))
                  }}
                />
                <div className="range-scale" aria-hidden="true"><span>4</span><span>34</span><span>64 kHz</span></div>
                <p className="control-help">One measurement every {formatNumber(samplePeriodMicroseconds, 1)} μs.</p>
              </div>

              <div className="control-section">
                <div className="control-label">
                  <label htmlFor="bit-depth"><span><b>3</b> Bit depth</span></label>
                  <output htmlFor="bit-depth">{bitDepth} bits</output>
                </div>
                <input id="bit-depth" className="range depth-range" type="range" min="2" max="8" step="1" value={bitDepth} onChange={(event) => setBitDepth(Number(event.target.value))} />
                <div className="range-scale" aria-hidden="true"><span>2</span><span>5</span><span>8 bits</span></div>
                <p className="control-help">2<sup>{bitDepth}</sup> = <strong>{levels} amplitude levels</strong>.</p>
              </div>
            </div>

            <div className="layer-controls" aria-label="Chart layers">
              <span>Chart layers</span>
              <label className="check-control">
                <input type="checkbox" checked={showLevels} onChange={(event) => setShowLevels(event.target.checked)} />
                <span>Level grid</span>
              </label>
              <label className="check-control">
                <input type="checkbox" checked={showReconstruction} onChange={(event) => setShowReconstruction(event.target.checked)} />
                <span>Reconstruction</span>
              </label>
            </div>
          </aside>

          <div className="visual-panel">
            <div className="stage-nav" aria-label="Learning stages">
              {STAGES.map((stage) => (
                <button key={stage.id} type="button" className={activeStage === stage.id ? 'active' : ''} aria-pressed={activeStage === stage.id} onClick={() => setActiveStage(stage.id)}>
                  <b>{stage.id}</b>
                  <span><strong>{stage.label}</strong><small>{stage.hint}</small></span>
                </button>
              ))}
            </div>

            <div className="visual-heading">
              <div><p className="section-kicker">Live signal view</p><h2>{STAGES[activeStage - 1].label}: {signal.shortLabel}</h2></div>
              <StatusBadge tone={nyquist.tone}>{nyquist.label}</StatusBadge>
            </div>

            <div className="metric-row">
              <div><span>Samples in 1 ms</span><strong>{samplingRate}</strong></div>
              <div><span>Sample period</span><strong>{formatNumber(samplePeriodMicroseconds, 1)} μs</strong></div>
              <div><span>Quantisation step</span><strong>{formatNumber(quantisationStep, 4)}</strong></div>
            </div>

            <SamplingChart
              analogueData={analogueData}
              sampledData={sampledData}
              reconstructedData={reconstructedData}
              activeStage={activeStage}
              levels={levels}
              showLevels={showLevels}
              showReconstruction={showReconstruction}
              inspectedSample={inspectedSample}
              signalLabel={signal.label}
            />
          </div>
        </section>

        <section className="learning-grid" aria-label="Interpret the results">
          <article className={`insight-card ${nyquist.tone}`}>
            <div className="card-heading">
              <div><p className="section-kicker">What to notice</p><h2>{nyquist.title}</h2></div>
              <StatusBadge tone={nyquist.tone}>{nyquist.label}</StatusBadge>
            </div>
            <p>{nyquist.body}</p>
            <div className="insight-rule" />
            <h3>Amplitude resolution</h3>
            <p>{quantisationInsight}</p>
            <div className="formula-row">
              <code>L = 2<sup>n</sup> = {levels}</code>
              <code>Δ = 1 ÷ {maxIndex} = {formatNumber(quantisationStep, 4)}</code>
            </div>
          </article>

          <article className="sample-card">
            <div className="card-heading">
              <div><p className="section-kicker">Inspect one conversion</p><h2>Sample {inspectedSample + 1} of {samplingRate}</h2></div>
              <span className="binary-chip">{inspected.binary}</span>
            </div>
            <label className="sample-scrubber-label" htmlFor="sample-inspector">Move through the samples</label>
            <input id="sample-inspector" className="range inspector-range" type="range" min="0" max={samplingRate - 1} value={inspectedSample} onChange={(event) => setInspectedSample(Number(event.target.value))} />
            <div className="conversion-flow" aria-label="Current sample conversion">
              <div><span>Time</span><strong>{formatNumber(inspected.t * 1000, 1)} μs</strong></div><i aria-hidden="true">→</i>
              <div><span>Measured</span><strong>{inspected.analogueValue.toFixed(3)}</strong></div><i aria-hidden="true">→</i>
              <div><span>Level</span><strong>{inspected.quantisedIndex}</strong></div><i aria-hidden="true">→</i>
              <div><span>Binary</span><strong>{inspected.binary}</strong></div>
            </div>
            <p className="rounding-note">{inspected.analogueValue.toFixed(3)} × {maxIndex} = {(inspected.analogueValue * maxIndex).toFixed(2)}, rounded to level {inspected.quantisedIndex}.</p>
          </article>

          <article className="error-card">
            <div className="card-heading">
              <div><p className="section-kicker">Quantisation error</p><h2>The cost of rounding</h2></div>
              <div className="error-stats"><span>Mean <b>{meanError.toFixed(4)}</b></span><span>Max <b>{maximumError.toFixed(4)}</b></span></div>
            </div>
            <ErrorPlot sampledData={sampledData} />
          </article>

          <article className="preset-card">
            <div className="card-heading"><div><p className="section-kicker">Try an experiment</p><h2>Make the difference obvious</h2></div></div>
            <div className="preset-list">
              {PRESETS.map((preset) => (
                <button key={preset.id} type="button" onClick={() => applyPreset(preset)}>
                  <span><strong>{preset.title}</strong><small>{preset.description}</small></span><i aria-hidden="true">→</i>
                </button>
              ))}
            </div>
          </article>
        </section>
      </main>

      <footer>
        <p><strong>Signal Lab</strong> · Explore first, then explain what changed.</p>
        <p>Amplitude is normalised from 0 to 1. Frequencies are shown in kHz.</p>
      </footer>
    </div>
  )
}
