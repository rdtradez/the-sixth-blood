// Content migrations: upgrade old saves when the story changes in a way that needs it.
//
// When you rename a flag, move a stat, or change what a variable means, bump
// "contentVersion" in manifest.json and add an entry here. Saves made before that
// version are upgraded automatically when they are opened.
//
//   {
//     version: 2,                              // the new contentVersion this migration produces
//     note: 'Short message shown to the player after upgrading (optional)',
//     up(state) {                              // mutate state.vars etc., then return state
//       if ('met_cassian' in state.vars) { state.vars.cassian_met = state.vars.met_cassian; delete state.vars.met_cassian; }
//       return state;
//     },
//   }
//
// Adding a new declared stat needs no migration: new stats get their start value on load.
// Adding or editing chapters needs none either: saves find their place by fingerprint.

export default [];
