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

    Quick-construction objects for the Constructor Classes to use... new Item(itemBlueprints.battleaxe, )
    ... these will get outdated pretty quickly as we go, so adjust them as we approach Live to be more inclusive of all Item class concepts

*/
// NOTE: 'hand' is the slot we want for any single-handed equipment
// should we add weight/mass considerations? dimensions of any sort? hmmm...
// oh, and quality/level, with maybe mods or mod possibilities related to some innate quality
// or maybe quality being 'innate potential' and level being 'how much it's been leveled up'?
// 'mass' is necessary for blueprints to determine how much raw material is required to construct it, though that's a bit of a later concern, as players cannot craft yet
// either way, should probably add a 'materialReq' to ensure we don't end up with stuff that's TOO wacky, like a leather axe :P
const itemBlueprints = {
    rags: {
        meta: 'equipment', type: 'armor', build: 'clothes', name: 'Tattered Rags', description: `These clothes look like they've been worn through an apocalypse.`, 
        slot: 'body', icon: {type: 'x'}, equipStats: {def: {flat: 2, amp: {vitality: 0.5}}}
    },
    fancyclothes: {
        meta: 'equipment', type: 'armor', build: 'clothes', name: 'Fancy Clothes', description: `These clothes are quite fashionable, bright, and well-tailored.`, 
        slot: 'body', icon: {type: 'x'}, equipStats: {def: {flat: 10, amp: {vitality: 1.5, intelligence: 1.5}}, res: {flat: 10, amp: {wisdom: 3}}}        
    },
    leathercap: {
        meta: 'equipment', type: 'armor', build: 'clothes', name: 'Leather Cap', description: `A simple leather cap for your noggin.`, 
        slot: 'head', icon: {type: 'x'}, equipStats: {def: {flat: 1, amp: {vitality: 0.5}}}
    },
    cap: {
        meta: 'equipment', type: 'armor', build: 'hat', name: 'cap', description: `a light cap that snugly covers the top and sides of the head`,
        slot: 'head', icon: {type: 'x'}, equipStats: {def: {flat: 10, amp: {vitality: 0.5, agility: 0.5}}, res: {flat: 10, amp: {wisdom: 0.5, intelligence: 0.5}}},
        materialReq: {flexible: 50}
    },
    helm: {
        meta: 'equipment', type: 'armor', build: 'helm', name: 'helm', description: `a straightforward, head-encompassing helm. On the heavier side, but offers good physical protection`,
        slot: 'head', icon: {type: 'x'}, equipStats: {def: {flat: 15, amp: {strength: 0.5, vitality: 0.5}}, res: {flat: 5, amp: {wisdom: 0.75, intelligence: 0.25}}},
        materialReq: {}
    },
    sword: {
        meta: 'equipment', type: 'weapon', build: 'sword', name: 'sword', description: `a simple sword`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {atk: {flat: 10, amp: {strength: 0.5, agility: 0.5}}, mag: {flat: 2, amp: {willpower: 0.25, intelligence: 0.25}}},
        materialReq: {hard: 40}, dmgMod: 1
    },
    rod: {
        meta: 'equipment', type: 'weapon', build: 'rod', name: 'rod', description: `This is a simple spellcaster's rod, somewhere in length between a long wand and a short staff.`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {atk: {flat: 2, amp: {strength: 0.25, agility: 0.25}}, mag: {flat: 10, amp: {willpower: 0.5, intelligence: 0.5}}}, 
        materialReq: {hard: 30, conductive: 60}, dmgMod: 0.7
    },
    axe: {
        meta: 'equipment', type: 'weapon', build: 'axe', name: 'axe', description: `This is a straightforward, single-headed axe, just somewhat larger than a hatchet.`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {atk: {flat: 12, amp: {strength: 1}}, mag: {flat: 1, amp: null}},
        materialReq: {hard: 50}, dmgMod: 1.1
    }, 
    buckler: {
        meta: 'equipment', type: 'shield', build: 'buckler', name: 'buckler', description: `a small, nimble shield`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {def: {flat: 10, amp: {strength: 0.25, agility: 0.75}}},
        dmgMod: 0.5
    }, 
    shield: {
        meta: 'equipment', type: 'shield', build: 'shield', name: 'shield', description: `a large, round shield`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {def: {flat: 10, amp: {strength: 0.75, vitality: 0.25}}},
        dmgMod: 0.75
    }
};

// by tier-key
// material, adjective, prefix, etc. to modify; such as Heavy Steel Greatsword, Gleaming Coldsteel Cutlass
// totally haven't figured out weaponMods yet :P
// should we just add 'em all together, or have them modify each other, and then the item?
// ... definitely the latter, but much later

// also want to add special effects such as AMPS 
const weaponMods = {
    0: {
        balanced: {
            name: 'balanced', tier: 0, type: 'mod', description: `has been carefully balanced`, cost: {nrg: 1.4}, materialReqChange: {},
            equipStats: {atk: {flat: 2, amp: {agility: 0.25}}}
        }, 
        heavy: {
            name: 'heavy', tier: 0, type: 'mod', description: `is built thick and heavy`, cost: {nrg: 1.2, rawMaterial: 1.2}, materialReqChange: {},
            equipStats: {atk: {flat: 2, amp: {strength: 0.25}}}
        },
    }
};
const headMods = {};
const shieldMods = {};
const armorMods = {
    0: {
        heavy: {
            name: 'heavy', type: 'mod', tier: 0, description: `has been crafted with a dense, layered design`, cost: {nrg: 1.5, rawMaterial: 1.2},
            equipStats: {def: {flat: 2, amp: {vitality: 0.25}}}
        }
    }
};
const universalMods = {};

const weaponPrefixes = {
    0: {
        good: {
            name: 'good', tier: 0, description: `possesses an elongated grip for two-handed wielding`, cost: {nrg: 2}, materialReqChange: {},
            slotMod: 'doublehand', equipStats: {}
        }
    }
};

// let's figure out how MATERIALS work! ... mostly for the purposes of equipment modding
// and maybe general workability, although for now 'tier' and maybe type can cover that
const materials = {
    0: {
        copper: {
            name: 'copper', tier: 0, type: 'metal', meta: 'magical', traits: {hard: 50, flexible: 30, conductive: 60}
        },
        bronze: {
            name: 'bronze', tier: 0, type: 'metal', meta: 'physical', traits: {hard: 60, flexible: 20, conductive: 50}
        },
        leather: {
            name: 'leather', tier: 0, type: 'leather', meta: 'physical', traits: {hard: 15, flexible: 80, conductive: 40}
        },
        pelt: {
            name: 'pelt', tier: 0, type: 'leather', meta: 'magical', traits: {hard: 10, flexible: 90, conductive: 70}
        },
        pine: {
            name: 'pine', tier: 0, type: 'wood', meta: 'magical', traits: {hard: 30, flexible: 45, conductive: 60}
        }, // may replace with some other wood for 'soft/magical wood' entry
        oak: {
            name: 'oak', tier: 0, type: 'wood', meta: 'physical', traits: {hard: 40, flexible: 40, conductive: 40}
        }
    },
    1: {
        iron: {},
        'tough leather': {},
        maple: {},
    },
    2: {
        steel: {},
        'rugged leather': {}
    }
}

// IDEA: upon server startup, define an array of allWeaponBlueprints, allSwordBlueprints, etc. for mob/shop/etc spawning purposes
// would be even better if we could define 'tiers' of equipment, or levels on the equipment, and roll from there as well
// for further dilution of pools, such as 'all axes,' we can run THOSE specific requests as-needed in specific scenarios


