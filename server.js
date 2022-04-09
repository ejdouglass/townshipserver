const express = require('express');
const app = express();
const server = require('http').createServer(app);
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const Player = require('./models/Player');
const GameState = require('./models/GameState');
// const cors = require('cors');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { decode } = require('punycode');
require('dotenv').config();

const io = socketIo(server, {
    cors: {
        origin: 'http://localhost:8899',
        methods: ['GET', 'POST']
    }
});

/*

    Quick-construction objects for the Constructor Classes to use... new Item(blueprints.battleaxe, )

*/
const blueprints = {
    rags: {
        type: 'equipment', build: 'clothes', name: 'Tattered Rags', description: `These clothes look like they've been worn through an apocalypse.`, 
        slot: 'body', icon: {type: 'x'}, equipStats: {def: {flat: 2, amp: {vitality: 0.5}}}
    },
    fancyclothes: {
        type: 'equipment', build: 'clothes', name: 'Fancy Clothes', description: `These clothes are quite fashionable, bright, and well-tailored.`, 
        slot: 'body', icon: {type: 'x'}, equipStats: {def: {flat: 10, amp: {vitality: 1.5, intelligence: 1.5}}, res: {flat: 10, amp: {wisdom: 3}}}        
    },
    leathercap: {
        type: 'equipment', build: 'clothes', name: 'Leather Cap', description: `A simple leather cap for your noggin.`, 
        slot: 'head', icon: {type: 'x'}, equipStats: {def: {flat: 1, amp: {vitality: 0.5}}}
    }
};

// HERE: all relevant JS classes
/*

    TIME TO MAKE ITEMS EXIST! Great!
    type: equipment, consumable, ?
    build: sword, potion, axe, staff, spear, helm, armor, robes, etc.
    name: equip-level/top-level name
    description: the long words to tell more!
    slot: hand, bothHands, head, body, accessory, trinket (if applicable... OR, we can have any item be equippable in the hands, for delicious FLAVOR)
    icon: peekture

    BRAINSTORM
    interact: what happens when you attempt to interact with it, possibly including checks involved?
    construction: what it's made of
    equipStats: ... a -must- for equipment, so the question becomes what format?
    actionMods: separate checks for adding/adjusting action/ability/spell/etc. mods such as healing, destruction (magic), or whatever
        - that's a bit more nuanced as for what kind of parameters we want to allow or consider, so... for-later
    quality: some measurement of the workmanship of the thing
        - just a single number?... 0 - 100? 
    upgrades: something to track the total amount, typing, and effects of upgrades to the item to help calculate its effects/stats/etc.
        - definitely an object, including a quality or total amount that is used to calculate the difficulty of further upgrades

    SPECIFIC BRAINSTORM
    equipStats: {
        atk: {
            flat: 10,
            amp: {
                strength: 1
            }
        },
    }

    CONSTRUCTOR(blueprint, ___?)
    .. what else?
    - level, maybe
    - extra mods
    - ?

*/
class Item {
    constructor(blueprint) {
        this.type = blueprint.type;
        this.build = blueprint.build;
        this.name = blueprint.name;
        this.description = blueprint.description;
        this.slot = blueprint.slot;
        this.icon = blueprint.icon;
        this.equipStats = blueprint.equipStats;
        this.id = generateRandomID();
    }

    build () {
        // a handy-dandy method that's intended to use the level and any upgrade data to build or re-build this Item!
        // ... oooor, alternatively, we could have just a global function that does this, too; we'll consider the pros/cons
    }
}

function equip(agent, ...items) {
    // going to try using Spread Magic to equip all the way from ONE to INFINITY items!
    // agent is meant to be a passed object reference
    // NOTE: this will NOT work for any hand-based item, nor will it work for any theoretical future accessory2 or trinket2 slots that may arise

    // just realized that hands are tricky, because currently hand-agnostic equipping means without knowing WHICH hand we're aiming for, we don't know where to put it?
    // TWO SOLUTIONS: hard-code rightHand & leftHand, or separate equipOne function for target-specific
    // ok, let's roll with #2, I like hand-agnostic aesthetic for this

    items.forEach(itemObject => {
        // check the agent's intended slot; if something is 'in the way,' unequip it into inventory first
        if (agent.equipment[itemObject.slot] != null) {
            // something is equipment there! remove it!
            unequip(agent, itemObject.slot)
            agent.inventory.push(agent.equipment[itemObject.slot]);
            agent.equipment[itemObject.slot] = null;
        }
        agent.equipment[itemObject.slot] = itemObject;
        // HERE: apply them stats! ... so much object layering, holy cow. gonna have to test to see if this all works out ok with some new Players. Rags, GO!
        Object.keys(itemObject.equipStats).forEach(statToBoost => {
            agent.stats[statToBoost] = agent.stats[statToBoost] + itemObject.equipStats[statToBoost].flat;
            Object.keys(itemObject.equipStats[statToBoost].amp).forEach(statToAmpWith => {
                agent.stats[statToBoost] = agent.stats[statToBoost] + Math.floor(agent.stats[statToAmpWith] * itemObject.equipStats[statToBoost].amp[statToAmpWith]);
            });
        });

    });

}

