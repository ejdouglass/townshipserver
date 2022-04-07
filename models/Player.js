const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PlayerSchema = new Schema({
    name: {type: String, required: true, unique: true},
    gender: String,
    township: Object,
    appearance: Object, // mmmmaybe
    salt: {type: String, required: true},
    hash: {type: String, required: true},
    playState: Array,
    stats: Object,
    inventory: Array,
    equipment: Object,
    exp: Number,
    history: Object,
    level: Number,
    classes: Object,
    abilities: Object,
    memories: Object,
    privacy: String, // or possibly a number
    chatventure: Object,
    actStack: Array
}, { minimize: false });

module.exports = mongoose.model('Player', PlayerSchema);

// should I set defaults here as a fallback, or make sure to handle it in the server upon creation?