// HERE: all relevant JS classes
/*

    TIME TO MAKE ITEMS EXIST! Great!
    type: equipment, consumable, ?
    build: sword, potion, axe, staff, spear, helm, armor, robes, etc.
    specbuild: just a more specific class of the build, such as katana, scimitar, battleaxe, greatsword, etc.
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
    value: derived from the quality, construction, upgrades, etc.

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


    mass, materials/construction (ref?), 

*/
class Item {
    constructor(blueprint) {
        this.type = blueprint.type;
        this.meta = blueprint.meta;
        this.build = blueprint.build;
        this.specbuild = blueprint.specbuild || `nonsense`;
        this.name = blueprint.name;
        this.description = blueprint.description;
        this.slot = blueprint.slot;
        this.icon = blueprint.icon;
        this.materials = {};
        this.mods = {};
        this.prefixes = {};
        this.mass = blueprint.mass || 1;
        this.equipStats = blueprint.equipStats;
        this.dmgMod = blueprint.dmgMod || null;
        this.materialReq = blueprint.materialReq || {};
        this.id = generateRandomID();
    }

    init() {
        console.log(`Build a new item! The ${this.name}`)
    }

    construct() {
        // takes into consideration materials and mods, splices together descriptions, and adds capitalization and periods to bring it home
        // delete extras such as materialReq, if has been baked in
        // grab a mod.name and capitalize it, grab a/the material.name and capitalize it, grab this.prefixes[0] and capitalize it, then graft with this.name OR capitalize name
        // go through and sum all the new stats into the this.equipStats WOO
        let originalName = this.name;
        let finalNameString = ``;
        if (Object.keys(this.mods).length > 0) {
            console.log(`I am of mods!`)
            let modSource = this.mods[Object.keys(this.mods)[0]].name;
            finalNameString += modSource[0].toUpperCase() + modSource.substring(1) + ` `;
        };
        if (Object.keys(this.materials).length > 0) {
            console.log(`I am of materials!`);
            let materialSource = this.materials[Object.keys(this.materials)[0]].name;
            finalNameString += materialSource[0].toUpperCase() + materialSource.substring(1) + ` `;
        }
        if (Object.keys(this.prefixes).length > 0) {
            console.log(`I have a prefix!`);
        } else {
            console.log(`No prefix for me!`);
            finalNameString += originalName[0].toUpperCase() + originalName.substring(1);
        };
        this.name = finalNameString;
        console.log(`Congratulations! You have crafted a new item called a ${this.name}, whose stats look like this: `, this);
        return this;
        // 
    }
    addMaterial(material) {
        // HERE: check to make sure material is approproiate for this item's construction

        console.log(`Constructing the ${this.name} with a specific material: ${material.name}`)
        this.materials = {...this.materials, material};
        return this;
        // here: parse material stats in
    }
    addMod(mod) {

        console.log(`Constructing the ${this.name} with a specific mod: ${mod.name}`)
        this.mods = {...this.mods, mod};
        return this;
    }
}

// const newSword = new Item(itemBlueprints.sword).addMaterial(materials['0'].bronze).addMod(weaponMods['0'].balanced).construct();



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

function pickOne(optionArray) {
    return optionArray[rando(0, optionArray.length - 1)];
}

class Achievement {}

/*
!MHR
CHATVENTURE BLUEPRINT TIME!
Defining a chatventure, redux.

Chatventures need to have the capacity to serve as both 'choose-your-own-adventure' modes with or without time limits,
    as well as 'oh whoa live fire text-based game' mode

Let's try our first CHATVENTURE as perimeter patrol, where AI-less Husks roam just to be battered into oblivion for loot and exp :P
... then we can expand the patrol to be more nuanced, taking into consideration specific local factions and mobs in surrounding areas to various degrees
    - and, ideally, their current aggression level and interest in the township itself! ... having some factions be 'up to something' with some regularity would be cool
    - that would lead to 'productive patrols' and the need/desire to manually patrol periodically (or allocate resources to having the township attempt to handle it)

    so these can be created through STRUCTS, as we know, but also through events, items, whatever else have you
    - for now, we know that the PATROL function is called through the perimeter struct, taking the initiating player as a param
    - this will allow all the 'contextual variables' to be factored in and for that player to be 'inserted' into the chatventure on all fronts

The main job of the blueprints/class below is just to create an instance of a chatventure with all the pieces necessary to 'run' it
    - currently thinking of it like a MUD-room with choose-your-own-adventure bits to it

So any given time, the chatventure should have 'intermittently running relevant occurrences/events' to see/potentially respond to
    - some flavor stuff, just giving atmosphere
    - some relevant stuff that opens up additional chatventureChoices

OH, chatventures can have 'speed settings' so the 'owner' can modify everyone's SPD with a 'chatventureSpeedSetting' modifier to slow down (or maybe even speed up) battles

Anyway, we also want the ability to RAILROAD some chatventures for 'story events,' allowing the player to adventure through options trees and have these choices matter
    - procedurally generating interesting chatventure trees is definitely an entire endeavor unto itself

Defining chatventure variables:
    chatventure: {
        id: 'uniqueString', // for everyone to be on the same 'page,' so to speak
        type: 'patrol', // referencing the proper blueprint for calling specific functionalities, potentially
        creator: playerName, // just a string so we can reference them for whatever
        players: {}, // of format 'playerNameKey': playerRef
        factions: {friendly: {}, foely: {}}, // maaay not need this one?...
        mobs: {}, // for any 'live' NPCs, may include hostile potentially hostile NPCs, haven't decided yet
        participantLimit: 100, // at what point does it become a fire hazard? :P ... sets limit on how many pcs and npcs can hop into the chatventure
        joinRules: {...}, // circumstances under which a chatventure can be joined; it's general joinability :P
        visibilityRules: {...}, // laying the groundwork for being able to 'watch' chatventures, or see them in order to go interact with them... LOCATE, SWMIRROR concepts
        events: {}, // key is creator/originator/initialtarget name for any given event (including battle), with type and seedData, which is to be used to 'reconstruct' unfinished events if they need to be rebooted
        mode: '', // thinking this is to help the client parse the chatventure data for display purposes, showing/hiding; player mode can differ from chatventure mode?
        options: [], // what the player(s) currently can do; objects with echo, whoCanChoose (such as END CHATVENTURE being creator-only)
        staging: {}, // who, what, where, when, how ... essentially, locationData writ smaller?
        progress: [], // history of staging? maybe choices/outcomes?
        history: [], // where the chats and such go
    }

    SO! playStack.mode = 'chill'; can change to playStack.mode = 'trade' or 'patrol' for example, then playStack.doing = the EVENT they're tied to
        - some events get 'shared,' or can be shared, such as a battle; others are independent, such as NPC chatting 
        - chatventure.events have type, seedData, and history for sub-chat (sub-sub-chat, really) fxnality

    WHAT ELSE?
    - each chatventure is a ROOM. let's establish that now, so multi-room stuff is for separate chatventures, done for now
    - so maybe e.g. for patrols, the perimeter (related to township size?) can support X number of separate chatventures representing different 'areas' of patrol
    - whereas for a general store's trade option, it's a single 'sales floor' area, so you're either in the shopping menus or chatting away in that area
    
    - so, SET THE STAGE: who/what is around, what broad (top-level) options are available, and then what options are 'attached' to entities
        - all the various 'actors' ... hm, how to set it up? players and their party, obviously at minimum
        - then any 'necessary' interactable bits


    CHATVENTURE MODES
    Meta: with latest conceptual changes, events divides up the 'attention' of different players doing different things...
        ... so if the mode is NOT chill, or null, or whatever, then it means everyone is being FORCED into a specific scenario
    - chill: take your time, do what you'd like, watch events roll by with the possibility of new options cropping up
        - distinguishing feature of this mode is it's chat-primary, allowing you to respond to stuff happening, or just eff around with abilities
        - going into a shop in a township has this mode, as does patrolling, and probably exploring for a lot of it
    - battle: battleground(s) are active, time to RUMBLE!
    - choose: you're interacting with some combination of environment or npc(s)
    - trade: you're knee-deep in the current context's wares!

    ... updated context/index's initial playStack object to include more useful data to render options


    CHATVENTURE OPTIONS - ARRAY OF OBJECTS
    option: {
        echo: `Button Says This`,
        description: ``, // 
        whoCanChoose: 'ffa', // a code for whether it's creator-only, anyone participating, etc.
        optionFlags: {type: 'engage'}

    }

    BIG QUESTIONS ON IMPLEMENTATION
    - for chill-style modes, how do we determine ambient event possibilities?
    - how do we determine what options are available and when?
    - for chatventures that lead to trading, for example, how should we allow players to shop independently?
        - basically, implementing 'sub-modes'... each player can engage with options independently in some cases


    The good news is that if we can get PATROL up and running, we can call that 'good' for alpha purposes!
    -- well, and shopping. and maybe exploring. :P




    

*/
// const chatventureBlueprints = {
//     'chill': {
//         type: 'chill'
//     },
//     'patrol': {
//         type: 'patrol', 