function equipOne(agent, item, slot) {
    // items need ids. they just do. :P
    if (agent.equipment[slot] != null) {
        // something is equipment there! remove it! ... o snap we can't just do it this way, we need to UNEQUIP it
        unequip(agent, slot);
    }
    if (item.name === null) return agent.equipment[slot] = null;
    agent.equipment[slot] = item;
    // important: filter this item out of their inventory :P
    agent.inventory = agent.inventory.filter(invItem => invItem.id !== item.id);
    // HERE: apply them stats! ... so much object layering, holy cow. gonna have to test to see if this all works out ok with some new Players. Rags, GO!
    Object.keys(item.equipStats).forEach(statToBoost => {
        agent.stats[statToBoost] = agent.stats[statToBoost] + item.equipStats[statToBoost].flat;
        Object.keys(item.equipStats[statToBoost].amp).forEach(statToAmpWith => {
            agent.stats[statToBoost] = agent.stats[statToBoost] + Math.floor(agent.stats[statToAmpWith] * item.equipStats[statToBoost].amp[statToAmpWith]);
        });
    });
}

function unequip(agent, slot) {
    // slip off a piece of equipment into inventory, adjusting stats properly in the meantime
    let item = agent.equipment[slot];

    Object.keys(item.equipStats).forEach(statToBoost => {
        agent.stats[statToBoost] = agent.stats[statToBoost] - item.equipStats[statToBoost].flat;
        Object.keys(item.equipStats[statToBoost].amp).forEach(statToAmpWith => {
            agent.stats[statToBoost] = agent.stats[statToBoost] - Math.floor(agent.stats[statToAmpWith] * item.equipStats[statToBoost].amp[statToAmpWith]);
        });
    });

    agent.inventory.push(agent.equipment[slot]);
    agent.equipment[slot] = null;
}

class Achievement {}

class Chatventure {}

// maaaay not need NPC below, if we define a typing on this Class that covers that effectively
// note that mobs should be stealable and have LOOT, as well
class Mob {}

class NPC {}



// for now, HAX for Zenithica
// note to self: make sure to initialize ALL variables, such as history, when doing actual Zenithica setup
let allSouls = {
    Zenithica: {
        township: {
            townMap: {
                description: `Y'all roam the streets of the mighty ZENITHICA. There are crystals everywhere! Whoa!`,
            },
            history: []
        }
    }
};
let allChatventures = {};
let allSecrets = {}; // hm, could do a 'version' variable in here to hook in version checking and update logistics

let gameSaveTimeout;
const standardSaveInterval = 1000 * 60 * 5;

// moar HAX! to test chat sensitivity
// ok! the below works fine, minus the text box overflowing wildly with reckless abandon.

const ambientZenithica = [
    `A bunch of Nobodies lurk the streets.`,
    `A big ol Dragon flies overhead! Whoooooa.`,
    `A stiff breeze kicks up from somewhere. Just as quickly, it vanishes.`,
    `Taran Wanderer strolls on by. Hi, guy!`,
    `You catch sight of a muglin darting down a nearby street. A small handful of guards give chase.`
];





// hm, still need to figure out how to best define these to allow some progression and logic
/*

Modeling...
CLASS: {
    requirements: {
        level: 0,
        classLevels: {warrior: 3, rogue: 5},
        achievements: [],
        stats: {}, // may or may not require stats in actuality
    },
    levelBonuses: [{}, {}], // handy array for levels from 0 onward!
    abilities: {
        // abilities with requirements and cost here, and once learned, we reference allAbilities instead for details
        abilityName: {requirements: {}, cost: {}}
    },
    prefixes: {...do we want to call them that? :P}
}


... separate thought, but if abilities are learned OUTSIDE of a class, how do we level 'em up? :P
    - maybe just have an ability screen for that, and gaining exp automatically levels up the class, then you can 'spend' gained exp on abilities
    - the other idea is to have to 'purchase' stuff in the class to level it up
    - and can add other requirements down the road
    - ok, I waffled in my thinking a bit, but I think ultimately having to go TRAIN with someone/at somewhere to push class exp is neat
    - cost can be exp, wealth, other??
    - in this model, learning to Craft is through specific classes, rather than having it be a "free find-it-yourself skills" thing
    - ok, everything-is-abilities, we're disregarding skills for PCs, and maybe for NPCs as well
        - passives and perks is where it's at! and level! and stats! :P

*/
const allClasses = {
    'rogue': {},
    'warrior': {},
    'sympath': {},
    'mage': {},
    'fool': {}
};


/*

SOME EXAMPLES TO BRAINSTORM THEN BUILD OFF OF
The main bits are probably name, message, active/passive, type, target, cost, effects
... message 
All abilities are considered 'base' and are modified further by prefixes
Later, maybe prefix synergies can cause special effects/variants
We can add the rest later, so let's make a few new examples
... oh, need target info like single/group/side/all, potency as 'base effect' mod e.g. 1.8 for +80%, charge
... maybe a base accuracy, a base potency, potency mod (1.8 in example above), scaling

can also consider firstPersonMsg, thirdPersonMsg to get properly fancy, and it's not THAT much harder
messages can also be in an array, defaulting to [0] but scaling up based on skill/"level" of the move

    mightystrike: {
        name: 'Mighty Strike',
        firstPersonMsg: [],
        thirdPersonMsg: [],
        active: true,
        type: 'physical',
        intent: 'attack',
        target: 'other',
        aoe: 'single',
        windup: 0,
        cooldown: 0,
        effects: {
            damage: {
                stat: atk,
                base: [10], // in an array that's based on SKILL LEVEL with the technique, starting at 0 because indices
                mod: [1.5],
                accuracy: [0.85]
            }
        }
    }

    scorch: {origin: 'magical', type: 'spell', meta3: 'active', intent: 'attack', target: 'other', cost: {}, effects: {damage: {scaling: 'willpower', type: 'fire', potency: 1}}},
    undermine: {origin: 'physical', type: 'tech', meta3: 'active', intent: 'attack', intent2: 'debuff', ...},
    cover: {origin: 'physical', type: 'tech', meta3: 'active', scaling: 'agility'},
    steal: {origin: 'physical', type: 'tech', meta3: 'active'},
    hale: {origin: 'physical', type: 'tech', meta3: 'passive', effects: {}}

    can add extra flags that some abilities/mods/equipment/etc. can check for... other: {draconic: 1}


*/
// note that currently we're intending this to be 'all abilities' blueprints,' with 'personalized' level of experience/skill with the ability attached to each player
// the specific shape of that concept tbd
const allAbilities = {

};

