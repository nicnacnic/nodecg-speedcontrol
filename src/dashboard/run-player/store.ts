import clone from 'clone';
import type { ReplicantBrowser } from 'nodecg/types/browser';
import type { RunDataActiveRun, RunDataActiveRunSurrounding, RunDataArray, RunFinishTimes, Timer, TwitchAPIData } from 'schemas'; // eslint-disable-line max-len
import type { RunData } from 'types';
import Vue from 'vue';
import Vuex, { Store } from 'vuex';

Vue.use(Vuex);

// Replicants and their types
const reps: {
  runDataArray: ReplicantBrowser<RunDataArray>;
  runDataActiveRun: ReplicantBrowser<RunDataActiveRun>;
  runDataActiveRunSurrounding: ReplicantBrowser<RunDataActiveRunSurrounding>;
  runFinishTimes: ReplicantBrowser<RunFinishTimes>
  timer: ReplicantBrowser<Timer>;
  twitchAPIData: ReplicantBrowser<TwitchAPIData>;
  [k: string]: ReplicantBrowser<unknown>;
} = {
  runDataArray: nodecg.Replicant('runDataArray'),
  runDataActiveRun: nodecg.Replicant('runDataActiveRun'),
  runDataActiveRunSurrounding: nodecg.Replicant('runDataActiveRunSurrounding'),
  runFinishTimes: nodecg.Replicant('runFinishTimes'),
  timer: nodecg.Replicant('timer'),
  twitchAPIData: nodecg.Replicant('twitchAPIData'),
};

// Types for mutations below
export type UpdateRunOrder = (runs: RunData[]) => void;

const store = new Vuex.Store({
  state: {},
  mutations: {
    setState(state, { name, val }): void {
      Vue.set(state, name, val);
    },
    /* Mutations to replicants start */
    // I don't think this is even used in run-player
    // but needs to be kept because RunList uses it for run-editor?
    updateRunOrder(state, runs: RunData[]): void {
      if (typeof reps.runDataArray.value !== 'undefined') {
        reps.runDataArray.value = clone(runs);
      }
    },
    /* Mutations to replicants end */
  },
});

Object.keys(reps).forEach((key) => {
  reps[key].on('change', (val) => {
    store.commit('setState', { name: key, val: clone(val) });
  });
});

export default async (): Promise<Store<Record<string, unknown>>> => {
  await NodeCG.waitForReplicants(...Object.keys(reps).map((key) => reps[key]));
  return store;
};