//         init() {
//             // this may be used just to get all timers going and/or to scoot in all relevant participants
//         },
//         createOptionObj(agent, optionFlagData) {
//             // this allows us to create the optionObj dynamically and then pass it down to parseOption
//             const optionObj = {...optionFlagData, agent: agent};
//             chatventureBlueprints['patrol'].parseOption(optionObj);
//         },
//         parseOption(optionObj) {
//             // when someone chooses an option, this 'resolves' it for them
//             switch (optionObj.type) {
//                 default: break;
//             }
//         }
//     },
//     'trade': {
//         type: 'trade',
//     }
// }

const chatventureFunction = {
    leaveChatventure(agent) {
        // get 'em outta there! ... with their party, probably ... io.to everyone and the chatventure, as well
        // this should also update player_data, player_update style

        // HERE, later: check to make sure the agent is capable of leaving the chatventure... physically, mentally, logistically

        const chatventureID = allSouls[agent.name].chatventure.id;

        if (agent.entityType === 'player') {
            delete allChatventures[chatventureID].players[agent.name];
            allSouls[agent.name].chatventure = null;
            allSouls[agent.name].playStack = {...allSouls[agent.name].playStack, chatventure: null};
            io.to(agent.name).emit('player_update', allSouls[agent.name]);
        }



        // IF the chatventure is now empty of players {}, deconstruct it ... we may handle this a bit differently in the future, if chatventures desire to self-run a bit
        if (Object.keys(allChatventures[chatventureID].players).length === 0) {
            console.log(`Oh! The chatventure that ${agent.name} just left is now devoid of players. Begone!`);
            delete allChatventures[chatventureID];
        } else {
            const eventObj = {
                echo: `${agent.name} just peaced out.`
            }
            Object.keys(allChatventures[chatventureID].players).forEach(playerName => {
                io.to(playerName).emit('chatventure_event', eventObj);
            });
        }

    },
    generatePatrolMenu(agent) {
        // !MHRpatrol
        // this one will need context, which could theoretically be provided assuming the CHATVENTURE OBJ has data on where it's taking place
        // remember, we're changing playStack.mode and playStack.doing to be 'chill'/'battle'/'menu' and associated ID, respectively

        // IDEALLY, the patrol's results would be township/context-specific, but for now? tooootally generic is fine, upgrade later after core concept is secure
        // ooh, traveling traders could crop up, too! ... well, maybe more in explorations... at any rate, consider this after shopping is a thing we can do

        const patrolRNGResult = rando(1,10);
        let patrolID = generateRandomID(`${agent.name}patrol`);
        let patrolPrompt = `You patrol around the perimeter of the township. `;
        let patrolMenu = [];
        let patrolPotentialEncounter = null;
        switch (patrolRNGResult) {
            case 1:
            case 2:
            case 3:
            case 4:
                {
                    patrolPrompt += `You find a Husk wandering about, looking rather unthreatening.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;
                }
                
            case 5:
            case 6:
            case 7:
                {
                    patrolPrompt += `You find a Husk staring vacantly at the township.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;
                }
                
            case 8:
            case 9:
                {
                    patrolPrompt += `You find an aggrevated Husk pacing about, muttering nonsense to itself.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;
                }
                
            case 10:
                {
                    patrolPrompt += `You encounter an aggressive, sharp-eyed Husk. You just barely avoid its notice as it stalks along its path.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;
                }
            default: break;
                
        }
        patrolMenu.push({
            echo: `Just leave.`,
            onSelect: `dismissMenu`
        });

        // we want to create the menu, throw its contents including npc/mob blueprints into chatventure.events, and then share it down to player via io
        // so, we need to know: what does the MENU (array?) look like, how do we structure it and slide it in, and how do we resolve it in the next fxn below
        // oh, and the menu needs a prompt to give the player

        // ok, so now we should have patrolID patrolMenu [{echo, onSelect}, {...}], patrolPrompt ``, and patrolPotentialEncounter of a single mob, excitement
        // later on: MOAR mobs (and/or stronger mobs)

        let menuData = {type: 'menu', prompt: patrolPrompt, menuItems: patrolMenu, id: patrolID, mobData: patrolPotentialEncounter};
        menuData.playersViewing = {};
        menuData.playersViewing[agent.name] = true;
        

        allChatventures[agent.chatventure.id].events[patrolID] = menuData;
        allSouls[agent.name].playStack = {...allSouls[agent.name].playStack, mode: 'menu', doing: patrolID, menu: menuData};

        // HERE: player_update, and then reconfig webclient to respond to playStack.mode @ menu and playStack.menu
        io.to(agent.name).emit('player_update', allSouls[agent.name]);
        
        return;
    },
    resolvePatrolMenu(agent, choice) {

    },
    openExploreMenu(agent) {
        // this one will also need context
    }    
}

// ok! the goal here is to have option-making buttons that create fully functional 
const createChatventureOption = {
    chill() {},
    trade() {},
    patrol(echo) {
        return {echo: echo?.toUpperCase() || `PATROL`, onSelect: 'generatePatrolMenu', whoCan: 'any'};
    },
    explore(echo) {
        return {echo: echo?.toUpperCase() || `EXPLORE`, onSelect: 'openExploreMenu', whoCan: 'any'};
    },
    fight() {},
    leave(echo) {
        return {echo: echo?.toUpperCase() || `LEAVE`, onSelect: 'leaveChatventure', whoCan: 'any'};
    },
    test() {
        /*
        
        OK! This will be our test case to make sure it all works, as the name suggests. Now!
        ... hm. This may be a job for a Class, again. Or not. Let's see how she flies.
!MHRY
        OPTION BUTTON BITS:
        {
            echo: `CLICK ME`, // what the button reads as; defaults to
            onSelect: chatventureFunction to call,
            whoCan: 'any' // any, creator, ???
        }

        // oh, should we return a whole buncha buttons, potentially? like EXPLORE options will be more than one... maybe?
        
        */
        // this one is just to enter a semi-blank 'event' sub-menu that can be dismissed and has no meaningful actual options :P
    }
};



/*
    OK-doke, we want LOCATION data. What will this entail?
    Eh, it can be a single handy object that can be used to reference a source and help create the staging.
    gps: soulRef
    atMap: townMap or worldMap
    area: areaKey or null
    struct: structKey or null
*/
class Chatventure {
    constructor(creator, location) {
        this.id = creator != null ? generateRandomID(creator.name) : generateRandomID('chv');
        this.type = 'chill';
        this.creator = creator.name;
        this.players = {};
        this.players[creator.name] = creator;
        this.mobs = {};
        if (creator.party != null) {
            Object.keys(creator.party).forEach(entityID => {
                if (creator.party[entityID].entityType === 'player') this.players[entityID] = creator.party[entityID];
                if (creator.party[entityID].entityType === 'npc') this.mobs[entityID] = creator.party[entityID];
                if (creator.party[entityID].entityType === 'mob') this.mobs[entityID] = creator.party[entityID];
            });
        }
        this.joinLimit = 100;
        this.joinRules = {};
        this.events = {};
        this.mode = 'chill';
        this.options = {};
        this.staging = {};
        this.location = location || {gps: `Zenithica`, atMap: `townMap`, struct: `nexus`, area: null};
        this.history = [];
    }
}

