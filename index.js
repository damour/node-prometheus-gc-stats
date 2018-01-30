'use strict';

// Credits go to @tcolgate

const Counter = require('prom-client').Counter;
const Histogram = require('prom-client').Histogram;
const optional = require('optional');

const gc = optional('gc-stats');

const gcTypes = {
  0: 'Unknown',
  1: 'Scavenge',
  2: 'MarkSweepCompact',
  3: 'ScavengeAndMarkSweepCompact',
  4: 'IncrementalMarking',
  8: 'WeakPhantom',
  15: 'All',
};

const noop = () => {};

module.exports = registry => {
  if (typeof gc !== 'function') {
    return noop;
  }

  const registers = registry ? [registry] : undefined;

  const labelNames = ['gctype'];

  const gcCount = new Counter({
    name: 'nodejs_gc_runs_total',
    help: 'Count of total garbage collections.',
    labelNames,
    registers,
  });
  const gcTimeHistogram = new Histogram({
    name: 'nodejs_gc_pause_duration_seconds',
    help: 'Time spent in GC Pause in seconds.',
    buckets: [0.001, 0.005, 0.01, 0.02, 0.03, 0.05, 0.1, 0.3, 0.5, 1, 2],
    labelNames,
    registers,
  });
  const gcTimeCount = new Counter({
    name: 'nodejs_gc_pause_seconds_total',
    help: 'Time spent in GC Pause in seconds.',
    labelNames,
    registers,
  });
  const gcReclaimedHistogram = new Histogram({
    name: 'nodejs_gc_reclaimed_bytes',
    help: 'Number of bytes reclaimed by GC.',
    buckets: [1, 100, 1024, 5 * 1024, 10 * 1024, 100 * 1024, 1024 * 1024, 10 * 1024 * 1024, 100 * 1024 * 1024, 500 * 1024 * 1024, 1024 * 1024 * 1024],
    labelNames,
    registers,
  });
  const gcReclaimedCount = new Counter({
    name: 'nodejs_gc_reclaimed_bytes_total',
    help: 'Total number of bytes reclaimed by GC.',
    labelNames,
    registers,
  });

  let started = false;

  return () => {
    if (started !== true) {
      started = true;

      gc().on('stats', stats => {
        const gcType = gcTypes[stats.gctype];

        gcCount.labels(gcType).inc();
        gcTimeHistogram.labels(gcType).observe(stats.pause / 1e9);
        gcTimeCount.labels(gcType).inc(stats.pause / 1e9);

        if (stats.diff.usedHeapSize < 0) {
          gcReclaimedCount.labels(gcType).inc(stats.diff.usedHeapSize * -1);
          gcReclaimedHistogram.labels(gcType).observe(stats.diff.usedHeapSize * -1);
        }
      });
    }
  };
};
