const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const GameStateSchema = new Schema({
    dateKey: {type: String, required: true, unique: true},
    allSouls: Object,
    allChatventures: Object,
    allSecrets: Object,
    allWorlds: Object
}, { minimize: false });

module.exports = mongoose.model('GameState', GameStateSchema);

/*

dateKey functions as the "id" for each day's GameState. Each day according to server time gets a unique 'savefile.'

allSouls is an object of objects, with the root-level key being PlayerName. We'll have to ensure PlayerName is unique or we'll hit issues. So many issues.

allChatventures is also an object of objects, with chatventureID as a unique key. It's referenced in the allSouls[Dekar].currentChatventure, as well.
    - allSouls['Dekar'].township.npcs['Bob'].currentActivity should reference that chatventureID, as well, assuming they're coming along.

Chatventures is a very broad class of events that basically covers all currently imaginable single or multi player experiences, from dialogue to 'exploration' to combat.

As long as the two-way reference endures, we *shouldn't* hit any issues, but don't neglect to have error handling that slides the player back to their township if OOPS.

Just realized we need a place for salt & hash to live. Can it still safely live in allSouls?
... actually, maybe. The server-side can still cheerfully have access to it, and we can have a quick "sanitizing function" that deletes or otherwise removes sensitive intel.
So allSecrets miiight not need to exist after all.

*/