const mobBlueprints = {
    'husk': {
        name: `a Husk`, blueprintRef: 'husk', entityType: 'mob', level: 1, stats: {strength: 20}, variants: []
    }
}

class Mob {
    constructor(blueprint) {
        this.name = blueprint.name;
        this.blueprintRef = blueprint.blueprintRef;
        this.level = blueprint.level || 1; // keep for now; some mobs can have a 'minimum level' specified
        this.entityType = blueprint.entityType;
        this.id = generateRandomID(this.entityType);
        this.inventory = blueprint.inventory || [];
        this.chatventureID = null;
        this.currentChatventureEventID = null; // which 'event' they're currently living in, such as a battle or menu?
        this.soulHome = null;
        this.wallet = blueprint.wallet || 0; // for... purposes!
        this.stealInventory = blueprint.stealInventory || []; // will likely refactor
        this.loot = null; // gotta figure out how to handle loot mechanics
        this.equipment = {rightHand: null, leftHand: null, head: null, body: null, accessory: null, trinket: null};
        this.stats = {strength: 10, agility: 10, vitality: 10, willpower: 10, intelligence: 10, wisdom: 10, atk: 10, def: 10, mag: 10, res: 10, hpmax: 50, hp: 50, mpmax: 50, mp: 50}; // 'base' stats
        this.stats = {...this.stats, ...blueprint.stats}; // overwrite with any 'base' stats provided by the blueprint
        this.ai = blueprint.ai || null; // ai for behavioral possibilities
        this.plan = {}; // backup for timeout actions for re-init/server restore
    }
    levelTo(level) {
        // this: separate level-up fxn
    }
    init(locationData) {
        // generate equipment & equipOne through the list, calcStats, apply effects, scale to level?
        // could use blueprintRef @ mobBlueprints to help roll up level-appropriate data/abilities/stats/equipment/etc.
        // probably should include some param(s) to help init chatventureID for mobs, location information for NPCs?
        // can pull together a calcStats fxn for players and mobs alike, apply it here
        // console.log(`A new mob has spawned! Looks like this: `, this);
    }
    actOut() {
        // or could call this WAKE, but start behavior timeout
    }
}
// let Bob = new Mob(mobBlueprints.husk).init();