/*

NPCs 'live' in allSouls.
Mobs and other entities 'live' in chatVentures, by default, though could theoretically be 'appended' quietly to allSouls for better durability.

*/

function rando(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomID(prefix) {
    prefix = prefix ? prefix : 'rnd';
    let dateSeed = new Date();
    let randomSeed = Math.random().toString(36).replace('0.', '');
    // console.log(`Random Seed result: ${randomSeed}`);
    return prefix + dateSeed.getMonth() + '' + dateSeed.getDate() + '' + dateSeed.getHours() + '' + dateSeed.getMinutes() + '' + dateSeed.getSeconds() + '' + randomSeed;
}

function calcDateKey(date) {
    // Returns MM/DD/YYYY, adding a leading '0' where necessary to match this format, i.e. 03/07/2021 ; assumes 'today' if no specific date is passed as param
    let dateToKey = date ? date : new Date();
    let monthKey = dateToKey.getMonth() + 1;
    let dateKey = dateToKey.getDate();
    let yearKey = dateToKey.getFullYear();

    return `${(monthKey < 10 ? `0` + monthKey : monthKey)}/${(dateKey < 10 ? `0` + dateKey : dateKey)}/${yearKey}`;
}

function createSalt() {
    return crypto.randomBytes(20).toString('hex');
}

function sanitizePlayerObj(playerRef) {
    // accept the object reference, JSON to deep copy and remove refs, THEN delete potentially offensive content such as salt and hash, RETURN the fresh obj for client
    let safePlayer = JSON.parse(JSON.stringify(playerRef));
    delete safePlayer.salt;
    delete safePlayer.hash;
    return safePlayer;
}

function createHash(password, salt) {
    password = password.length && typeof password === 'string' ? password : undefined;

    if (password && salt) {
        let hash = crypto
            .createHmac('sha512', salt)
            .update(password)
            .digest('hex');

        return hash;
    } else {
        return null;
    }
}

function craftAccessToken(name) {
    return jwt.sign({ name: name }, process.env.SECRET, { expiresIn: '7d' });
}

function saveGameState() {
    const today = new Date();
    let todaysDateKey = calcDateKey(today);

    // let yesterdate = new Date(today);
    // yesterdate.setDate(yesterdate.getDate() - 1);
    // let yesterdaysDateKey = calcDateKey(yesterdate);

    clearTimeout(gameSaveTimeout);

    const gameState = {
        dateKey: todaysDateKey,
        allSouls: allSouls,
        allChatventures: allChatventures,
        allSecrets: allSecrets
    };

    const filter = { dateKey: todaysDateKey };
    const update = { $set: gameState };
    const options = { new: true, useFindAndModify: false, upsert: true };

    GameState.findOneAndUpdate(filter, update, options)
        .then(updatedResult => {
            
            console.log(`GameState entry for ${updatedResult.dateKey} has been saved and updated in the database.`);
            return gameSaveTimeout = setTimeout(() => saveGameState(), standardSaveInterval);
            // HERE might be a good spot to do the server-user update? user[updatedResult.userID]... though, we'd be pulling stuff we don't want to share, hm
            // nevermind, just do it below
        })
        .catch(err => {
            console.log(`We encountered an error saving the user: ${err}.`);
        });



    /*
    REFERENCE:
    const GameStateSchema = new Schema({
        dateKey: {type: String, required: true, unique: true},
        allSouls: Object,
        allChatventures: Object,
        allSecrets: Object
    }, { minimize: false });    
    
    */
    // THIS: pull the TODAY GameState from DB using datekey; if doesn't exist, make new one, and if does, overwrite
}

// Function still exists to be ported over to saveGameState, a more 'global' function.
/*
function saveUser(user) {
    const filter = { name: user.name };
    const update = { $set: user };
    const options = { new: true, useFindAndModify: false };
    User.findOneAndUpdate(filter, update, options)
        .then(updatedResult => {
            console.log(`${updatedResult.name} has been saved and updated in the database.`);
            // HERE might be a good spot to do the server-user update? user[updatedResult.userID]... though, we'd be pulling stuff we don't want to share, hm
            // nevermind, just do it below
        })
        .catch(err => {
            console.log(`We encountered an error saving the user: ${err}.`);
        });
    
    // we don't need to update the server version of the user in this case of this function being invoked;
    // the server-side character is changed first and passed into this fxn
}
*/



io.on('connection', (socket) => {
    let thisPlayer = undefined;

    socket.join('Zenithica');

    socket.on('login', loginData => {     
        // console.log(`Received loginData: `, loginData);

        if (loginData.token == null && loginData.name == null) {
            let initialLocationData = {
                name: 'Zenithica',
                nickname: 'Zenithica',
                description: allSouls['Zenithica'].township.townMap.description,
                history: allSouls['Zenithica'].township.history.slice(-150),
                structs: allSouls['Zenithica'].township.townMap.structs
            };
            return socket.emit('location_update', initialLocationData);
        }

        if (loginData.token != null) {
            let decodedPlayerName = jwt.verify(loginData.token, process.env.SECRET).name;
            // console.log(`${decodedPlayerName} has logged in via token.`);
            const newToken = craftAccessToken(decodedPlayerName);
            socket.emit('reset_token', newToken);
            thisPlayer = allSouls[decodedPlayerName];
            thisPlayer.following.forEach(soulName => socket.join(soulName));
            let initialLocationData = {
                name: thisPlayer.playStack.gps,
                nickname: allSouls[thisPlayer.playStack.gps].township.nickname,
                description: allSouls[thisPlayer.playStack.gps].township.townMap.description,
                history: allSouls[thisPlayer.playStack.gps].township.history.slice(-150),
                structs: allSouls[thisPlayer.playStack.gps].township.townMap.structs
            };
            socket.emit('player_update', sanitizePlayerObj(thisPlayer));
            return socket.emit('location_update', initialLocationData);      
            
        }

        if (loginData.name != null) {
            let testHash = createHash(loginData.password, allSouls[loginData.name].salt);
            if (testHash === allSouls[loginData.name].hash) {
                // console.log(`${loginData.name} has logged in via name and password.`);
                const newToken = craftAccessToken(loginData.name);
                socket.emit('reset_token', newToken);
                thisPlayer = allSouls[loginData.name];
                thisPlayer.following.forEach(soulName => socket.join(soulName));
                let initialLocationData = {
                    name: thisPlayer.playStack.gps,
                    nickname: allSouls[thisPlayer.playStack.gps].township.nickname,
                    description: allSouls[thisPlayer.playStack.gps].township.townMap.description,
                    history: allSouls[thisPlayer.playStack.gps].township.history.slice(-150),
                    structs: allSouls[thisPlayer.playStack.gps].township.townMap.structs
                };
                socket.emit('player_update', sanitizePlayerObj(thisPlayer));
                return socket.emit('location_update', initialLocationData); 
            }
        }
        return;

        // otherwise, look for name and password, pull that name's salt, 

        // loginData = {type: 'jwt', payload: userJWT || {name: '', password: ''}}}
        if (!loginData) return;
        // const decodedPlayer = jwt.verify(userJWT, process.env.SECRET).name;
        thisPlayer = allSouls[decodedPlayer];
        console.log(`Someone has socket-logged-in: ${thisUser.name}. Hi!`);
        if (!thisPlayer) {
            console.log(`Uh oh. Someone logged in but that user doesn't seem to exist. That can't be good.`);
        }
        // HERE: all imaginable socket.join(SOCKETNAME) goes here
        // Include: their own name and however the following list is set up
        socket.join(thisPlayer.name);
        // set up thisPlayer.following to be an array of names in allSouls
        // actually, it makes sense to have FOLLOWING be an object that includes lastViewTime for calculating how much "activity" we missed out on
        // thisPlayer.following.forEach(soulName => {
        //     socket.join(soulName);
        // });

        console.log(`${thisPlayer.name} has joined the game.`);
        
        // HERE: sort out lastViewTime logistics to give meaningful data for the client to parse for the player
    });

    socket.on('player_creation', creationObject => {
        // validate, then create in allSouls, then save GameState into DB using a new date-checking save fxn, then pass brand-new player data down to client for first steps!
        // oh, and we can 'log them in' here... repeating all of the above, which may make a function useful to DRY it out

        // HERE: add back-end validation in case user outfoxes the client's built-in checks

        // bounces if name is already taken
        let nameToCheck = creationObject.name.toLowerCase();
        if (Object.keys(allSouls).map(soulName => soulName.toLowerCase()).find(soulName => soulName === nameToCheck) !== undefined) {
            socket.emit('alert', {type: 'warning', echo: `You sense that is someone else's name, not yours.`});
            return console.log(`Someone tried to create a new Player with name ${creationObject.name}, but it's already taken.`);
        }
        
        
        

    /*

    I suppose this as good a place as any to define all Player variables for allSouls and beyond.

        - we need to figure out a way to get locationData down to the user... which includes?...
        - description, probably day/night/weather/etc. filters

        OK! with playstack: {
        gps: 'zenithica',
        doing: 'none',
        at: 'none',
        overlay: 'none'
        },
        we can use gps for ALLSOULS.township target...
        if at is 'none', then just grab allSouls[gps].township.townMap.description ...
        if at has a value, we'll assume it's a struct's id, so we can use ...townMap.structs[id].innerDescription
        - 'doing' will be our snag for what overlay to... wait, no, overlay is for that
        - 

        PLAYER OBJECT (root level)
        name, gender, township, icon, salt, hash, playStack, stats, effects, inventory, equipment, exp, history, level, classes, 
        equippedAbilities, memories, privacy, chatventureID, following, followedBy, flux, currentClass, relationships

        history can be the mechanism for calculating achievements?... or should it be separate?
        let's try history.eventType += 1 as well as history.achievements



        TOWNSHIP OBJECT (playername.township)
        nickname, npcs, structs, townMap, population, events, resources, history, worldMap (graphical?... semi-graphical? maybe not?)
        - events can be inclusive of township states... overrun, unusual weather, raid, in danger from something, etc. so the client can parse and share
        - structs default should include the connection mechanism to Zenithica et al. (naturally, some sort of super rad crystal)
            - tentatively, nexus
        - history can be a simple array of chat messages, event messages, npc/mob actions and chats
            - should history be 'backwards' with the most recent at index 0? possibly yes
        - achievements? maybe
        ... localTime? or something to derive length of days, nights, and localTime in-town from that

        Let's address each in turn!

        nickname: '', // we can default to Name's Township for now, and get sassier in the future if we want something like <Random Adjective> <Random Noun> :P
        icon: {}, // the 'face' of the township... flag or banner maybe
        asethetic: {}, // visual mods to the 'chat' by the player-user
        npcs: {
            generatedRandomID: {
                name: '',
                description: '',
                level: 0, // related to how 'awoken' they are? ... can also probably be used to derive their stats and skills
                exp: {},
                gender: '',
                icon: {},
                voice: {},
                age: 00,
                personality: {},
                relationships: {},
                skills: {},
                stats: {},
                effects: {},
                inventory: [],
                equipment: {},
                equippedAbilities: {},
                currentClass: '',
                gps: '', // currently designed for when they're envoying @ other townships; not sure how much detail/granularity we need/want for actual physical location
                chatventureID: '',
                routine: {}, // a set of variables that helps dictate the 'income' of the township over time, as well as figuring out NPC behavior
                struct: '', // the struct they're associated with/live in
                boosts: {township: {}, player: {}}, // boosts provided to township and player, where applicable
                other: {}
            }
        },
        townMap: {
            description: '', // the current 'room' description of just standing in the 'chatroom'
            structs: {
                generatedRandomID or fixed name, depending: {
                    nickname: '',
                    description: '',
                    innerDescription: '',
                    level: 0,
                    exp: {}, // goes up through 'use'?
                    type: '',
                    interactions: {shop: {buy: [], sell: []}},
                    icon: {},
                    gps: {},
                    dimensions: {},
                    construction: {}, // what it's made of... different materials can confer different effects/stat boosts?
                    boosts: {township: {}, player: {}},
                    inventory: {wares: [], construction: {}, wealth: 00, }, // we'll track these for... reasons!
                }
            },
            map: [], // for later rendering
        }, 
        worldMap: {
            areas: {
                areaID: {
                    type: '', // biome data?
                    nickname: '', 
                    factions: {},
                    resources: {gross, fine},
                    structs: {}, // anything from particularly interesting rocks to dungeons and encampments... any 'further interactable'
                    factions: {}
                }
            }, // probably areaID dividing into type, nickname, factions, gross and fine resource data, etc.
            map: [] // also for later rendering
        },
        population: 00,
        events: {},
        resources: {}, // can include a lastTick, inventory, incomes, utilization, currency/wealth, ???
        history: [], // chat stuff goes here
        lastTick: Date(), // maybe a mere record of the last recorded tick calculation?



        ... each township should generate with X new npcs!
        ... and Y new structs!


    */
        let brandNewPlayer = JSON.parse(JSON.stringify(creationObject));
        brandNewPlayer.salt = createSalt();
        brandNewPlayer.hash = createHash(brandNewPlayer.password, brandNewPlayer.salt);
        delete brandNewPlayer.password;
        Object.keys(brandNewPlayer.stats).forEach(statKey => brandNewPlayer.stats[statKey] = parseInt(brandNewPlayer.stats[statKey]));
        brandNewPlayer.token = craftAccessToken(brandNewPlayer.name);

        brandNewPlayer.level = 0;
        brandNewPlayer.exp = {}; // I'm sure there's a reason this is an object and not a number :P

        brandNewPlayer.chatventureID = undefined;

        // HERE: knowing their class, give them basics of that class's perks and abilities (first we need to define some :P)... init their core class, essentially
        brandNewPlayer.currentClass = brandNewPlayer.class;
        brandNewPlayer.classes = {};
        // INIT based off of a modified JS Class or some specifically tailored fxn
        brandNewPlayer.class[brandNewPlayer.class] = {};
        delete brandNewPlayer.class;


        // HERE: init equippedAbilities
        // they won't have any non-starting-class abilities yet, but maybe some sort of Sanctuary/special township utility 'spell' or ability could slot in here
        brandNewPlayer.equippedAbilities = {
            max: 3
        }


        // HERE: create their 'base' township, join the socket for it
        // currently, we're using completely static values, but random flavor should come in shortly
        // currently, bare bones, no structs, npcs, etc. ... consult above for setting those up in a bit
        let brandNewTownship = {
            nickname: `${brandNewPlayer.name}'s Township`,
            icon: {},
            aesthetic: {},
            npcs: {},
            townMap: {
                description: `Simple as can be, this little township.`,
                structs: {
                    nexus: {
                        nickname: `${brandNewPlayer}'s Town Nexus`,
                        description: 'A jagged crownlike blossom of translucent blue crystal, standing twice the height of a tall man, that acts as the heart of the township.',
                        innerDescription: 'How did you even get IN here? Crystals! Crystals everywhere!',
                        level: 0,
                        exp: {},
                        type: '',
                        interactions: {},
                        icon: {},
                        gps: {},
                        dimensions: {x: 1, y: 1, z: 1},
                        construction: {rawCrystal: 10},
                        boosts: {township: {}, player: {}},
                        inventory: {construction: {}},
                        income: {},
                        maintenance: {}
                    }
                },
                map: []
            },
            worldMap: {
                areas: {},
                map: []
            },
            population: 0,
            events: {},
            resources: {},
            history: [],
            lastTick: new Date()
        };
        brandNewPlayer.township = {...brandNewTownship};

        // HERE: init their 'derived' stats at base... hp, maxhp, mp, maxmp, atk, def, mag, res, etc. from core stats
        // consider any relevant abilities
        // also consider setting up a calcStats() type fxn to handle the lifting in the future (e.g. equipment changes, status effects, abilities, etc.)
        brandNewPlayer.stats.hpmax = 100;
        brandNewPlayer.stats.mpmax = 100;
        brandNewPlayer.stats.hp = brandNewPlayer.stats.hpmax;
        brandNewPlayer.stats.mp = brandNewPlayer.stats.mpmax;
        brandNewPlayer.stats.atk = 10;  
        brandNewPlayer.stats.def = 10;  
        brandNewPlayer.stats.mag = 10;  
        brandNewPlayer.stats.res = 10;
        brandNewPlayer.stats.spd = 10;        

        // HERE: init inventory, equipment, exp, history, level, equippedAbilities, memories
        // it'd be useful to have an equip(target, item) fxn so we can just roll with that going forward
        // for now we'll start 'empty' but for future creations throwing some fun nonsense in here would be amusing
        brandNewPlayer.inventory = [new Item(blueprints.fancyclothes), new Item(blueprints.leathercap)];
        brandNewPlayer.equipment = {
            rightHand: null,
            leftHand: null,
            head: null,
            body: null,
            accessory: null,
            trinket: null
        };

//!MHR
        equip(brandNewPlayer, new Item(blueprints.rags));

        // oh right, MUNNY... we'll go with just a number and 'carte blanche' currency for now
        brandNewPlayer.wallet = 0;
        
        // HERE: init flux? probably an object with {current: 0, max: 99, lastTick: Date()}, and some mechanism of calculating restoration (every 5 min seems fine :P)
        brandNewPlayer.flux = {current: 30, max: 30, lastTick: new Date()};



        // do we initialize different possible effects? ... think about how best to apply these for future considerations
        // anything from status ailments to breaks and buffs, rots and regens, here we are!
        brandNewPlayer.effects = {
            
        };

        // just a little catch-all variable :P
        brandNewPlayer.special = {

        };

        brandNewPlayer.following = ['Zenithica', brandNewPlayer.name];
        brandNewPlayer.followedBy = [];
        brandNewPlayer.relationships = {};

        // currently leaning towards having the playstack set up back here so we have 'positional information' about the player
        brandNewPlayer.playStack = {
            gps: 'Zenithica',
            doing: 'none',
            at: 'none',
            overlay: 'none'
        };

        // -ideally-, we init all sorts of expected values/actions here so we don't have to later :P
        /*
        
            BRAINSTORM:
            battlesFought, battlesLost, battlesWon, spellsCast, abilitiesUsed,
        
        */
        brandNewPlayer.history = {
            achievements: {}
        };

        // the power of crystalline memory stores objects, NPC's, maybe even townships in perpetuity under the right conditions
        brandNewPlayer.memories = {};

        console.log(`Hi! Here's the current working model for brandNewPlayer: `, brandNewPlayer);

        const newPlayerToken = craftAccessToken(brandNewPlayer.name);
        
        socket.join(brandNewPlayer.name);
        allSouls[brandNewPlayer.name] = JSON.parse(JSON.stringify(brandNewPlayer));

        thisPlayer = allSouls[brandNewPlayer.name];

        // HERE: send token and player data down using the sanitizePlayerObj fxn
        // we'll probably set up a unique socket event so we can initialize the first Chatventure
        // for now, we can make it an uneventful 'Chatventure' just to create scaffolding for Chatventure events, then go test chattiness

        /*
        
        FIRST CHATVENTURE - how do these work, how are they generally formatted?
        "Choose Your Own Adventure" concept
        ... with elements of CHATTING, because Chatventure, y'all

        so we need to generate a chatventureID and Object, join that chatventureID so we can get pings from it in single and multiplayer

        LET US DEFINE THE CHATVENTURE OBJECT! woo!
        ... Chatventure class should probably have built-in methods for handling choice, initializing combat and AI, etc.
        chatventureObj = {
            chatventureID: 'doopdedoo',
            participants: [], // we'll assume participants[0] is the leader
            companions: [], // npc allies of various stripes can live here; vibrant mobiles eventually, but even basic stats and AI would be pretty impressive for now
            at: 'init', // key value of the current step
            state: 'choice', // may not need this... maybe for dynamic stuff like battle vs battleConclusion
            arena: {}, // ongoing battle data goes here; with every substantive combat action, victory/loss conditions should probably be checked

            'init': {
                description: `You are standing in a place. You see a dangerous thing lurking menacingly! What do you do?`,
                type: 'choice', // what sort of situation prep and overlay we get
                areaData: {},
                prompts: [{
                    echo: `Fighting is the only option. Destroy it!`, 
                    goto: '1a'
                }, {
                    echo: `Heck naw, not being paid for this. Book it, FLEE!`,
                    goto: '1b'
                }]
            },

            '1a': {
                description: `You chose to FIGHT! It's a battleground!`,
                type: 'battle',
                areaData: {}, // populate some arena details from this?
                opponents: [], // likely 'seed data' to make new Mob()s from,
                victoryCondition: {}, // can include sets of rules that constitute a victory as well as the goto that goes with each
                lossCondition: {} // samesies
            }, 

            '1b': {
                description: `You try to get away!`,
                type: 'skillCheck',
                check: {vs: 'agility', criticalFailure: 3, failure: 6, success: 9, criticalSuccess: 12},
                outcomes: {criticalFailure: '1b1', failure: '1b2', success: '1b3', criticalSuccess: '1b4'} // basically just a bunch of goto data
            }
        }


        Another consideration... when in combat, for example, where does all the info required for combat readouts live?
        ... one option is playStack.data (just created), a loosey goosey object capable of holding whatever we want it to, which we can check contextually
        ... another, equally fly-by-night option is having state contain contextData, which would be similar in concept
        
        */

        // looks alright so far, but we need the 'access points' for that first Chatventure here, too!
        socket.emit('upon_creation', {playerData: sanitizePlayerObj(thisPlayer), token: newPlayerToken});

        return saveGameState();



        
        // return socket.emit('socket_test', {success: true, echo: `Oh hey first baby steps are done, great job.`});

    });


    // do we WANT to do a centralized data_from_client for ALL instances? hmmm
    // I can see the argument from the standpoint that data will always have the token coming in, but already logged-in-ness negates some of that
    socket.on('data_from_client', data => {
        // currently this is legacy code; undecided if I'll retain this format or not
        return console.log(`Received random data from client: `, data);

    });

    socket.on('equip_item', equipRequestObj => {
        // equipRequestObj = {slot: equipmentSlot, item: itemToEquip}
        // if unequipping, item = {name: null}
        const { item, slot } = equipRequestObj;

        equipOne(thisPlayer, item, slot);

        // full player update changes overlay, which isn't ideal...
        // ideally, we want just an equipment_update, leaving everything else the same
        socket.emit('equipment_update', {equipment: thisPlayer.equipment, inventory: thisPlayer.inventory, stats: thisPlayer.stats});
    });

    socket.on('request_township_visit', townReqObj => {
        const { name } = townReqObj;
        // console.log(`How lovely! Someone wants to visit `, name);
        thisPlayer.playStack.gps = name;
    
        let locationData = {
            name: name,
            nickname: allSouls[name].township.nickname,
            description: allSouls[name].township.townMap.description,
            history: allSouls[name].township.history.slice(-150),
            structs: allSouls[thisPlayer.playStack.gps].township.townMap.structs
        };
        socket.join(name);
        return socket.emit('location_update', locationData);
    })

    socket.on('chat_action', chatMessageData => {
        /*
            const newChatAction = {
            echo: chatMessage,
            type: 'chat',
            voice: state.player.voice || {},
            targetType: 'chatroom', // chatroom vs chatventure vs ???
            target: state.player.playStack.gps,
            token: validJWT
        };
        let newEvent = {origin: 'Zenithica', type: 'ambient', echo: ambientZenithica[rando(0, ambientZenithica.length - 1)], timestamp: new Date()};
        */
        // {echo: ``, }
        // validate against client shenanigans with jwt.verify(token, secret).name
        const decodedPlayerName = jwt.verify(chatMessageData.token, process.env.SECRET).name;
        if (allSouls[decodedPlayerName] == null) return;
        switch (chatMessageData.targetType) {
            case 'chatroom': {
                const newChatMessage = {
                    agent: decodedPlayerName,
                    echo: chatMessageData.echo || `...`,
                    timestamp: new Date(),
                    origin: chatMessageData.target,
                    type: 'chat',
                    icon: allSouls[decodedPlayerName].icon,
                    voice: chatMessageData.voice
                }
                allSouls[chatMessageData.target].township.history.push(newChatMessage);
                io.to(chatMessageData.target).emit('room_message', newChatMessage);
                break;
            }
            case 'chatventure': {
                break;
            }
            default: break;
        }
        return;
    });

    // socket.on('view_township', townshipRequestObj => {
    //     const { token, townshipID } = townshipRequestObj;
        

    //     // ADD: check to make sure townshipID exists before responding to client
    //     socket.emit('township_view_data', allTownships[townshipID]);
    // });



    socket.on('disconnect', () => {
        // handle disconnect logic
        
    });

    socket.on('logout', () => {
        if (thisPlayer == null) return;
        thisPlayer.following.forEach(soulID => socket.leave(soulID));
        socket.join('Zenithica');
        thisPlayer = undefined;
        let initialLocationData = {
            name: 'Zenithica',
            nickname: 'Zenithica',
            description: allSouls['Zenithica'].township.townMap.description,
            history: allSouls['Zenithica'].township.history.slice(-150),
            structs: allSouls['Zenithica'].township.townMap.structs
        };
        socket.emit('location_update', initialLocationData);        
    });

});

mongoose.connect(process.env.DB_HOST)
    .then(() => console.log(`Successfully connected to Township Chatventurers database.`))
    .catch(err => console.log(`Error connecting to Township Chatventurers database: ${err}`));

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.use(express.json());
app.use(express.urlencoded({extended: false}));



const PORT = process.env.PORT;

/*
Server setup...

Each day will 'save' separately, overwriting itself until the following day is a new day, which will precipitate a "new save."

That way we'll only have one entry in the DB per day, ultimately, so on server bootup it can look for the proper day's entry.
    - if the day is not found, check for the previous day; if THAT isn't found, hey, first boot, how exciting, let's make Zenithica and GO.
    - we should probably also include a "version" boot check, for Zenithica and anything else, so we can add events/updates into the code here to have them applied

So we'll want a GameState.find() or findOne() that pulls up 'today' via dateKey.
    - if not found, check 'yesterday' via dateKey.
        - if not found, brand-new server experience... create a fresh Zenithica, save this GameState with proper dateKey, and fire up the server.listen
    
Upon firing up the server, we'll have to call some built-in functionality to 'tick' the township and all active mobs
    - maybe township.wake() or somesuch that initializes some sort of timeout until next predicted 'tick' internally
    - ticking: npc adjustments, event/npc echoes to chat, 'income' from populace activities, etc.
    - since timeouts aren't "durable" in the event of server crash or reset, setting some sort of "tickTimer" makes sense
        - tickTimer: one or more expected Date() targets to move ongoing events along, such as npc tasks, mob movements, etc.
        - or maybe tickTargets?
    - having a lastTickTime makes sense for ongoing calculation, as well
    - 'sleepy ticks'... when a player is inactive, can calculate next 'tick event' in tickTargets and timeout to that; otherwise, maybe set a looong next 'general' tickTimer

Thinking on 'tick logistics' currently. I could see the argument for both global and 'local' ticks.
    - we've set up some potential tick data in each township (currently just lastTick)
    - during the tick we can calculate 'upcoming events,' save their projected timestamps into an object somewhere
    - with the 'future' defined in timestamps and outcomes/potential outcomes, we can have each one with its own setTimeout fxns
        - if it's in an array, with 'nearest upcoming' first, it'd be pretty straightforward to re-init these timeouts on server restarts
    - so then on initialization, we'd set up a sequenced barrage of purpose-driven tick timeouts/wake() functions on every township
    - it's a neat concept, but the implementation could get really nuanced, so finding a good balance will be important
    - also, consider it from a 'chatter' perspective... how often to get 'echo'-level data

*/


// set up a call to the DB to find the most current data of the game universe, or failing to find one, initialize Zenithica, init the DB with it, and FLY, you FOOLS
const today = new Date();
let todaysDateKey = calcDateKey(today);

// ADD, for below - game-loading fxn (to be called in two ~ three spots below), game-updating fxn (to be called within game-loading fxn)
// game-loading fxn should handle all the common basics of setting up global variables, setting up timers, etc.

GameState.findOne({ dateKey: todaysDateKey })
    .then(searchResult => {
        if (searchResult === null) {
            // console.log(`Failed to find a GameState dateKey for today. Attempting to load yesterday's save data instead.`);
            let yesterdate = new Date(today);
            yesterdate.setDate(yesterdate.getDate() - 1);
            let yesterdaysDateKey = calcDateKey(yesterdate);
            GameState.findOne({ dateKey: yesterdaysDateKey })
                .then(newSearchResult => {
                    if (newSearchResult === null) {
                        console.log(`NO LOAD - NEW GAME INIT`);
                        // HERE: as promised, initialize Township Chatventures via global variable allSouls for Zenithica, using TOWNSHIP logistics
                        //  - going to go ahead and more fully define townships during creation in the socket connection section, then loop back down here
                        const freshGameObject = {
                            allSouls: {
                                Zenithica: {
                                    township: {
                                        townMap: {
                                            description: `Husky husks husk around some crystals. Spooooky! Fooky?`,
                                        },
                                        nickname: '',
                                        history: []                                        
                                    }
                                }
                            },
                            allChatventures: {},
                            allSecrets: {}
                        }

                        // HERE: assuming that went well enough, saveGameState() so we're good to go for the future

                        // HERE: add checks to make sure everything is humming along, and then the server goes up

                        return loadGame(freshGameObject);
                        server.listen(PORT, () => console.log(`Township Chatventures is loaded and ready to play!`));
                    } else {
                        // game-loading! - situation pulling up yesterday
                        const gameToLoad = JSON.parse(JSON.stringify(newSearchResult));
                        console.log(`STANDARD BACK LOAD - yesterday`);
                        loadGame(gameToLoad);

                        return server.listen(PORT, () => console.log(`Township Chatventures is loaded and ready to play!`));
                    }
                })
                .catch(err => console.log(`Whoops, hit a doomed error loading yesterday's date key, so server is offline for now.`));
        } else {
            console.log(`STANDARD LOAD - same-day`);
            // game-loading! - situation of initial day-of loading
            const gameToLoad = JSON.parse(JSON.stringify(searchResult));

            loadGame(gameToLoad);

            // HERE: create some sort of 'version check' for Zenithica where we can check to make sure it has all the shops/npcs/event hooks we want
            // not entirely sure how to set that up yet, so we'll save that for a little later

            return server.listen(PORT, () => console.log(`Township Chatventures is loaded and ready to play!`));
        }
    })
    .catch(err => console.log(`Goodness, failed to load GameState altogether. That can't be good. Welp! Server is offline for now.`));

function loadGame(gameObject) {
    // start all relevant timers for game operation

    allSouls = gameObject.allSouls;
    allChatventures = gameObject.allChatventures;
    allSecrets = gameObject.allSecrets;

    updateGame(allSouls, allChatventures, allSecrets);

    gameSaveTimeout = setTimeout(() => saveGameState(), standardSaveInterval);

    // wake => tick?
    allSouls.Zenithica.township.wake = () => {
        setTimeout(() => {
            let newEvent = {origin: 'Zenithica', type: 'ambient', echo: ambientZenithica[rando(0, ambientZenithica.length - 1)], timestamp: new Date()};
            allSouls['Zenithica'].township.history.push(newEvent);
            io.to('Zenithica').emit('room_message', newEvent);
            allSouls.Zenithica.township.wake();
        }, rando(30000, 300000));
    }
    allSouls.Zenithica.township.wake();
}

function updateGame(allSouls, allChatventures, allSecrets) {
    // haxxy game update engine :P
    if (allSouls.Zenithica.township.nickname == null) allSouls.Zenithica.township.nickname = 'Zenithica';
}