// what can ya build? how can ya build it? what does it do? 
/*



Constructing some structing
- nexus is the conduit for inter-chat travel
- perimeter is the perimeter of the township, the gateway to 'scouting'/patrolling/local area chatventuring

BRAINSTORM:
Many of the below can be constructed in various ways, such as a blacksmith tent or blacksmith cabin; class-buildings are likely an exception due to their nature
[o] Construction Types: tent/hut/shack, cabin/house, building/shop, hall
- tavern
- den (rogue)
- barracks (fighter)
- temple or sanctuary (sympath)
- tower (mage)
- foolplace (only there in minstats scenario)
- general store
- lumberjack
- mining
- blacksmith
- leatherworker
- clothier
- apothecary
- stables
- townhall
- training yard

so what do we need to know about structs?
    generatedRandomID or fixed name, depending: {
        type: '',
        nickname: '',
        description: '',
        innerDescription: '',
        level: 1,
        interactions: {shop: {buy: [], sell: []}},
        icon: {},
        gps: {},
        dimensions: {x: 1, y: 1, z: 1},
        construction: {}, // what it's made of... different materials can confer different effects/stat boosts?
        boosts: {township: {}, player: {}},
        inventory: {wares: [], construction: {}, wealth: 00, }, // we'll track these for... reasons!
    }

    NOTE: we can include 'extra' stuff the Class does NOT inherit here, such as special methods for naming, upgrade/level data, etc.
    ... and we can further play with method inheritance, if we're feeling especially spunky for future struct permutation

*/
const structBlueprints = {
    'nexus': {
        type: 'nexus', nickname: `The Nexus Crystals`, 
        description: 'A jagged crownlike blossom of translucent blue crystal, standing twice the height of a tall man, that acts as the heart of the township.',
        innerDescription: 'How did you even get IN here? Crystals! Crystals everywhere!',
        level: 1, interactions: {nexus: 'nexus'}, icon: {}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, 
        construction: {hub: {crystalline: 100, complexity: 500}},
        boosts: {township: {}, player: {}},
        inventory: {construction: {}},

        nexus() {},
        init(newNexus, area) {
            newNexus.description = `${area.nickname}'s Nexus is a jagged crownlike blossom of translucent blue crystal, standing twice the height of a tall man, that acts as the heart of this township.`;
            return;
        }
    },
    'perimeter': {
        type: 'perimeter', nickname: `Township Perimeter`,
        description: `I have nothing to say about what I am, for I have not been initialized properly, and therefore am at least partially ERROR.`,
        innerDescription: `You stand upon the perimeter of the township.`,
        level: 1, interactions: {visit: {patrol: 'patrol', explore: 'explore'}, patrol: 'patrol', explore: 'explore'}, icon: {}, gps: {}, dimensions: {x: 0, y: 0, z: 0}, // hm, gonna have to rethink how to define perimeter dimensions
        construction: {}, // not yet filled with walls and towers and gates
        boosts: {township: {}, player: {}},
        inventory: {construction: {}},

        patrol(agent, origin) {
            // THIS: calling this should fully initialize a chatventure's initial state, including any necessary timeouts, events, participants, and other conditions

            // what else do we need to know? let's consider...
            // through some dark JS sorcery, uh... this all works! so, um, awesome. that makes calling universal struct functions much easier.
            // structBlueprints['perimeter'].patrol('Blue');
            // structBlueprints['perimeter']['patrol']('Red');
            // structBlueprints['perimeter'][structBlueprints['perimeter'].interactions.patrol]('Lord Dekar');
            
            /*
            
            OK, let's get this going...
            - any 'chillable' struct should have a VISIT object that loads a default CHILL MODE with listed sub-options as well
            - those structs, such as above, can also have top-level buttons for those options that can be "jumped to" in the likely case you don't care to 'hang out'
            
            */

            return console.log(`A new patrol is FULLY POSSIBLE THROUGH THE MAGIC OF JAVASCRIPTING!! :D`);
        },
        explore(agent, origin) {},
        visit(agent, origin) {
            /*
            !MHRX
            Ok, here we go!
            - AGENT is the requesting entity, currently definitely a player
            - ORIGIN is the object that was used to begin the chatventure, currently absolutely the struct in question, but later... who knows! magic items! Narnian furniture!

            - substantiate a 'chill' mode chatventure centered on the origin
            - what else do we need to know to get this set up properly?
            - ... probably nothing else, actually; this is just 'hanging out at/in the struct,' so it's just to chat and mess around with abilities
            - that said, we DO want access to the other interactions of the struct so we can make buttons out of them and hit them up at discretion
            - for now, just making a MUDroom and scooting the player in there is golden, so let's do that!

            - oh, what if a chatventure already exists for the thing that wants to be visited? ideally we JOIN the pre-existing chatventure in that case
            - ok, new characters should now have interactionChatRefs on their township stuff; interactionChatRefs['visit'] will be null if no chatventure, or ID if so
            - we can work with this now!
            
            - CONSIDER: since we're nesting through the ORIGIN, maybe a BELONGSTO to point to the original allSouls key so we can backsolve gps stuff

            OK! So we can now have a player call visit(player, theirPerimeter)...
            We can check origin.interactionChatRefs['visit'] to be null or a chatventureID

            now then! making a new chatventure! let's go grab a ref for chatventure class, as well as blueprints...



            */
            // ...

            switch (origin.interactionChatRefs['visit']) {
                case null: {
                    // we're going to rather recklessly assume the gps of the player's playStack.gps
                    console.log(`${agent.name} is trying to visit ${origin.nickname}. Turns out that chatventure doesn't exist yet! So we must create it!`);
                    // it makes sense to actually have reference to the local worldMap -always-, but currently the township doesn't 'attach' there
                    // so localAreaMap for each would include the township?
                    const visitLocation = {
                        gps: agent?.playStack?.gps || `Zenithica`, atMap: `townMap`, struct: origin, area: null
                    }
                    let newChatventure = new Chatventure(agent, visitLocation);
                    newChatventure.staging = {description: `You are standing in a timeless void, because new Chatventure()s don't accept location information yet.`};
                    Object.keys(origin.interactions).forEach(interactionKey => newChatventure.options[interactionKey] = {});
                    delete newChatventure.options['visit'];
                    // HERE: probably go ahead and substantiate them options...
                    // how, you ask? through type blueprinting! ... probably! 
                    // theoretically the struct itself should have sufficient seed data for any viable event, such as trading or adventuring
                    // a lot to wrap the ol' noodle around with all this...
                    // anyway, option-initing will vary from struct to struct, so chatventureBlueprints should now be OPTION initialiation, woo!
                    /*
                    
                    What a head-twister this whole affair is. Woo-ee.
                    Ok. So here we need to initialize all options, including a LEAVE option that just lets you depart the chatventure (with your party?)
                        ... I'm a little worried that party stuff will get wacky-wild pretty quickly :P
                    
                    We know that this is the VISIT for perimeter. Should we lean into that?

                    Inheriting the interactions from the struct is a good start, we're doing that already.
                    ... so the chatventureOptionBlueprints for each can GENERALIZE their creation.

                    meaning that we take in an optionalEcho, and then try to decide what other data the option needs in order to create its event/result

                    PATROL needs local monster data, which... we haven't even begun to create any version of :P
                    LEAVE doesn't need much of anything
                    VISIT is already happening and isn't really an event
                    TRADE needs to be able to load information to let the player send data about what they want to buy and sell, productively
                    EXPLORE needs data on what can be explored, and will branch out into a new chatventure tied to a given explorable place?
                    FIGHT THAT GUY options need to be present, too

                    doing CHILL just lets us rest at the area and see nonsense go by

                    ... in the end, we need each OPTION to have enough in it to be able create or join an event for a player ('doing' in playStack)



                    
                    */
                    newChatventure.options['leave'] = createChatventureOption['leave'](`LEAVE`);
                    newChatventure.options['patrol'] = createChatventureOption['patrol'](`PATROL`);
                    newChatventure.options['explore'] = createChatventureOption['explore'](`EXPLORE`);
                    
                    
                    console.log(`A NEW CHATVENTURE LOOKS LIKE THIS: `, newChatventure);

                    // HERE: allChatventures - created
                    allChatventures[newChatventure.id] = JSON.parse(JSON.stringify(newChatventure));

                    /*
                    !MHRZ
                    playStack.chatventure should become the ID
                    ok, player.chatventure = {id: null} is our default, and can hold all chatventure data from there
                    MEANING... huh. doooo we want double refs? in playStack AND chatventure?
                    playStack yes. chatventure also I guess yes? ok, we're fine, let's do that; two different purposes being served


                    
                    */
                    // HERE: update player(s) in allSouls with all their proper data
                    allSouls[agent.name].chatventure = allChatventures[newChatventure.id];
                    allSouls[agent.name].playStack = {...allSouls[agent.name].playStack, chatventure: newChatventure.id, mode: newChatventure.mode};

                    // HERE: io.to everybody involved proper GET INTO THIS CHATVENTURE data for client reconfig
                    // NOTE: we can just send to the player's pre-existing name channel, we don't need a new one, just reconfigure the data conditionals
                    // NOTE ALSO: we can proooobably get away with a full player update having the desired effect here? let's try that first...
                    // io.to(agent.name).emit('begin_chatventure', newChatventure);
                    // console.log(`SENDING THIS PLAYER DOWN WITH NEW CHATTY DATA, I hope: `, allSouls[agent.name]); // this all looks good, so let's see...
                    io.to(agent.name).emit('player_update', allSouls[agent.name]);


                    // HERE: io.to chatventure history everybody that's showing up
                    break;
                }
                default: {
                    console.log(`${agent.name} is trying to visit ${origin.nickname}, and we found a ref, so we should join the chatventure with ID of ${origin.interactionChatRefs['visit']}`);
                    break;
                }
            }

            return;
        },
        init(newPerimeter, area) {
            // first example of this function's use... ideally, 'reads the room' of the township context for any struct to help 'personalize'
            // this is also called upon first introduction of the completed struct to the area, including any context data
            // for now it doesn't need to really do much, though :P
            newPerimeter.interactionChatRefs = {};
            Object.keys(newPerimeter.interactions).forEach(interactionKey => newPerimeter.interactionChatRefs[interactionKey] = null);
            newPerimeter.description = `${area.nickname}'s perimeter is currently only a concept, an imaginary but agreed-upon line that divides what is 'township' from what is wilderness.`;
            return;
        }
    },
    'tavern': {
        type: 'tavern', nickname: `Township Tavern`,
        description: `A simple but functional building that serves as a watering hole, entertainment hub, and in a pinch, a place for weary travelers to rest.`,
        innerDescription: `It's pretty quiet in here. Somebody is probably pouring drinks somewhere. Someone is drunk and asleep in the corner.`,
        level: 1, interactions: {visit: {recruit: 'recruit', rest: 'rest'}, recruit: 'recruit', rest: 'rest'}, icon: {}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, // hm, gonna have to rethink how to define perimeter dimensions
        construction: {mainHall: {lumber: 100, complexity: 20}},
        boosts: {township: {}, player: {}},
        inventory: {construction: {}},

        recruit() {},
        rest() {},
        init(newTavern, area) {}
    },
    'general store': {
        type: 'general store', nickname: `Township General Store`,
        description: `A simple but functional building that serves as a watering hole, entertainment hub, and in a pinch, a place for weary travelers to rest.`,
        innerDescription: `It's pretty quiet in here. Somebody is probably pouring drinks somewhere. Someone is drunk and asleep in the corner.`,
        level: 1, interactions: {visit: {trade: 'trade'}, trade: 'trade'}, icon: {}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, // hm, gonna have to rethink how to define perimeter dimensions
        construction: {mainRoom: {lumber: 100, complexity: 20}},
        boosts: {township: {}, player: {}},
        inventory: {construction: {}, wares: {weapons: {}, armor: {}, tools: {}, items: {}}},

        init(newStore, player) {
            // takes in a store and mods its initial wares into some combination of useful stuff
            // it'd be neat if it read the "vibe" of the town to procure maximally useful starting wares for user's starting class
            // we're passing in the whole-arse player so we have access to ALL their variables, including township, to make some informed and whimsical choices
            // NOTE: all wares are 'blueprints,' so should meet all the necessary criteria to make a new Item()
            // we can get cheeky and use pre-existing blueprints as a model for shop wares, rolling fanciful to fruitful changes to baseline gear
        },
        trade() {
            // doopty doo ... init the 'trading' chatventure
        },
        init(newStore, area) {}
                  
    },
    'stockpile': {
        type: 'stockpile', nickname: `Township Stockpile`,
    }

};




class Struct {
    constructor(blueprint) {
        this.id = generateRandomID('struct');
        this.entityType = 'struct';
        this.name = blueprint.name;
        this.type = blueprint.type;
        this.nickname = blueprint.nickname;
        this.description = blueprint.description;
        this.innerDescription = blueprint.innerDescription;
        this.level = 1;
        this.exp = 0;
        this.interactions = blueprint.interactions;
        this.icon = blueprint.icon;
        this.gps = blueprint.gps;
        this.dimensions = blueprint.dimensions;
        this.construction = blueprint.construction;
        this.boosts = blueprint.boosts;
        this.inventory = blueprint.inventory;
    }
}

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
    tier: 123, // 'pecking order' of classes; higher tiers scale up the reqs and costs automatically, probably?
    requirements: {
        target: 500,
        levelMod: 100,
        classMods: {warrior: 50, rogue: 100},
        statMods: {stat: modNum},
        ...?
    }, // an alternative model for requirements that's "softer" in that you just gotta hit the target based on your values * the given mods in total
    // oh that way we can also start revealing an unlockable class as we begin to meet requirements! neato!
    // there can also be 'hard' requirements like meeting a certain npc or npc type, doing a quest, whatever else on the 'actually gain the class' bit
    // by default we need to find a 'source' to begin learning the class, and that source can be the 'gatekeeper' for any hard req(s)
    // ooh and npcs can have 'teaching' mods to costs, now or later, for abilities and maybe even classes
    // maybe same for pcs
    levels: [{stats, skills, permaStats, permaSkills}, {}], // handy array for levels from 0 onward! ... we can simplify the math by having the 'total' boost for each class in each
    abilities: {ability1key: true, ability2key: true, etc.}, // just a quick ref to abilityBlueprints
    initialAbilities: {}, // all the abilities this class 'starts' with, so as soon as the class is earned, ta-da, you know these!
    prefixes: {...do we want to call them that? :P} ... alternatively, just have all prefixes come from achievements and levels
}
... we can have levels[0] either be null or an object with nothing really in it, as we'll want to be starting our level at 1 for sanity's sake



All abilities are tied to a class. Leveling them up adds EXP to the class! Neat.
    - expLevel and useLevel, separate concerns
    - only actives can gain through useLevel, probably... though if we got quite fancy we could check when certain passives are checked?
    - nah, only actives for now



*/
const classBlueprints = {
    'rogue': {
        tier: 1,
        requirements: {target: 100, levelMod: 20, classMods: [], statMods: []},
        levels: [
            null,
            {expReq: 0, stats: {}, skills: {}, permaStats: {}, permaSkills: {}},
        ],
        abilities: {},
        initialAbilities: {}
    },
    'fighter': {},
    'sympath': {
        tier: 1,
        requirements: {target: 100, levelMod: 20, classMods: [], statMods: []}
    },
    'sorcerer': {},
    'fool': {},
    'tinker': {}
};

/*

Building Classes - at least the first few levels!


ROGUE
    [Actives]
    - steal swag/wealth
    - steal balance
    [Passives]
    - 

FIGHTER
    [Actives]
    - bigolhit @ damage + unbalance
    - guard
    - cover
    - provoke
    [Passives]
    -

SYMPATH
    [Actives]
    - zephyr (wind1)
    - calm/sleep (wind2)
    - purify (water1)
    - endure (earth1)
    - unfocus
    [Passives]
    -

MAGE
    [Actives]
    - flamecast
    - frostcast
    - boltcast
    // water, earth, and wind are more advanced and nuanced, so even these 'brute force' versions have higher reqs
    - watercast
    - earthcast
    - windcast
    - shield
    - intuit
    - charged air // 'field' magic for changing the local environment, a little or a lot
    [Passives]
    - 

FOOL

TINKER

*/


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
        expScale,
        useScale,
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

    newest: all abilities are tied to a Class; it may theoretically be possible to learn and improve an ability without having access to its class? hm
    ... so potential bufftypes for mods: type, flavor, intent, action
    abilitykey: {
        name: 'Name',
        tier: 123, // modifies the required exp/use scales, as well as the class exp gained from leveling it up
        active: true || false,
        type: magical/martial/breath/???,
        flavor: '', // vanilla!... no, actually, stuff like element
        intent: attack/recover/buff/debuff,
        target: self/other/any/area,
        aoe: single/group/side/all,
        action: spellcast/movement/???,
        windup: [null, 0, ...], // another 10-level array
        cooldown: [null, 0, ...],
        class: '', lowercased name of class this ability is associated with
        exp: {value: 0, level: 0, scale: []}, // upon exp up, check scale[level + 1] vs value, increment if necessary; up to Level 5? 10?
        use: {value: 0, level 0, scale: []}, // similar to above
        mods: {}, // mods to the ability applied through use level
        requirements: {soft: {target: 100, classLevelMods: {fool: 5}, abilityLevelMods: {abilityName: 10}}, hard: {classLevels: {fool: 5}, abilityLevels: {abilityName: 3}}}, // the requirements to learn the ability in the first place!
        // for requirements, abilityLevels/Mods include both exp AND use cumulatively, so even without exp-leveling you can hit a req to learn a new ability
        effects: {
            damage: {
                stat: atk,
                base: [null, 10], // in an array that's based on ability's expLevel, with 0 nulled out since we expect everything to be at least level 1
                mod: [null, 1.5],
                accuracy: [null, 0.85],
                vs: 'target' // having this here allows us to iterate through effects and apply concepts such as potential backfire, blowback, and other side effects
            },
            effectTypeX: {
                ...
            }
        }        
        use(agent, target)  {
            // can include roomContextData as a param, OR bake it into an expanded locationData for the agent & target
            // grab them refs and MUTATE
            // ALSO, include any prefix synergies in here, too! ... any special effects above and beyond the base effect of prefixes
            let firstPersonMsg = [`You do the thing to ${target.name}`];
            let thirdPersonMsg = [`${agent.name} does the thing to ${target.name}`];
            // this.use.value += 1; // possibly, we can apply mods based on user's stats, the exp.level of this, or agent aptitudes?
            // we haven't defined aptitudes yet, though, so... just a 'maybe' concept for later
            return;
        },
        checkForLevelUp(type) {
            // can check for type === 'exp' || 'use' ... and if neither is present, check both?
        },
        prefixes: {}, // no specific prefixLoad limit, but costs are amped exponentially
        prefixing() {
            // here: checks for applied prefixes and renames the ability accordingly, if applicable
        }
    }

*/

const abilityBlueprints = {
    /*
    
    FIRECAST THOUGHTS
    - the windup/charge for this one... what number(s) make sense here depend GREATLY on how we define the length of a normal turn
    - the 'castTime' has to be a smart investment somehow; it has to be more useful than just spamming 'attack' over and over in the same time frame in almost all cases
    - so take a little time to figure that out now-ish
    TIMING!
    turns occur at 500 'charge,' 50 + speed is base, woo
    
    abilities can 'charge' faster than default turns depending on type; 'abilityCharge' setups should ideally take into consideration boosts to, say, casting speed
    
    */
    'Flamebolt': {
        simplename: "Flamebolt", tier: 1, active: true, type: 'magical', action: 'spellcast', intent: 'attack', flavor: 'fire', target: 'other', aoe: 'single',
        windup: [null, 500, 500, 500, 500, 500, 500, 500, 500, 500, 500], // relative time
        cooldown: [null, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // absolute time
        class: 'mage',
        effects: {
            damage: {bonus: 20, magnitude: 2, flavor: 'fire', stat: 'mag', vs: 'res', target: 'target'}
        }, // rejigger as shorthand descriptor/skill card preview info builder since actual use parameters are gonna live in use() now

        use(agent, target) {
            // all actual effects and prefix-checking goes here
            /*

            HMMMM: what to do if the target is prefixed into multi-target?
            - well, we COULD just call the initial use() many times, but the output of that could get pretty wild
            - maybe more ideally we can do a typeof on target and split depending on that
            - or we could always assume target is an array
            - oh, looks like typeof does OBJECT for both {} and [], so can use Array.isArray(VAR) to get a true/false on that
            
            Our first ability! We want USE() to:
            - calculate all damage done and the total result of all hp/mp/etc. exchanges/changes
            - apply those changes to the agent
            - io.to @ chatventure channel of agent (assuming that any interested parties will see it via that) with 1st/2nd/3rd person messaging
            - send the 'eventResultObject' to the chatventure to parse
            
            */
            // what we want to do here is figure out all the calcs for damage done, throw the result of this action into the chatventure
        },
        levelUp(agent) {},
        expScale: [null, 0], useScale: [null, 0]
    },
    'Zephyr': {
        simplename: "Zephyr", tier: 1, active: true, type: 'magical', action: 'spellcast', intent: 'recover', flavor: 'wind', target: 'any', aoe: 'group',
        windup: [null, 1000], // hm, maybe it'd be more reasonable to have a 'scaling' object and just pass the level into that?
        cooldown: [null, 0],
        class: 'sympath',
        effects: {},

        use(agent, target) {},
        levelUp(agent) {},
        expScale: [null, 0], useScale: [null, 0], powerScale: [null, {}]
    }
};

class Ability {
    constructor(blueprint) {
        this.id = generateRandomID('abl');
        this.mods = {};
        this.exp = 0;
        this.expLevel = 1;
        this.use = 0;
        this.useLevel = 1;
        this.simplename = blueprint.simplename;
        this.currentName = this.simplename;
        this.tier = blueprint.tier;
        this.active = blueprint.active;
        if (this.active) {
            // passive abilities don't need any of this :P
            this.type = blueprint.type;
            this.action = blueprint.action;
            this.intent = blueprint.intent;
            this.flavor = blueprint.flavor;
            this.target = blueprint.target;
            this.aoe = blueprint.aoe;
        }

    }
}


// loosely, progression rules for townships; may rename when implementing
const townshipRules = {};


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
            if (thisPlayer?.chatventure != null) thisPlayer.chatventure = allChatventures[thisPlayer.chatventure.id];
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
                if (thisPlayer?.chatventure != null) thisPlayer.chatventure = allChatventures[thisPlayer.chatventure.id];
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

    socket.on('interact_with_struct', interactionObj => {
        if (thisPlayer?.name == null) return;
        const { structToInteract, interaction } = interactionObj; 
        console.log(`It appears ${thisPlayer.name} wants to interact with ${structToInteract.nickname} by doing a/n ${interaction}?`);

        // console.log(`STRUCT INTERACTION REQUEST. structToInteract is `, structToInteract);
        
        // ok! this is working great so far. 
        structBlueprints[structToInteract.type][interaction](thisPlayer, thisPlayer.township.townMap.structs[structToInteract.type]);

        // what should this socket return? anything in particular? let's brainstorm...
        /*
        
        We can handle socket-sending in this fxn, making some bold assumptions, OR we can have the interaction functions handle it.
        - my instinct is to handle it in the fxn? let's give it a go

        MIND: we need to also JOIN the socket, and then send 'You arrive' 1st person and 'agent.name arrives' 3rd person

        so, onward to VISIT()

        
        */
        return;
    });

    socket.on('select_chatventure_option', optionObj => {
        if (thisPlayer?.name == null) return;
        // receiving: optionObj = {echo: '', onSelect: 'stringedFxn', whoCan: 'any'}
        // console.log(`Received this chatventure option object: `, optionObj);

        /*
        const chatventureFunction = {
            leaveChatventure(agent) {
                // get 'em outta there! ... with their party, probably
            },
            createPatrolChatventure(agent) {
                // this one will need context, which could theoretically be provided assuming the CHATVENTURE OBJ has data on where it's taking place
            },
            openExploreMenu(agent) {
                // this one will also need context
            }    
        }        
        */

        // hm, we should check whoCan, but that will require some shenanigans, referencing through thisPlayer's chatventure and such to cross-check everything
        // for now, let's just fire the fxn, see what happens, and ensure we can leave
        
        console.log(`Receiving optionObj: `, optionObj);
        console.log(`Interacting with player named ${thisPlayer.name}`)

        // as before, any SOCKET SENDING should probably occur in the called functions, so be mindful of that going forward
        chatventureFunction[optionObj.chatventureOption.onSelect](thisPlayer);


        return;
    });

    socket.on('select_chatventure_menu_item', menuItemObj => {
        if (thisPlayer?.name == null) return console.log(`Nully player attempts menu selection shenanigans, gets shut down.`);

        /*
        
                }
                
            case 10:
                {
                    patrolPrompt += `You encounter an aggressive, sharp-eyed Husk. You just barely avoid its notice as it stalks along its path.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;
                }
            default: break;
                
        }
        patrolMenu.push({
            echo: `Just leave.`,
            onSelect: `dismissMenu`
        });        


                    patrolPrompt += `You encounter an aggressive, sharp-eyed Husk. You just barely avoid its notice as it stalks along its path.`;
                    patrolMenu.push({echo: `Fight it!`, onSelect: `beginBattle`});
                    patrolPotentialEncounter = new Mob(mobBlueprints.husk);
                    break;

        
        */

        const { onSelect } = menuItemObj;
        switch (onSelect) {
            case 'beginBattle': {
                // !MHRbattle
                // playstack gotta mode into BATTLE, friendo; mode: 'battle', battle: {}
                // playStack.battle should have all of the bits necessary to do Ze Battle
                // playStack.target can be used for good effect, as well! woo!
                
                // THIS: set up chatventure.events[id] @ battleID; with everything we need to know about the battle... which is, admittedly, a lot
                /*
                
                we need to know which 'side' everyone is on, what the teams/groupings are, refs to all the entities... what else?
                oh, and the mobs need to wake their butts up and start doing stuff, which gets sent to the battlescreen...
                ... meaning we need a HISTORY! good job, sir

                ... have to recall where mobs 'live'? hmmmmmmmmmm
                ... well, the MENU event could warp into a new form, keeping its current ID but becoming a battle instead, which makes sense
                ... that way, the event.mobData (currently a single mob object) is where it could continue to 'live', and we ref it instead in participants

                ... so instead of destroying it, as dismissMenu below, we mutate it into our new object! ... gotta think about what that means downstream
                BATTLE DATA CREATE ... sides, groups? how to organize?
                the simplest is 1v1, which would be two sides, each with one group
                ... which sounds, honestly, like a big ol' pain to parse, because we'd have to go several layers deep each time
                ... it seems 'easier' to just have a reference to group/faction attached to each entity in the event
                ... woof, ok, let's just give it a go

                ideally: resolution rules, but for now we'll just have all actions 'ping' the battle to see if a faction's members are all KO'd
                also ideally: inherit and/or create local area effects/conditions to check against for skills/abilities/etc.
                consider: having a self-checking timeout function attached to this event on the backend
                {
                    history: [],
                    participants: {
                        nameOrIdKey: entityRef
                    },
                    factions: {
                        'zenithican': {},
                        'enemy': {}
                    },
                    parties: {},
                    
                }

                anyone involved in the event.playersViewing should be mode: 'battle', menu: null, battle: {}
                AND they should be pushed into the participants, factions, and POSSIBLY parties

                for now, it's 1v1, so make sure that works before adding additional considerations and logistical load
                
                we can keep the event's prompt, type, id, and mobData
                redefine prompt content, redefine type to battle
                delete menuItems
                add battleData

                SUMMARY:
                need to set up the player's end (INCLUDING ACTIONS THEY CAN TAKE... default Strike, Pew, Flee actions, may have to create then equip on brandNewPlayer)
                    - this is more of a global concept
                establish functionality for processing attacks (well, abilities do that)... rather, processing damage/effect objects within each entity
                    - related: maybe having separate mob classes, such as class Husk, ignoring blueprints and therefore assuming more robust type AI


                */

                // back to it... remember to io.to everyone, and actOut() on all mobs to start the battle up
                let battleData = {};

                return;
            }
            case 'dismissMenu': {
                //!MHRmenu
                /*
                
                let menuData = {type: 'menu', prompt: patrolPrompt, menuItems: patrolMenu, id: patrolID, mobData: patrolPotentialEncounter};
                menuData.playersViewing = {};
                menuData.playersViewing[agent.name] = true;
                

                allChatventures[agent.chatventure.id].events[patrolID] = menuData;                
                
                */

                console.log(`REMOVING MENU. Player's allSouls playStack is `, allSouls[thisPlayer.name].playStack)

                delete allChatventures[thisPlayer.chatventure.id].events[thisPlayer.playStack.menu.id].playersViewing[thisPlayer.name];
                if (Object.keys(allChatventures[thisPlayer.chatventure.id].events[thisPlayer.playStack.menu.id].playersViewing).length === 0) {
                    delete allChatventures[thisPlayer.chatventure.id].events[thisPlayer.playStack.menu.id];
                }
                
                
                thisPlayer.playStack = {...thisPlayer.playStack, mode: 'chill', menu: null};
                console.log(`After just fiddling with thisPlayer, allSouls playStack is `, allSouls[thisPlayer.name].playStack)
                


                socket.emit('player_update', thisPlayer);

                return;
            }
            default:
                break;
        }
        return;
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
        brandNewPlayer.exp = 0;
        brandNewPlayer.entityType = 'player';

        // maaay go with the below instead, because chatventures have a LOT going on :P
        brandNewPlayer.chatventure = {
            id: null
        };

        // party members! it's about to be a thing! party up!
        brandNewPlayer.party = {};

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
        };

        // the player's copy of all abilities (known)
        // thinking that not ALL abilities need to have a class anymore; some can just kind of 'be' :P
        // expScale[0] can be purchase cost, if other conditions are met? anyway!
        // stuff like ATTACK or PEW can go here
        brandNewPlayer.abilities = {};

        // just a quick filtered subset of all abilities the player has 'current' access to thanks to their class
        brandNewPlayer.classAbilities = {};

        // HERE: create their 'base' township, join the socket for it
        // currently, we're using completely static values, but random flavor should come in shortly
        // currently, bare bones, no structs, npcs, etc. ... consult above for setting those up in a bit
        /*
        
        Structs to add:
        - a specific struct for their starting class so they can train it and pursue class-specific stuff
            - hm, what if class struct exerted 'influence' based on its level? ... then stuff like general store can 'sense' that influence and stock accordingly
            - then this same influence could hit npc gen rates, as well
        - a basic trading post
        - town perimeter (eventually wall/bulwark/gate)
        



        */
        let brandNewTownship = {
            nickname: `${brandNewPlayer.name}'s Township`,
            soulRef: `${brandNewPlayer.name}`,
            icon: {},
            aesthetic: {}, // for changing look of the chatroom around, ultimately
            npcs: {},
            vibe: {}, // vibe changes based on available structures as well as npc's and their 'presence'/influence
            townMap: {
                description: `Simple as can be, this little township.`,
                structs: {
                    nexus: {
                        nickname: `${brandNewPlayer.name}'s Town Nexus`,
                        description: 'A jagged crownlike blossom of translucent blue crystal, standing twice the height of a tall man, that acts as the heart of the township.',
                        innerDescription: 'How did you even get IN here? Crystals! Crystals everywhere!',
                        level: 0,
                        exp: 0,
                        type: 'nexus',
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
                // theoretically, the townMap would go somewhere in this worldMap, as well
                areas: {},
                map: []
            },
            population: 0,
            events: {},
            resources: {}, // forgot what my intent was here :P
            history: [],
            lastTick: new Date()
        };
        brandNewPlayer.township = {...brandNewTownship};
        // HERE: can whip through and attach structs with the new Struct(blueprint) model
        // add perimeter, tavern, and classBuilding at this stage
        brandNewPlayer.township.townMap.structs.perimeter = new Struct(structBlueprints.perimeter);
        // tavern goes here
        // classBuilding goes here



        // HERE: then whip through all those structs and apply the structBlueprints[structType].init(building, area) to give them their starting 'stuff' where applicable
        Object.keys(brandNewPlayer.township.townMap.structs).forEach(structID => {
            // NOTE: we can get away with this less specific calling of structID rather than digging up type because upon init all these ids === type
            structBlueprints[structID].init(brandNewPlayer.township.townMap.structs[structID], brandNewPlayer.township);
        });

        // HERE: 'read the room' and throw some NPC's down :P

        /*
        
        So, in general, we're looking at actions having POTENCY, PRECISION, COST, SPEED
        ... mostly this is to give more purpose to equipment, such as equipping a Fire Staff of Flaming Flamey-O Hotman
        ... ok, everything is AMP value, make it easier on ourselves
        'three checks' concept? every ability gets just THREE things (or four, or five, but let's decide now) to check  
        
        
        */

        // ehhhhhhh
        brandNewPlayer.mods = {
            spellCraft: {
                meta: {power: 0, precisionL: 0, cost: 0, speed: 0},

            }
        };

        // for new ability learning!
        // doing a 'blank' init now, and then can go through 'starter class skills' and add their values in
        brandNewPlayer.skills = {
            spellcraft: 0,
        };

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
        brandNewPlayer.inventory = [new Item(itemBlueprints.fancyclothes), new Item(itemBlueprints.leathercap)];
        brandNewPlayer.equipment = {
            rightHand: null,
            leftHand: null,
            head: null,
            body: null,
            accessory: null,
            trinket: null
        };

        equip(brandNewPlayer, new Item(itemBlueprints.rags));

        // oh right, MUNNY... we'll go with just a number and 'carte blanche' currency for now
        // we'll start with 500 just for testing/spending purposes
        brandNewPlayer.wallet = 500;
        
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
            nickname: 'Zenithica',
            target: null,
            chatventure: null,
            mode: '',
            doing: 'none',
            at: 'none',
            overlay: 'none',
            data: {} // currently this is kind of a vestigial element, but we'll keep it there for now
        };

        // -ideally-, we init all sorts of expected values/actions here so we don't have to later :P
        /*
        
            BRAINSTORM:
            battlesFought, battlesLost, battlesWon, spellsCast, abilitiesUsed,

            I'm not sure we need/want to check all these 'on the fly' for achievements...
            ... maybe have it tied to one-off player-driven events, like resting, etc. (Morrowind Model of Leveling Up :P)
        
        */
        brandNewPlayer.history = {
            achievements: {},
            mpSpent: 0,
            battlesWon: 0,
            battlesLost: 0,
            battlesFled: 0,
            townshipsVisited: 0,
            walletGained: 0,
            walletSpent: 0,
            walletMax: 0, // awkward way of saying highest amount of wallet at any given time :P
            spellsCast: 0,
            abilitiesUsed: 0,
            damageDealt: 0,
            damageReceived: 0,
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
        if (thisPlayer?.name == null) return;
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
    });

    socket.on('chatventure_action', chatventureActionObj => {
        if (thisPlayer?.name == null) return console.log(`Nully man trying to do nully things, such misbehavior!`);

        // note that we currently expect the player to be IN the chatventure
        // there is no planned 'psychic projection' model, but if there were, we'd have to add a change to accomodate for 'which chatventure??'



        // decided to open this bad boy up to ANY chatventure action, soooooo let's start with just chat
        switch (chatventureActionObj.type) {
            case 'chat': {
                const chatventureEvent = {
                    echo: chatventureActionObj.echo,
                    type: chatventureActionObj.type,
                    timestamp: new Date(),
                    agent: thisPlayer.name,
                    target: null,
                    icon: thisPlayer.icon,
                    voice: thisPlayer.voice
                };
                allChatventures[thisPlayer.chatventure.id].history.push(chatventureEvent);
                Object.keys(allChatventures[thisPlayer.chatventure.id].players).forEach(playerName => {
                    io.to(playerName).emit('chatventure_event', chatventureEvent)
                });
                return;
            }
            default: {
                break;
            }
        }
    });

    socket.on('chat_action', chatMessageData => {
        if (thisPlayer?.name == null) return;
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
        if (thisPlayer?.name == null) return;
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
    .catch(err => console.log(`Goodness, failed to load GameState altogether. That can't be good. Welp! Server is offline for now. ERROR is `, err));

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