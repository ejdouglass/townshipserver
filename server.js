const express = require('express');
const app = express();
const server = require('http').createServer(app);
const socketIo = require('socket.io');
const mongoose = require('mongoose');
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



// let damageScale = {};


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

// hello, past and future selves! we've overhauled the equipment system since last we spoke and commented above.
/*

    quick synopsis:
    - remember there's plenty of equipment slots, so don't be worried about having under-represented stats if the player's going ham on it
        - mainHand, offHand, head, body, trinket, accessory... even the 'basic four' first ones all represent plenty of stat-itude

    should also probably 'restrict' the sort of stats commonly given to different slots... def/res/hp/mp on armor, atk/mag/dft/cha on weapons?
    ... I don't mind mp on weapons either. :P
    ... so, we'll try to keep it relatively balanced between gear, and possibly apply unique mods to stuff like head gear (modifies/syncs with other gear rather than providing 100% same stats?)

    so 'negatives' are pure... -0.3 is a 30 percent loss, -0.8 is an 80 percent loss, not related to the mainStat

    LATEST: don't like evently splitting the 1.3
        so let's go back to ranks: S/A/B/C/D
    ... which are then modded by rank, or nah? ... or maybe perks/slots/etc.

    does somewhat limit our 'upward mobility' of options if we're starting at A rank stats, dunnit? :P

    A = 1.6 / -0.25
    B = 1.1 / -0.2
    C = 0.6 / -0.15
    D = 0.4 / -0.1

    back to B+C theory
        - the listed negatives are the 'value' of that negative, so for example if you have a D stat of 0.4, you can change it to C if you add a raw -0.1 somewhere
        - currently this only applies to 'blank' stats, rather than subtracting 0.1 from ane existing stat for a 'free' bump



*/

// all gear => all ITEMS, for easy ware-wolving :P

const allItems = {
    'cat claw': {
        meta: 'equipment', type: 'weapon', build: 'claw', name: `cat's claw`, slot: 'hand', icon: null, madeOf: ['leather', 'bone'], tier: 1,
        mainStat: 'agility', equipStats: {atk: 0.6, dft: 1.1},
        description: `A tight-fitting pawlike glove, adorned with fur and lousy with jagged rows of sharped bone.`,
        specials: {}, damageType: 'slashing', variance: 0.1, useAbility: null
    },
    'short sword': {
        meta: 'equipment', type: 'weapon', build: 'sword', name: `short sword`, slot: 'hand', icon: null, madeOf: ['iron'], tier: 1,
        mainStat: 'strength', equipStats: {atk: 0.6, def: 0.6, dft: 0.6},
        description: `A stout, short, and balanced blade that's apt for rapidly striking and parrying.`,
        specials: {}, damageType: 'slashing', variance: 0.2, useAbility: null
    },
    'dagger': {
        meta: 'equipment', type: 'weapon', build: 'dagger', name: `dagger`, slot: 'hand', icon: null, madeOf: ['iron'], tier: 1,
        mainStat: 'agility', equipStats: {atk: 1.1, dft: 0.6},
        description: `A viciously sharp, short blade suited for abrupt attacks.`,
        specials: {}, damageType: 'stabbing', variance: 0.1, useAbility: null
    },
    'hatchet': {
        meta: 'equipment', type: 'weapon', build: 'axe', name: `hatchet`, slot: 'hand', icon: null, madeOf: ['iron'], tier: 1,
        mainStat: 'strength', equipStats: {atk: 1.6, dft: -0.2},
        description: `For its relatively short length, this short single-headed axe is pretty much ideal for taking apart either trees or monsters.`,
        specials: {}, damageType: 'slashing', variance: 0.3, useAbility: null
    },
    'club': {
        meta: 'equipment', type: 'weapon', build: 'hammer', name: `club`, slot: 'hand', icon: null, madeOf: ['wood'], tier: 1,
        mainStat: 'vitality', equipStats: {atk: 1.6, def: -0.2},
        description: `A stout, gnarled club of sturdy wood.`,
        specials: {}, damageType: 'smashing', variance: 0.3, useAbility: null
    },
    'leather armor': {
        meta: 'equipment', type: 'armor', build: 'light armor', name: `leather armor`, slot: 'body', icon: null, madeOf: ['leather'], tier: 1,
        mainStat: 'agility', equipStats: {def: 0.6, res: 0.6, dft: 0.6},
        description: `Carefully overlapped layers of pliable leather make up this relatively minimalist armor.`,
        specials: {}, useAbility: null
    },
    'leather cap': {
        meta: 'equipment', type: 'armor', build: 'cap', name: `leather cap`, slot: 'head', icon: null, madeOf: ['leather'], tier: 1,
        mainStat: 'agility', equipStats: {def: 0.6, res: 0.6, dft: 0.6},
        description: `An everyday leather cap for simple protection.`,
        specials: {}, useAbility: null
    },
    'wand': {
        meta: 'equipment', type: 'weapon', build: 'rod', name: `wand`, slot: 'hand', icon: null, madeOf: ['wood'], tier: 1,
        mainStat: 'intelligence', equipStats: {mag: 1.1, dft: 0.6},
        description: `Looking like not much more than a particularly twisted short length of branch, this forearm-long length of wood is crafted to amplify raw magical potential.`,
        specials: {}, useAbility: null
    },
    'staff': {
        meta: 'equipment', type: 'weapon', build: 'staff', name: `staff`, slot: 'hand', icon: null, madeOf: ['wood'], tier: 1,
        mainStat: 'willpower', equipStats: {mag: 1.6, mp: -0.2},
        description: `A long, slightly twisted length of wood almost as long as the average person is tall, meant to turn whimsical intention into magical reality.`,
        specials: {}, damageType: 'smashing', variance: 0.2, useAbility: null
    },
    'cane': {
        meta: 'equipment', type: 'weapon', build: 'staff', name: `cane`, slot: 'hand', icon: null, madeOf: ['wood'], tier: 1,
        mainStat: 'wisdom', equipStats: {mag: 0.6, res: 1.1},
        description: `Gets the job done!`,
        specials: {}, damageType: 'smashing', variance: 0.2, useAbility: null
    },
    'buckler': {
        meta: 'equipment', type: 'shield', build: 'small shield', name: `buckler`, slot: 'hand', icon: null, madeOf: ['leather', 'wood'], tier: 1,
        mainStat: 'agility', equipStats: {def: 0.6, res: 0.6, dft: 0.6},
        description: `A simple disc of toughened leather stretched over a tight wood frame, this light shield is ideal for quickly and precisely redirecting minor assaults.`,
        specials: {}, useAbility: null
    },
    'oval shield': {
        meta: 'equipment', type: 'shield', build: 'large shield', name: `oval shield`, slot: 'hand', icon: null, madeOf: ['iron'], tier: 1,
        mainStat: 'vitality', equipStats: {def: 1.1, res: 1.1, dft: -0.15},
        description: `A somewhat hefty shield of hammered iron, its dimensions are just wide enough to comfortably cover the entire torso, providing a handy space to cover oneself in battle.`,
        specials: {}, useAbility: null
    },
}

const itemBlueprints = {
    'short sword': {
        meta: 'equipment', type: 'weapon', build: 'sword', name: 'short sword', slot: 'hand', icon: null, materialReqs: {metal: 2}, minLevel: 1,
        description: `A simple short sword. It's a sword, but kinda short.`,
        equipStats: {
          atk: {
            flat: 5,
            amp: {strength: 0.2}
          }
        },
        damageType: 'slashing',
        variance: 0.1,
        useAbility: null
    },
    rod: {
        meta: 'equipment', type: 'weapon', build: 'rod', name: 'rod', slot: 'hand', icon: null, materialReqs: {wood: 2}, minLevel: 1,
        description: `A simple spellcaster's rod.`,
        equipStats: {
          mag: {
            flat: 5,
            amp: {willpower: 0.2}
          }
        },
        damageType: 'smashing',
        variance: 0.1,
        useAbility: null
    },
    club: {
        meta: 'equipment', type: 'weapon', build: 'hammer', name: 'club', slot: 'hand', icon: null, materialReqs: {wood: 2}, minLevel: 1,
        description: `A simple club for whackin' and thwackin'. Often carried by muglins.`,
        equipStats: {
          atk: {
            flat: 5,
            amp: {strength: 0.2}
          }
        },
        damageType: 'smashing',
        variance: 0.2,
        useAbility: null        
    },    
    'leather armor': {
        meta: 'equipment', type: 'armor', build: 'light armor', name: 'armor', slot: 'body', icon: null, materialReqs: {leather: 4}, minLevel: 1,
        description: `Basic armor made of leather. Simple but effective.`,
        equipStats: {
          def: {
            flat: 3,
            amp: {agility: 0.2}
          },
          spr: {
              flat: 2,
              amp: {wisdom: 0.1}
          }
        },
        useAbility: null
    },
    'leather cap': {
        meta: 'equipment', type: 'armor', build: 'cap', name: 'cap', slot: 'head', icon: null, materialReqs: {leather: 2}, minLevel: 1,
        description: `A simple cap made of leather. Simple but effective.`,
        equipStats: {
          def: {
            flat: 2,
            amp: {agility: 0.1}
          },
          spr: {
              flat: 1,
              amp: {wisdom: 0.1}
          }
        },
        useAbility: null
    },
    buckler: {
        meta: 'equipment', type: 'shield', build: 'buckler', name: 'buckler', slot: 'hand', icon: null, materialReqs: {leather: 2}, minLevel: 1,
        description: `A simple cap made of leather. Simple but effective.`,
        equipStats: {
          def: {
            flat: 2,
            amp: {agility: 0.1}
          },
          spr: {
              flat: 1,
              amp: {wisdom: 0.1}
          }
        },
        useAbility: null
    },



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
        meta: 'equipment', type: 'armor', build: 'helm', name: 'helm', description: `A straightforward, head-encompassing helm. On the heavier side, but offers good physical protection`,
        slot: 'head', icon: {type: 'x'}, equipStats: {def: {flat: 15, amp: {strength: 0.5, vitality: 0.5}}, res: {flat: 5, amp: {wisdom: 0.75, intelligence: 0.25}}},
        materialReq: {}
    },

    sword: {
        meta: 'equipment', type: 'weapon', build: 'sword', name: 'sword', description: `a simple sword`,
        slot: 'hand', icon: {type: 'x'}, equipStats: {atk: {flat: 10, amp: {strength: 0.5, agility: 0.5}}, mag: {flat: 2, amp: {willpower: 0.25, intelligence: 0.25}}},
        materialReq: {hard: 40}, dmgMod: 1
    },
    oldrod: {
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
    // add: dagger, club, 
};


/*

    Note: This will have to move waaaay up in this file to work properly

    Can brainstorm struct-y concepts here.
    Also, thinking that 'upgrades' simply are [...]ables, so townstats would be old townstats {...theseTownStats}, for example
    ... hm, we might get some overwrite issues, so let's be a little careful about how we implement (ADDING the most relevant from baseStats + upgrade, rather than overwriting?)
    ... or just add 'em to the new Struct() init; give an 'adder' fxn that properly pools in all specializations
    ... SO! all specs are ADDITIONS, while all upgrades are REPLACEMENTS, I'm sure we'll never get that mixed up at all, which is great
    - this means that all calculations for a new Struct will have to {...baseStats, ...upgradeSpecs[newestLevel]}
        - it also means that all upgradeSpecs MUST 
        - alternatively, we can do some creative looping and just keep spreading the new upgradeSpecs to 'catch' all the changes?
        - actually, that's fine, too, all told

    township income calculations are based off HOURS elapsed, so we'll say grease is measured in hours :P

*/
const allTownshipStructs = {
    'crossroad': {
        baseStats: {
            type: 'crossroad', displayName: 'Wayfarer Inn', id: null, soulRef: null, nickname: `The Crossroads`, level: 1, hp: 2000, interactions: ['nexus'], icon: null, weight: 0,
            townstats: {traffic: 1, commerce: 1, waterIncome: 2},
            description: `The de facto heart of the township that houses the Nexus that connects it to Zenithica and all its outposts. A practical structure that is mainly an inn and tavern, providing common service to travelers that come through via Nexus or more mundane means. The central town well adjoins the building.`, 
            refineOptions: [
                {name: 'Brew Beer', resource: 'water', from: {veg: 2, water: 2}, into: {beer: 2}, time: 60},
                {name: 'Prepare Vegetables', resource: 'veg', from: {veg: 4, water: 2}, into: {food: 2}, time: 60}
            ],
            buildLimit: 1, npcSlots: null, construction: {opalite: 25, wood: 20, stone: 20}
        },
        upgradeSpecs: [
            null, null,
            {level: 2, hp: 2500, displayName: 'Wayfarer Inn', construction: {wood: 0, stone: 0, leather: 0, ore: 0, wealth: 0, grease: 0}},
            {level: 3, hp: 3000, displayName: 'Travelers Lodge', construction: {timber: 30, chalkstone: 30, iron: 30, copper: 20, wealth: 150, food: 15, grease: 30}},
            {level: 4, hp: 3500, displayName: 'Travelers Lodge', construction: {timber: 75, chalkstone: 75, iron: 10, copper: 10, wealth: 350, grease: 60}},
            {level: 5, hp: 4250, displayName: 'Crossroads Hall', construction: {hardwood: 40, marble: 40, pelt: 25, steel: 35, silver: 25, wealth: 1000, grease: 120}},
            {level: 6, hp: 5000, displayName: 'Crossroads Hall', construction: {opalite: 9999, grease: 9999}},
        ],
        specializations: {
            'Town Well Lv.2': {name: `Town Well Lv.2`, townstats: {waterIncome: 1}, cost: {grease: 3, wealth: 50, timber: 10, chalkstone: 10, iron: 10, copper: 5}, reqs: {}, description: `Renovates the central well of the township Crossroads, providing +1 water per hour.`},
            // 'Building Upgrades Lv.2': {name: `Building Upgrades Lv.2`, townstats: {upgradeCap: 2}, cost: {grease: 6, wealth: 150}, reqs: {}, description: `Through careful township planning and resource management, it becomes possible to upgrade all township buildings to their fourth tier of development.`},
            // 'Township Management Lv.2': {name: `Township Management Lv.2`, townstats: {buildCapacity: 2}, cost: {grease: 6, wealth: 150}, reqs: {}, description: `Extends the influence of the Nexus, allowing space for a couple additional buildings in the township.`},
            // 'Edict of Expansion': {name: `Edict of Expansion`, townstats: {upgradeCap: 1, buildCapacity: 1}, cost: {grease: 24, wealth: 1000}, reqs: {specs: []}, description: ``}
        }
    },
    'tradehall': {
        baseStats: {
            type: 'tradehall', displayName: 'Tradecraft Tent', id: null, soulRef: null, nickname: `The Tradehall`, level: 1, hp: 500, interactions: ['shop'], icon: null, weight: 0,
            townstats: {actionSlots: 2, commerce: 2, storage: 500},
            description: `An expansive tent, held up by massive tree trunks, under which rests all manner of equipment for gathering, refining, and crafting. A massive collection of crates surrounds the perimeter, housing the bulk of the township's inventory.`, 
            refineOptions: [
                {name: 'Butcher Game', resource: 'game', from: {game: 4, water: 2}, into: {food: 2, leather: 2}, time: 60},
                {name: 'Cut Timber', resource: 'wood', from: {wood: 4}, into: {timber: 2}, time: 60},
                {name: 'Smelt Ore', resource: 'ore', from: {ore: 4}, into: {iron: 2, copper: 1}, time: 60},
                {name: 'Cut Chalkstone', resource: 'stone', from: {stone: 4}, into: {chalkstone: 2}, time: 60}
            ],
            buildLimit: 1, npcSlots: null, construction: {timber: 80, chalkstone: 80, iron: 40, copper: 40, leather: 30},
            wares: ['short sword', 'dagger', 'hatchet', 'club', 'leather armor', 'leather cap', 'staff', 'buckler']
        },
        upgradeSpecs: [
            null, null, 
            {level: 2, hp: 800, displayName: 'Tradecraft Tent', construction: {dreams: 100, grease: 10}},
        ],
        specializations: {
            'Expand Storage': {name: `Expand Storage`, townstats: {storage: 500}, cost: {wealth: 250, grease: 2, stone: 20, wood: 20}, reqs: {}, description: ``},
            'Curious Armaments': {}
        }
    },
    'mineshaft': {
        baseStats: {
            type: 'mineshaft', displayName: 'Mineshaft Gatehouse', id: null, soulRef: null, nickname: `The Mineshaft`, level: 1, hp: 1000, interactions: null, icon: null, weight: 0,
            townstats: {oreIncome: 1, stoneIncome: 1},
            description: `A simple wooden gatehouse stands over and encloses what is essentially a pit, dug in careful serpentine tunnels under the township to procure the riches of the earth below. This gatehouse also serves as a storeroom, housing abundant mining and prospecting tools in various states of repair.`, 
            buildLimit: 1, npcSlots: null, construction: {wood: 40, stone: 20, iron: 10}
        },
        upgradeSpecs: [
            null, null,
            {level: 2, hp: 1300, displayName: 'Mineshaft Gatehouse', construction: {dreams: 100, grease: 10}}
        ],
        specializations: {
            'Perpendicular Prospecting': {description: ``, name: 'Perpendicular Prospecting', townstats: {oreIncome: 0.5}, cost: {grease: 4, wealth: 50}, reqs: {}},
            'Qualmless Quarrying': {description: ``, name: 'Qualmless Quarrying', townstats: {stoneIncome: 0.5}, cost: {grease: 4, wealth: 50}, reqs: {}},
            'Hill Harvesting Hacks': {description: ``, name: 'Hill Harvesting Hacks', tileIncomes: {}, cost: {grease: 4}, reqs: {}}
        }
    },
    'town wall': {
        baseStats: {
            type: 'town wall', displayName: 'Lowstone Wall', id: null, soulRef: null, nickname: `The Town Wall`, level: 1, hp: 2500, interactions: ['gate'], icon: null, weight: 0,
            description: `The wall that surrounds and protects the town. Could do with a moat, perhaps.`, 
            buildLimit: 1, npcSlots: null, construction: {timber: 150, chalkstone: 150}
        },
        upgradeSpecs: [
            null, null, 
            {level: 2, displayName: 'Lowstone Wall', hp: 3000, construction: {dreams: 100, grease: 10}}
        ],
        specializations: {
            'Nada': {name: 'Nada'}
        }
    },
    'smithy': {
        baseStats: {
            type: 'smithy', displayName: 'Smithy Hut', id: null, soulRef: null, nickname: `Smithy`, level: 1, hp: 1250, interactions: null, icon: null, weight: 1,
            townstats: {ironAmp: 0.2, copperAmp: 0.2},
            description: `A minimalist hut containing all the rudimentary tools and spaces for metalworking, filled with an ever-present oppressive heat mixed with the scent of steel and sweat. Enhances the township's ability to process ore into useful metals, unlocks higher ore refining options, and can develop the ability to sell better metal weapons and armor.`, 
            buildLimit: null, npcSlots: null, construction: {wood: 10, stone: 20, ore: 5, grease: 0.25},
            wares: []
        },
        upgradeSpecs: [
            null, null, 
            {displayName: `Smithy Hut`, townstats: {ironAmp: 0.25, copperAmp: 0.25}, level: 2, hp: 1500, construction: {wood: 35, stone: 35, ore: 15, grease: 2}, description: ``},
            {displayName: `Forge`, townstats: {ironAmp: 0.3, copperAmp: 0.3, steelAmp: 0.15, silverAmp: 0.15}, level: 3, hp: 2000, construction: {timber: 25, chalkstone: 25, iron: 20, grease: 12}, description: ``},
            {displayName: `Forge`, townstats: {ironAmp: 0.35, copperAmp: 0.35, steelAmp: 0.2, silverAmp: 0.2}, level: 4, hp: 2500, construction: {timber: 40, chalkstone: 40, steel: 10, copper: 20, grease: 16}, description: ``},
            {displayName: `Smithing Hall`, townstats: {ironAmp: 0.4, copperAmp: 0.4, steelAmp: 0.25, silverAmp: 0.25}, level: 5, hp: 3200, construction: {hardwood: 35, marble: 35, steel: 30, grease: 20}, description: ``},
        ],
        specializations: {
            'Iron Weaponsmithing': {name: 'Iron Weaponsmithing', wares: [], cost: {}, reqs: {}, description: ``},
            'Fundamental Armorsmithing': {name: 'Fundamental Armorsmithing', wares: [], cost: {}, reqs: {}, description: ``},
            'Improve Iron Smelting': {name: 'Improve Iron Smelting', townstats: {ironAmp: 0.25}, cost: {}, reqs: {}, description: ``},
            'Improve Copper Smelting': {name: 'Improve Copper Smelting', townstats: {copperAmp: 0.25}, cost: {}, reqs: {}, description: ``},
        }
    },
    'hunter': {
        baseStats: {
            type: 'hunter', displayName: 'Hunting Den', id: null, soulRef: null, nickname: `Huntin' Den`, level: 1, hp: 750, interactions: null, icon: null, weight: 1,
            townstats: {gameAmp: 0.2, vegAmp: 0.2},
            tileIncomes: {
                'v': {gameIncome: 0.5, vegIncome: 0.5},
                'p': {gameIncome: 0.5, vegIncome: 0.5},
                'u': {gameIncome: 0.5, vegIncome: 0.5},
                'j': {gameIncome: 0.5, vegIncome: 0.5},
                'w': {gameIncome: 0.5, vegIncome: 0.5},
                't': {gameIncome: 0.5, vegIncome: 0.5},
            },
            description: `A small and rustic building housing various tools of hunting, gathering, tracking, and leatherworking. Increases all township game and vegetation income due to increased knowledge of animal and plant processing, and provides a good boost to the township's ability to gather from flatlands and forests.`, 
            buildLimit: null, npcSlots: null, construction: {wood: 15, stone: 15, grease: 0.25},
            wares: []
        },
        upgradeSpecs: [
            null, null, 
            {displayName: `Hunting Den`, townstats: {gameAmp: 0.25, vegAmp: 0.25}, level: 2, hp: 1000, construction: {wood: 35, stone: 15, leather: 15, grease: 2}, description: ``},
            {displayName: `Trackers' Cabin`, townstats: {gameAmp: 0.3, vegAmp: 0.3}, level: 3, hp: 1400, construction: {timber: 35, chalkstone: 15, iron: 20, grease: 12}, description: ``},
            {displayName: `Trackers' Cabin`, townstats: {gameAmp: 0.35, vegAmp: 0.35}, level: 4, hp: 1800, construction: {timber: 40, chalkstone: 40, steel: 10, copper: 20, grease: 16}, description: ``},
            {displayName: `Hunters' Hall`, townstats: {gameAmp: 0.4, vegAmp: 0.4}, level: 5, hp: 2350, construction: {hardwood: 35, marble: 35, steel: 30, grease: 20}, description: ``},
        ],
        specializations: {
            'Hunting Gear': {name: 'Hunting Gear', wares: [], cost: {}, reqs: {}, description: ``},
        }
    },
    'angler': {
        baseStats: {
            type: 'angler', displayName: `Anglers' Shack`, id: null, soulRef: null, nickname: `Fishin' Shack`, level: 1, hp: 750, interactions: null, icon: null, weight: 1,
            townstats: {waterAmp: 0.2},
            tileIncomes: {
                'o': {gameIncome: 1.5, vegIncome: 0.5},
                'c': {gameIncome: 0.5, waterIncome: 0.5, vegIncome: 0.5},
                'l': {gameIncome: 0.5, waterIncome: 0.5, vegIncome: 0.5},
                'f': {gameIncome: 0.5, waterIncome: 1.5},
            },
            description: `A somewhat ramshackle building bearing various tools for fishing and simple watercraft. Substantially improves the township's ability to gather fish and other game from oceans and lakes, as well as make use of local vegetation native to these bodies of water. A basic desalination and filtration setup helps the township make better use of all water supplies.`, 
            buildLimit: null, npcSlots: null, construction: {wood: 20, stone: 10, grease: 0.25},
            wares: []
        },
        upgradeSpecs: [
            null, null, 
            {displayName: `Anglers' Shack`, townstats: {waterAmp: 0.25}, level: 2, hp: 1000, construction: {wood: 35, stone: 15, leather: 15, grease: 2}, description: ``},
            {displayName: `Anglers' Abode`, townstats: {waterAmp: 0.3}, level: 3, hp: 1400, construction: {timber: 35, chalkstone: 15, iron: 20, grease: 12}, description: ``},
            {displayName: `Anglers' Abode`, townstats: {waterAmp: 0.35}, level: 4, hp: 1800, construction: {timber: 40, chalkstone: 40, steel: 10, copper: 20, grease: 16}, description: ``},
            {displayName: `Waterfarer Hall`, townstats: {waterAmp: 0.4}, level: 5, hp: 2350, construction: {hardwood: 35, marble: 35, steel: 30, grease: 20}, description: ``},
        ],
        specializations: {
            'Feesh!': {name: 'Feesh!', wares: [], cost: {}, reqs: {}, description: ``},
        } 
    },
    'sawmill': {
        baseStats: {
            type: 'sawmill', displayName: `Small Sawmill`, id: null, soulRef: null, nickname: `Buzzin Saw`, level: 1, hp: 750, interactions: null, icon: null, weight: 1,
            townstats: {woodAmp: 0.2, timberAmp: 0.2},
            tileIncomes: {
                'j': {woodIncome: 1},
                'w': {woodIncome: 1},
                't': {woodIncome: 1},
            },
            description: `Essentially a long, open-air structure for housing lumber and processing wood. The tools and expertise here enhance the ability to find and gather quality wood from forests, enhance yields from converting raw wood into timber, and can ultimately develop the means to procure the higher grades of wood work.`, 
            buildLimit: null, npcSlots: null, construction: {wood: 15, stone: 10, ore: 10, grease: 0.25},
            wares: []
        },
        upgradeSpecs: [
            null, null, 
            {displayName: `Small Sawmill`, townstats: {woodAmp: 0.25, timberAmp: 0.25}, level: 2, hp: 1000, construction: {wood: 35, stone: 15, leather: 15, grease: 2}, description: ``},
            {displayName: `Sawmill`, townstats: {woodAmp: 0.3, timberAmp: 0.3}, level: 3, hp: 1400, construction: {timber: 35, chalkstone: 15, iron: 20, grease: 12}, description: ``},
            {displayName: `Sawmill`, townstats: {woodAmp: 0.35, timberAmp: 0.35}, level: 4, hp: 1800, construction: {timber: 40, chalkstone: 40, steel: 10, copper: 20, grease: 16}, description: ``},
            {displayName: `Swarthy Sawmill`, townstats: {woodAmp: 0.4, timberAmp: 0.4}, level: 5, hp: 2350, construction: {hardwood: 35, marble: 35, steel: 30, grease: 20}, description: ``},
        ],
        specializations: {
            'Oaky': {name: 'Oaky', wares: [], cost: {}, reqs: {}, description: ``},
        }
    },
    'farm': {
        baseStats: {
            type: 'farm', displayName: `Community Garden`, id: null, soulRef: null, nickname: `Veggies`, level: 1, hp: 750, interactions: null, icon: null, weight: 1,
            townstats: {vegIncome: 1, waterIncome: 1, gameIncome: 1},
            description: `A somewhat spacious plot of land, carefully cultivated to be as self-contained as possible, featuring tilled soil, a small pen for livestock, and a rudimentary well for providing a fresh water source. Provides a steady internal source of game, vegetation, and water.`, 
            buildLimit: null, npcSlots: null, construction: {wood: 15, stone: 15, grease: 0.25},
            wares: []
        },
        upgradeSpecs: [
            null, null, 
            {displayName: `Community Garden`, townstats: {vegIncome: 1.1, waterIncome: 1.1, gameIncome: 1.1}, level: 2, hp: 1000, construction: {wood: 35, stone: 15, leather: 15, grease: 2}, description: ``},
            {displayName: `Small Farm`, townstats: {vegIncome: 1.2, waterIncome: 1.2, gameIncome: 1.2}, level: 3, hp: 1400, construction: {timber: 35, chalkstone: 15, iron: 20, grease: 12}, description: ``},
            {displayName: `Small Farm`, townstats: {vegIncome: 1.3, waterIncome: 1.3, gameIncome: 1.3}, level: 4, hp: 1800, construction: {timber: 40, chalkstone: 40, steel: 10, copper: 20, grease: 16}, description: ``},
            {displayName: `Farmstead`, townstats: {vegIncome: 1.4, waterIncome: 1.4, gameIncome: 1.4}, level: 5, hp: 2350, construction: {hardwood: 35, marble: 35, steel: 30, grease: 20}, description: ``},
        ],
        specializations: {
            'Aminals!': {name: 'Aminals!', wares: [], cost: {}, reqs: {}, description: ``},
        }
    }
}

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

/*

spitball material properties:
METALS: hardness, flexibility, conductivity, workability, resistance, ductility, density
ALCHEMY: potency, efficacy, solubility, toxicity

... likely going to rejigger all this yet again :P... but for one last hurrah! no longer LEVEL equipment, but RANK (instrinsic quality)

*/

const allMaterials = {

        copper: {
            level: 5, type: 'metal', name: 'copper'
        },
        iron: {
            level: 15, type: 'metal', name: 'iron'
        },
        steel: {
            level: 20, type: 'metal', name: 'steel'
        },


        pine: {
            level: 5, type: 'wood', name: 'pine'
        },
        oak: {
            level: 15, type: 'wood', name: 'oak'
        },

        linen: {
            level: 5, type: 'fabric', name: 'linen'
        },

        ratskin: {
            level: 5, type: 'leather', name: 'ratskin'
        },
        boarhide: {
            level: 15, type: 'leather', name: 'boarhide'
        },

}

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
        this.materialReqs = blueprint.materialReqs || {opalite: 999};
        this.id = generateRandomID('item');
    }

    addMaterials(materialObject) {
        // expecting an object of type {iron: 2}, for example
        Object.keys(materialObject).forEach(material => {
            this.materials[material] = materialObject[material];
        });
        console.log(`This ${this.name} has had materials added to its impending construction: `, this.materials);
        return this;
    }

    craft(targetLevel) {
        // use buildReady() then go
        // to modify the NAME of the item, gonna need to skim materials present and pick the highest presence
        if (this.buildReady() === false) return console.log(`Not enough materials present to build this yet!`);
        let totalMaterialLevel = 0;
        let numberOfMaterials = 0;
        let highestMaterialAmount = 0;
        let dominantMaterial = ``;
        Object.keys(this.materials).forEach(constructionMat => {
            totalMaterialLevel = this.materials[constructionMat] * allMaterials[constructionMat].level;
            numberOfMaterials += this.materials[constructionMat];
            const numberOfThisMaterial = this.materials[constructionMat];
            if (numberOfThisMaterial > highestMaterialAmount) {
                highestMaterialAmount = numberOfThisMaterial;
                dominantMaterial = constructionMat;
            }
        });
        let levelSoftCap = Math.floor(totalMaterialLevel / numberOfMaterials);
        if (targetLevel > levelSoftCap) {
            // got some FIXING to do
            console.log(`Hm, someone is trying to make a weapon a higher level than the materials natively support. Good luck!`);
        }

        this.name = `${dominantMaterial} ${this.name}`;
        this.name = this.name.split(' ').map(nameString => capitalizeFirstLetter(nameString)).join(' ');

        // taking the Math.floor() off for now; we can worry about flooring when we hit final stats, weapon stats can be wacky wet 'n wild for now
        // we can round to proper decimal states later if we wish/need to for some reason
        // at any rate, with this boostRate, we're effectively doubling the base stats of the gear every 10 levels, which we'll test out
        const boostRate = targetLevel / 10 + 1;
        Object.keys(this.equipStats).forEach(baseStatKey => {
            
            // example is baseStatKey def which will lead to {flat: #, amp: {stat1: #, stat2: #}}
            this.equipStats[baseStatKey].flat *= boostRate;
            this.equipStats[baseStatKey].flat = Math.floor(this.equipStats[baseStatKey].flat);
            Object.keys(this.equipStats[baseStatKey].amp).forEach(ampStat => {
                this.equipStats[baseStatKey].amp[ampStat] *= boostRate;
                console.log(`New amp for ${ampStat} is `, this.equipStats[baseStatKey].amp);
            })
        });

        console.log(`Clang clang clang! We have crafted a new item. Here it is: `, this);

        return this;
    }

    buildReady() {
        let buildReady = false;
        Object.keys(this.materialReqs).forEach(requiredMatType => {
            buildReady = false;
            let targetNumber = this.materialReqs[requiredMatType]; // i.e. metal: 2, targetNumber = 2
            Object.keys(this.materials).forEach(material => {
                if (allMaterials[material].type === requiredMatType) {
                    targetNumber -= this.materials[material];
                }
                if (targetNumber <= 0) buildReady = true;
            });
        });
        return buildReady;
    }


    craftFrom(sourceMaterial) {
        // haxxy for now; just a quick-and-dirty way to test weapon/armor creation
        let targetLevel = sourceMaterial.level;
        this.name = `${sourceMaterial.name} ${this.name}`;
        this.name.split(' ').forEach(nameString => capitalizeFirstLetter(nameString)).join(' ');
        let boostRate = Math.floor(targetLevel / 5) + 1;
        // oh, we can't just add 5 to everything; really does a number on split-stat items, juicing them wildly, soooo
        // we'll for now do a simple 'doubles base efficacy of the item every 10 levels' and refine it further later

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



const abilityBlueprints = {
    
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
        action: spellcast/movement/???,
        intent: attack/recover/buff/debuff,
        flavor: '', // vanilla!... no, actually, stuff like element
        target: self/otherAlly/otherEnemy/otherAny/any/area,
        aoe: single/group/side/all,
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



    

    Back to attack design, redux

    some basic parameters can be added to each ability cumulatively, and then they can magnify further

    TYPING: 

    ask first, what can we modify? CHAIN MODS, YO
    potency: {all: 0, martial: 0, magical: 0}
    speed: {all: 0, martial: 0, magical: 0}
    potency, speed

    so we can tally up the types, actions, intents, AND flavor to provide auto-amps to both potency AND cost (the exhaustion of doing the same thing over again)
    ... cumulatively in a way that the 'previous one' changes the momentum the most, with COST scaling faster than POTENCY
    ... thus, to conserve on resources, having 

    that way, some moves can be specifically designed to AMP! woo!

    we can have auto-amp elements and discrete amp elements
    
    

    */
   //MHRattack
    
   
    huskSwat: {
        name: 'husk swat', tier: 1, active: true, type: 'martial', action: 'movement', intent: 'attack', flavor: 'basic', target: 'otherFaction', aoe: 'single',
        windup: 0, cooldown: 1500, mpCost: 0, eqlCost: 20, class: 'none', effects: {atkDamage: {base: 1, potency: 1, stagger: 1, flavor: 'basic'}},
        message: `wildly swipes a meaty paw at`, // can turn this into an array and then use pickOne for FLAVOR
        // how to handle messaging in this case?? hmmmmm... we couuuuuld init the skill on an agent to init the messaging for it, then delete the messagingInit fxn?
        // well, for now, let's just go generic and fill in the finer details later
        // we can also think through all possible EFFECTS to hook into useAbility, but for now, effects.damage {base, potency, flavor} will be accounted for
        // can also have easy-to-replace wildcard values such as $AGENTNAME and $TARGETNAME
        // Object.keys(ability.effects).forEach?
    },
    huskHeal: {

    },
    strike: {
        simplename: 'attack', tier: 1, active: true, type: 'martial', action: 'movement', intent: 'attack', flavor: 'basic', target: 'otherEnemy', aoe: 'single', 
        windup: 0,
        cooldown: 500,
        class: 'none',
        effects: {damage: {base: 5, potency: 1}},

        use(agent, target) {
            // FIRSTS FIRST: check to ensure the target is still 'available'... in the battle, visible to the attacker, etc.
            // SECONDS SECOND: ensure the attacker can do this move and isn't under any status that would preclude it
            // HM THIRD: currently testing if we can just attach use() to these declarations and run logic through them that way
            //      if so, we can just reference the agent as the calling agent object, OR re-bind the this()
            //  'worst' case we can just pass in the agent and use their agent.playStack.target information, which we'll try first

            // we'll have access to the agent's actionQueue and actionIndex to help modify from, ezpz lemon squee-z

            // huh, can I just 'copy' the function stuff to a given agent and have them USE stuff? fascinating, let's try it

            // at some point, we need to consider the dmgMod on the user's weapon(s)

            let baseDamage = 5;
            let baseReduction = 0;
            let potency = 1;
            let eqlCost = 100;
            let damageObject = {
                hpDamage: 0,
                mpDamage: 0,
                // moar damage in the future? ... maybe!
                // can also potentially add debuffs... ouch can be any injury
                // oh, maybe anti-ouch function?... basically the opposite of an attack effect? ...hrmmrmrm
            };



            /*
            
            take balance and focus into consideration, where applicable, and also bonus/decrement each
                - idea: weaponMods that allow you to build focus on martial type movements, balance on casts, etc.
            
            so we need to know the 'effective level' of the agent's att vs target's def

            mod by balance... oh snap, gotta add balance
            BALANCE SPITBALLING... let's figure that one out, eh? 

            for now, though
            
            
            BELOW:
            - handle the io.to information
            - call ouch(damageObject, source) on e'erbody
            - figure out damage messaging
            
            */

            // good enough for now
            let actionEcho = `${agent.name} strikes ferociously at ${target.name}, dealing ${damageObject.hpDamage} damage!`;

            // to figure out where to shoot the ECHO to, io and history wise, we need the chatventure AND event ids
            // so, we need to attach battle: {id: 9999} to the playStack of everyone involved when battle starts so we're good to go there
          
            // doopty
            // woopty
        }
    },
    evoke: {},
    flee: {},
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

class MuglinMob {
    constructor(initName) {
        this.id = generateRandomID('muglinmob');
        if (initName != null) this.name = `${initName} the Muglin`
        else this.name = `an everyday muglin`;
        this.level = 1;
        this.entityType = 'mob';
        this.species = 'muglin';
        this.family = 'humanoid';
        this.type = null;
        this.class = null;
        this.inventory = [];
        this.playStack = {
            gps: null,
            nickname: null,
            target: null, 
            chatventure: null,
            mode: 'chill',
            at: 'none', // hmm
            data: {},
            battle: null
        };
        this.pips = 1;
        this.dead = false;
        this.chatventureID = null;
        this.stance = 100;
        this.abilities = {};
        this.abilityBar = [];
        this.nextAction = [];
        this.currentAction = null;
        this.faction = 'enemy'; 
        this.soulHome = null;
        this.wallet = 0;
        this.stealInventory = []; // will likely refactor... stealPoolSeed? something like that
        this.stealFlags = 0;
        this.heat = {total: 0, average: 0}; // targeting weighting will go here, at some point
        this.loot = {
            skins: null,
            treasure: null,
            wallet: 0
        }; // gotta figure out how to handle loot mechanics
        this.equipment = {rightHand: null, leftHand: null, head: null, body: null, accessory: null, trinket: null};
        this.statSeed = {strength: 8, agility: 12, vitality: 6, willpower: 6, intelligence: 5, wisdom: 6};
        this.stats = {...this.statSeed};
        this.ai = {}; // ai for behavioral possibilities
        this.plan = {}; // backup for timeout actions for re-init/server restore
        this.flags = {pickpocketed: false}; // for any specific but esoteric actions/settings        
    }

    actOut() {
        // if (this.playStack.target == null) {
        //     this.playStack.target = this;
        //     // oh hey! this can be changed into 'default target' or removed entirely, since turn-based actions do NOT require a persistent target
        // }


        // need to decide on the play of 'stance'... changing stats and ai if you hit them with what they're most vulnerable to
        // stance will be ignored for now

        // also need to determine battle flow... hm
        /*
        
            NEO BATTLE FLOW:
            setup - everyone selects an action as battle begins, 5 seconds by default unless everyone 'checks in' with confirm?
            ROUND 1 begins -
                1) roll for effective deftness for the round, slotting everyone into order of actions
                2) go through the turns in a stepping timeout cascade, echoing them down into the active battle window and pushing them into the history/battleLog
                    2a) having a battle's specific messageSpeed adjusted can let the next timeout timer setting know on the fly
                3) resolve each turn: action, effect, extra effect (i.e. "Bob attacks! The muglin takes 37 damage! The muglin is poisoned! The muglin is vanquished!")
                4) once we've gone through everyone's turn, end-of-round: decrement all effects, apply side effects, extra combat resolution check, give time to select new actions
                ... and repeat until resolved!
            

            Sooooo playStack mode can still be our 'what kind of chatventure event are we attending to'
                ... the event's PHASE, and the event itself, can be the handler for 'hey, you - choose something to do'
        
        */

        switch (this.playStack.mode) {
            case 'chill': {
                break;
            }
            case 'battle': {
                /*
                
                    This is the default mode a muglin mob will be in right now, sooooo
                    - for now, 
                    - ooh ability should probably change to use(target) and let parties be entityType: 'party' among other data so abilities know what to do next
                    - use(self) no longer!
                
                */
                break;
            }
            default: break;
        }
    }

    init(level) {
        // initialize all stats here based on level, give 'em some equipment
        // create a fxn that creates appropriate-material stuff with options to filter, cap, etc.
        if (level == null) level = 1;
        Object.keys(this.statSeed).forEach(statKey => {
            this.stats[statKey] = Math.floor(this.statSeed[statKey] + (level * this.statSeed[statKey] / 10));
        });
        this.stats.hpmax = Math.floor(30 + this.stats.vitality + (this.level * this.stats.vitality / 10));
        this.stats.mpmax = Math.floor(30 + this.stats.wisdom + (this.level * this.stats.wisdom / 10));

        this.stats.atk = Math.floor((this.stats.strength + this.stats.agility) / 2);
        this.stats.def = Math.floor((this.stats.agility + this.stats.vitality) / 2);  
        this.stats.mag = Math.floor((this.stats.willpower + this.stats.intelligence) / 2);  
        this.stats.spr = Math.floor((this.stats.wisdom + this.stats.intelligence) / 2);
        this.stats.dft = Math.floor((this.stats.agility + this.stats.intelligence) / 2);
        this.stats.hp = this.stats.hpmax;
        this.stats.mp = this.stats.mpmax;

        // extra: maybe loot or lootSeed initialization, as well as any stealable data... exp, as well?

        // definitely need to init at least strike in here... how do we do that, again? :P
        // have to refactor strike for the newest model at any rate
        
        // const Sting = new Item(itemBlueprints['short sword']).addMaterials({iron: 2}).craft(15);
        this.equipment.rightHand = new Item(itemBlueprints['club']).addMaterials({oak: 2}).craft(this.level);
        this.equipment.head = new Item(itemBlueprints['leather cap']).addMaterials({boarhide: 2}).craft(this.level);
        this.equipment.body = new Item(itemBlueprints['leather armor']).addMaterials({boarhide: 4}).craft(this.level);
        calcStats(this);
        return this;
    }

    setType(type) {
        // type is essentially a sub-species and will overwrite the basic statSeed before applying level and re-naming
        // we'll worry about 'class' a bit later
        this.type = type;
        switch (this.type) {
            // muglins at this stage do not really scale threateningly, so may have to introduce 'tiers' later to pump those stats more
            case 'forest': {
                this.type = 'forest';
                this.name = `a forest muglin`;
                this.statSeed = {strength: 8, agility: 12, vitality: 6, willpower: 6, intelligence: 5, wisdom: 6}
                break;
            }
            case 'grassland': {
                this.type = 'grassland';
                this.name = `a wildland muglin`;
                this.statSeed = {strength: 8, agility: 12, vitality: 6, willpower: 6, intelligence: 5, wisdom: 6}
                break;
            }
            default: {
                this.type = null;
                this.name = `a common muglin`;
                this.statSeed = {strength: 8, agility: 12, vitality: 6, willpower: 6, intelligence: 5, wisdom: 6};
                break;
            }
        }
        return this;
    }

    place(playStack) {
        // the init'ing player's playStack can be duplicated in order to figure out where this guy goes; can also allMobs it?
        return this;
    }

    mutate(mutation) {
        if (mutation == null) mutation = 'none';
        // randomly tweak stats around a bit
        return this;
    }

    ouch(actionObject) {
        // attackObject should contain all the 'raw data' of the attack, from typing to flavor to raw numbers
        // the mob can then cheerfully apply this raw information to their own state, stats, stance, whatever have you
        // the base components for the io message can drift along here as well
        // actually, can be a two-parter... emit the "HERO ATTACKS!" message first, then "MOB TAKES 4 DAMAGE!" stuff after

        // may make this a universal fxn so we can attach it to whomstever rather than copy-pasting it
        // alternatively, may make a mother class from which all attackable entities are derived, inheriting this bad boy

        /*
        
        let actionObject = {
            source: {name: user?.name, id: user?.id || null},
            attack: {
                amount: Math.floor(user.stats.atk * action.effects.attack.potency),
                hits: [{
                    // floor out the damage result at the end after going through any ouches
                    rawPower: user.stats.atk / 2, potency: 1, stagger: 1, type: 'physical', damageType: 'crushing', flavor: 'basic', vs: 'def', coverable: true
                }],
            }
        };       
        
        */


        if (this.flags.covered != null) {
            console.log(`But the attack is intercepted by a valiant defender!`);
        }

        let rawDamage = 0;
        actionObject.hits.forEach(hitObj => {
            // doesn't yet account for any resistances, mitigations, stance details, etc.
            rawDamage += Math.floor((hitObj.rawPower - this.stats[hitObj.vs] / 4) * hitObj.potency);
            this.stance -= Math.floor(rando(1,5) * hitObj.stagger);
        });
        console.log(`${this.name} takes ${rawDamage} damage!`);
        this.stats.hp -= rawDamage;
        if (this.stats.hp <= 0) this.ded();
        return this;
    }

    ded(cause) {
        // should clear the actionQueue, io.to every player involved, and then hang out until either status changes OR existence is cleared by other means

        if (this.currentAction != null) {
            clearTimeout(this.currentAction);
            this.currentAction = null;
        }
        this.dead = true;
        console.log(`Shuddering and moaning!`);
    }    
}

// let Dobby = new MuglinMob().setType('grassland').init(10);
// console.log(`DOBBY IS `, Dobby);

class TileArea {
    constructor() {
        this.biome = null;
        this.biomeType = null;
        this.description = ``;
        this.seedLevel = 1;
        this.mobLevel = 1;
        this.threatLevel = 1; // how aggressive the inner mobs are?
        this.extroversion = 0; // thinking of a variable as for 'how often this tile attempts to do something to surrounding or nearby tiles'
        this.resources = {
            metal: {quantity: 0, quality: 0},
            stone: {quantity: 0, quality: 0},
            gems: {quantity: 0, quality: 0},
            wood: {quantity: 0, quality: 0},
            water: {quantity: 0, quality: 0},
            herbs: {quantity: 0, quality: 0},
            game: {quantity: 0, quality: 0}, 
        },
        this.access = 0; // how easy it is to get into the goodies of the area?
        this.explored = 0;
        this.rivers = {n: 0, e: 0, s: 0, w: 0};
        this.roads = {n: 0, e: 0, s: 0, w: 0};
        this.shiny = {};
        this.structs = {};
        this.pointsOfInterest = {};
        this.mobTypes = [];
    }

    level(level) {
        this.seedLevel = level;
        this.mobLevel = level;
        return this;
    }

    setBiome(biome) {
        /*

            FOREST
                - wood (temperate forest)
                - jungle (tropical rainforest, essentially)
                - taiga (boreal/northern/cold forest)
            WETLAND
                - swamp (forest wetlands, slow moving waters with woody plants such as cypress and mangrove ... we'll call this tropical for TC)
                - marsh (same water as swamp but softer, non-woody; temperate wetlands, we'll say)
                - bog (mostly dead stuff, generally higher up; we'll call this the arctic version)
            FLATLAND
                - savanna (tree-studded/'tropical' grasslands)
                - plain (or prairie; short to tall grasses, flowers, and herbs, but no trees due to not quite enough rainfall, just a tad too dry)
                - tundra (flat, cold, permafrost under the soil makes trees a no-go, grass and moss grow during short summer, birdless in winter, li'l burrowing game present)
            DESERT
                - arctic (tons of water... locked in ice, so plants and animals ain't getting any)
                - dunescape (sandy, waterless, low vegetation, tropical)
                - desert (rockier, dotted with grasses and shrubs, 'temperate')
            MARINE
                - sea (near land)
                - ocean (open water)
            FRESHWATER
                - cruisewater
                - lake
                - frostwater
                - river (not really its own tile so much as an overlay/modifier)
            BUMPY (not actually a biome type IRL :P)
                - greenhill
                - hill
                - frostmound
                - mountain (REAL high hills :P... impassable by default, they're so very, very high and rocky, after all :P)

        
                TIERS instead of level for materials? ... basically less granular, and easier to account for
                ... range of stuff can be found, which is modified by quality (some stuff will almost or actually never be found at low 'quality' ratings)

            NEW:
            - biome is basically a tileRef as well as a typing ref for events/seeding/etc.
            - extoversion can be kept, but not sure if I'll end up using it, or anytime soon if so
            - probably do away with 'discovered' within resources, and add discovered to the tile instead for 'roll to find neat things'
            - higher discovered could also boost production from that tile
            - township tile gets a big ol' discovered boost
            - 'shiny' refers to special, map-viewable special effects on the tile, like METALBOOST in a mountain
            - shiny effects are specific to their biome and represent the possibility of a 'rare' sub-biome type, in a way
            
            let's consider removing the 'rando' part of tile generation, and segue that sort of inflection over toward shiny effects
        
        */
        this.biome = biome;

        // hm, quality level... I like the idea of it, but how is it applied, especially to 'township materials'?
        // awkwardly, at particularly higher levels, the difference between a low-level quantity and a high-level quantity source is eroded to almost nothing
        // feels a bit 'blocky,' so may want to go back and add more variation/better balance later
        const lowQuantity = 1 + Math.floor(this.seedLevel / 10);
        const lowQuality = Math.floor(this.seedLevel / 4) + 1;
        const midQuantity = 2 + Math.floor(this.seedLevel / 10);
        const midQuality = Math.floor(this.seedLevel / 2.5) + 1;
        const highQuantity = 3 + Math.floor(this.seedLevel / 10);
        const highQuality = Math.floor(this.seedLevel / 1);
        
        // values of '0' despite having a quality score indicates that there is 0 available by default; requires special treatment, such as mining to expose the goodies
        switch (biome) {
            case 'savanna': {
                this.biomeType = 'flatland';
                this.description = `A lush grassland extends as far as the eye can see, dotted with shading trees, mighty bushes, and abundant life.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: lowQuantity, quality: midQuality},
                    water: {quantity: lowQuantity, quality: midQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: midQuantity, quality: midQuality},
                };

                this.mobs = [];
                return this;
            }
            case 'plain': {
                this.biomeType = 'flatland';
                this.description = `An expansive, mostly flat field of grasses, short and tall, dotted with flowers and herbs without a tree in sight.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: 0, quality: midQuality},
                    water: {quantity: lowQuantity, quality: midQuality},
                    herbs: {quantity: midQuantity, quality: highQuality},
                    game: {quantity: highQuantity, quality: midQuality},
                };        
                return this;        
            }
            case 'tundra': {
                this.biomeType = 'flatland';
                this.description = ``;
                this.resources = {
                    metal: {quantity: 0, quality: midQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: 0, quality: midQuality},
                    water: {quantity: 0, quality: highQuality},
                    herbs: {quantity: lowQuantity, quality: highQuality},
                    game: {quantity: lowQuantity, quality: lowQuality},
                };
                return this;
            }

            case 'jungle': {
                this.biomeType = 'forest';
                this.description = `A near-constant cacophony of sounds surrounds you in this dense maze of vibrant trees and plantlife.`;
                this.resources = {
                    metal: {quantity: 0, quality: midQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: highQuantity, quality: highQuality},
                    water: {quantity: lowQuantity, quality: midQuality},
                    herbs: {quantity: highQuantity, quality: highQuality},
                    game: {quantity: midQuantity, quality: highQuality},
                };
                return this;
            }
            case 'wood': {
                this.biomeType = 'forest';
                this.description = `A verdant and relatively peaceful forest with wide, easily-traversed pathways between the many tall trees.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: highQuantity, quality: highQuality},
                    water: {quantity: lowQuantity, quality: midQuality},
                    herbs: {quantity: midQuantity, quality: midQuality},
                    game: {quantity: midQuantity, quality: midQuality},
                };
                return this;
            }
            case 'taiga': {
                this.biomeType = 'forest';
                this.description = `Tall boreal trees grow in every direction. It's a bit chilly.`;
                this.resources = {
                    metal: {quantity: 0, quality: highQuality},
                    stone: {quantity: 0, quality: midQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: highQuantity, quality: highQuality},
                    water: {quantity: lowQuantity, quality: midQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: lowQuantity, quality: highQuality},
                };
                return this;
            }

            case 'swamp': {
                this.biomeType = 'wetland';
                this.description = `It's rather wet. And woody.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: midQuantity, quality: lowQuality},
                    water: {quantity: midQuantity, quality: lowQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: lowQuantity, quality: highQuality},
                };
                return this;
            }
            case 'marsh': {
                this.biomeType = 'wetland';
                this.description = `It's so very damp here. But not particularly woody.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: lowQuantity, quality: lowQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: midQuantity, quality: lowQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: lowQuantity, quality: lowQuality},
                };
                return this;
            }
            case 'bog': {
                this.biomeType = 'wetland';
                this.description = `Just a lot of water and muck.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: midQuantity, quality: lowQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: lowQuantity, quality: highQuality},
                };
                return this;
            }

            case 'greenhill': {
                this.biomeType = 'bumpy';
                this.description = `Rolling greens hills, dotted with abundant vegetation, define this area.`;
                this.resources = {
                    metal: {quantity: midQuantity, quality: midQuality},
                    stone: {quantity: lowQuantity, quality: highQuality},
                    gems: {quantity: lowQuantity, quality: lowQuality},
                    wood: {quantity: lowQuantity, quality: midQuality},
                    water: {quantity: 0, quality: midQuality},
                    herbs: {quantity: lowQuantity, quality: midQuality},
                    game: {quantity: lowQuantity, quality: lowQuality},
                };
                return this;
            }
            case 'hill': {
                this.biomeType = 'bumpy';
                this.description = `A rocky collection of hills dotted with occasional hardy trees and tenacious plantlife.`;
                this.resources = {
                    metal: {quantity: midQuantity, quality: midQuality},
                    stone: {quantity: midQuantity, quality: midQuality},
                    gems: {quantity: lowQuantity, quality: midQuality},
                    wood: {quantity: lowQuantity, quality: midQuality},
                    water: {quantity: 0, quality: midQuality},
                    herbs: {quantity: 0, quality: midQuality},
                    game: {quantity: 0, quality: lowQuality},
                };
                return this;
            }
            case 'frostmound': {
                this.biomeType = 'bumpy';
                this.description = `A craggy, desolate series of freezing hills, all but devoid of apparent life.`;
                this.resources = {
                    metal: {quantity: midQuantity, quality: highQuality},
                    stone: {quantity: midQuantity, quality: midQuality},
                    gems: {quantity: lowQuantity, quality: highQuality},
                    wood: {quantity: 0, quality: midQuality},
                    water: {quantity: 0, quality: midQuality},
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: 0, quality: midQuality},
                };
                return this;
            }

            case 'mountain': {
                this.biomeType = 'mountain';
                this.description = `A massive mountain, effectively impassable, but teeming with potential treasures of the earth.`;
                this.resources = {
                    metal: {quantity: highQuantity, quality: highQuality},
                    stone: {quantity: highQuantity, quality: highQuality},
                    gems: {quantity: midQuantity, quality: highQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: 0, quality: midQuality},
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: 0, quality: lowQuality},
                };
                return this;
            }

            case 'dunescape': {
                this.biomeType = 'desert';
                this.description = `Gently rolling hills of sand as far as the eye can see, with no apparent hope for a solid meal or hearty drink.`;
                this.resources = {
                    metal: {quantity: 0, quality: highQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: highQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: 0, quality: lowQuality},
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: 0, quality: lowQuality},
                };
                return this;
            }
            case 'desert': {
                this.biomeType = 'desert';
                this.description = `A rocky desert with collections of brave and hardy grasses and shrubs to be found here and there.`;
                this.resources = {
                    metal: {quantity: 0, quality: midQuality},
                    stone: {quantity: lowQuality, quality: midQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: 0, quality: midQuality},
                    water: {quantity: 0, quality: midQuality},
                    herbs: {quantity: lowQuantity, quality: lowQuality},
                    game: {quantity: lowQuantity, quality: lowQuality},
                };
                return this;
            }
            case 'arctic': {
                this.biomeType = 'desert';
                this.description = `Snow and ice and little else meets the eye here.`;
                this.resources = {
                    metal: {quantity: 0, quality: highQuality},
                    stone: {quantity: 0, quality: midQuality},
                    gems: {quantity: 0, quality: highQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: 0, quality: highQuality},
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: 0, quality: midQuality},
                };
                return this;
            }

            case 'cruisewater': {
                this.biomeType = 'freshwater';
                this.description = `If a rocklike gentleman offered you a ride on his adventure boat here, you'd be wise to accept.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: midQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: highQuantity, quality: midQuality},
                    herbs: {quantity: 0, quality: midQuality},
                    game: {quantity: midQuantity, quality: midQuality}, // fishy leather :P
                };
                return this;
            }
            case 'lake': {
                this.biomeType = 'freshwater';
                this.description = `An apparently serene body of glasslike water. It appears refreshing.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: midQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: highQuantity, quality: midQuality},
                    herbs: {quantity: 0, quality: midQuality},
                    game: {quantity: midQuantity, quality: midQuality},
                };
                return this;
            }
            case 'frostwater': {
                this.biomeType = 'freshwater';
                this.description = `A freezing body of freshwater, a sheen of ice covering potentially all of its surface from your vantage and making it difficult to seek hydration.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: midQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: lowQuality, quality: highQuality},
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: 0, quality: midQuality},
                };
                return this;
            }
            
            case 'sea': {
                this.biomeType = 'marine';
                this.description = `The shallow ocean waters found near the shore. Conceivably, you could go for a nice swim here, and at times you can see sealife darting to and fro just beneath the surface.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality}, // eh maybe pearls and such, if we want to 'count' that
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: 0, quality: lowQuality}, // saltwater doesn't count for township water needs
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: midQuantity, quality: midQuality}, // decent source of fishing, though
                };
                return this;
            }
            case 'ocean': {
                this.biomeType = 'marine';
                this.description = `It's quite damp. Supremely moist, all the way down.`;
                this.resources = {
                    metal: {quantity: 0, quality: lowQuality},
                    stone: {quantity: 0, quality: lowQuality},
                    gems: {quantity: 0, quality: lowQuality},
                    wood: {quantity: 0, quality: lowQuality},
                    water: {quantity: 0, quality: lowQuality}, // saltwater again
                    herbs: {quantity: 0, quality: lowQuality},
                    game: {quantity: lowQuantity, quality: highQuality}, // if you can get out there, you can certainly catch some whoppers
                };
                return this;
            }

            case 'river': {
                // I think river is now going to be a sub-quality of the tile, like roads and such
                // so it won't really 'exist' in this section, going forward
                break;
            }

            default: {
                console.log(`If this message is being seen, it's because someone tried to set a biome type that doesn't exist??`);
                break;
            };
        }
        return this;

                /*
                
                    MOB THINKIN TIME - for when we be seedin' them mobs!
                    muglin - quick, vicious, but small and relatively frail; strong, impactful strikes can rattle them pretty easily
                        - like to be sneaky and indirect... or swarm, they're fine with swarming
                    troll - big, thick, with the tendency to regenerate rapidly unless this ability is halted with (usually) fire (and/or other magic)
                        - they tend to use big, two-handed weapons, and are all too happy to charge up a big, devastating hit
                        - they can get away with the lead time on that due to their massive vitality and regen
                    bat - quick, flying, and annoyingly hard to hit consistently with physical attacks unless downed/disrupted
                        - speaking of annoying, specialize in debuffs and status effects
                    
                    dayweight, nightweight? ... so some mobs can spawn more or less frequently day/night
                        ... if weight is 0, doesn't spawn during that condition
                    spawnChance: {
                        time: {day, night},
                        weather: {clear, rainy, cloudy, },
                        partysize: [null, 1],

                    }
                    class: 'muglin' // for which class such as MuglinMob to use
                    type: 'grassland' // as above, new MuglinMog.level().type('grassland')
                    weight: 100 // when attempting to spawn an enemy team, will attempt to spawn until weight 100 is reached
                        - so mob with weight 50 will always spawn 2 exactly; weight 60 has 40 left over, and has a 40/60 chance of spawning a second
                        - special circumstances can override this 'manually' OR chance the weight limit of the battle
                        - standard encounter = 100, at any rate
                        ... can also do weight-by-level, but that might require some more mathing to make sure that works out in a reasonably well-scaling way


                
                */
    }

    init() {
        // may already be handled by ().level(x).biome('boopty')
    }

    patrol(agent) {
        // spawn 
    }

    explore(agent) {
        // a general voyage of discovery, attempting to unearth SEEKRITS across all 7 current possibilities, or perhaps even discover a unique struct/POI
        // 
    }

    forage(agent) {
        // attempt to gain more information on wood, water, herbs, and game
    }

    prospect(agent) {
        // really look into the situation regarding metal, stone, and gems
    }

    build(struct) {
        // probably will require more than just the struct to make this work :P
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
        // something is equipped there! remove it! ... o snap we can't just do it this way, we need to UNEQUIP it
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
        this.playStack = {
            gps: 'Zenithica', // note that we'll have to change this gps data, but we don't quite initialize location data properly yet
            nickname: 'Zenithica',
            target: null, 
            chatventure: null,
            mode: '', // hm... this cooooould be a good hook for dictating ai behavior
            at: 'none',
            data: {},
            battle: null
        }
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


class HuskMob {
    constructor(initName) {
        // MHRhusk
        if (initName != null) this.name = `${initName} the Husk`
            else this.name = `a mindless Husk`;
        this.level = 1;
        this.entityType = 'mob';
        this.id = generateRandomID('huskmob');
        this.inventory = [];
        this.playStack = {
            gps: 'Zenithica', // note that we'll have to change this gps data, but we don't quite initialize location data properly yet
            nickname: 'Zenithica',
            target: null, 
            chatventure: null,
            mode: 'test2', // hm... this cooooould be a good hook for dictating ai behavior
            at: 'none',
            data: {},
            battle: null
        };
        this.eql = 100;
        this.dead = false;
        this.chatventureID = null;
        this.abilities = {};
        this.abilityBar = [];
        this.actionQueue = [];
        this.actionIndex = null;
        this.actionMomentum = {};
        this.currentAction = null;
        this.faction = 'enemy'; 
        this.soulHome = null;
        this.wallet = 0;
        this.stealInventory = []; // will likely refactor... stealPoolSeed? something like that
        this.stealFlags = 0;
        this.heat = {total: 0, average: 0}; // targeting weighting will go here, at some point
        this.loot = {
            skins: null,
            treasure: null,
            wallet: 0
        }; // gotta figure out how to handle loot mechanics
        this.equipment = {rightHand: null, leftHand: null, head: null, body: null, accessory: null, trinket: null};
        this.statSeed = {strength: 10, agility: 10, vitality: 10, willpower: 10, intelligence: 10, wisdom: 10};
        this.stats = {strength: 10, agility: 10, vitality: 10, willpower: 10, intelligence: 10, wisdom: 10, atk: 10, def: 10, mag: 10, res: 10, spd: 10, hpmax: 50, hp: 50, mpmax: 50, mp: 50}; // 'base' stats
        this.ai = {}; // ai for behavioral possibilities
        this.plan = {}; // backup for timeout actions for re-init/server restore
        this.flags = {pickpocketed: false}; // for any specific but esoteric actions/settings
    }



    place(playStack) {
        // receive a playstack, probably cheerfully copied from initializing player :P
        // this should provide sufficient information for the entity to start acting out properly, when that functionality is called
        this.playStack = JSON.parse(JSON.stringify(playStack));
        this.playStack.mode = 'battle';
        
    }



    init(level) {
        // based on level, equip, give abilities, and what have you
        // certainly they should have the ability to attack, at least :P
        this.level = level || 1;

        this.wallet = this.level * 4;

        // HERE: based on init level, decide which 'type' of Husk we can generate, if they have special skills or ai, equipment potential, maybe loot stuff, etc.
        // for now, though?... just a thing to whack around, so let's just keep it mindless and fairly ai-free until we're ready to test more capabilities

        // let's define huskmobs at low level having a basic attack, staggering attack, maybe a desperate strike attack, and a whoopsiedoodle fell over attack
        // - alternatively, we can try to hook in a 'special effect' on basic husk attacks that have a chance to cause them to fall over as a side effect
        // stumble weighting based on level, disappearing by level 10 or so; factor in ai weighting to a simple degree at this stage

        // this.abilities['strike'] = abilityBlueprints['strike'];
        // this.abilityBar.push(abilityBlueprints['strike']);

        // we can add 'extra weighting factor' to mob abilities
        // this.abilities['huskSwat'] = abilityBlueprints['huskSwat'];
        // this.abilities['strike'] = new StrikeAbility().learn();
        learnAbility(this, 'strike');
        this.abilityBar.push(this.abilities['strike']);


        // may refactor the bar out completely?
        // this.abilityBar.push(abilityBlueprints['huskSwat']);

        // determine chance of spawning with gear based on level and RNG
        // ideally, we should change the stat allocation to be 'weighted,' as well as subdivide per 'type'... the mindless ones shouldn't have high intelligence,
        //  nor should they have a super high chance to roll more :P
        const statBoostRefArray = ['strength', 'agility', 'vitality', 'willpower', 'intelligence', 'wisdom'];
        const statWeightArray = [30,20,30,10,5,5];
        const statWeightTotal = statWeightArray.reduce((prev, current) => prev + current, 0);

        // actually, let's take out the loop and just do a quick static stat dump, minus the 'initial assignment' :P
        for (let x = 10; x--; x > 0) {
            this.stats[statBoostRefArray[rando(0,5)]] += 1;
        }

        statBoostRefArray.forEach((statKey, index) => {
            this.stats[statKey] += Math.floor(statWeightArray[index] / statWeightTotal * level);
        });

        this.stats.hpmax = Math.floor(30 + (this.stats.vitality * 2));
        this.stats.hp = this.stats.hpmax;
        this.stats.mpmax = Math.floor(30 + (this.stats.wisdom * 2));
        this.stats.mp = this.stats.mpmax;
        this.stats.atk = Math.floor(1 + (this.stats.strength * 0.5 + this.stats.agility * 0.5));
        this.stats.def = Math.floor(1 + (this.stats.vitality * 0.5 + this.stats.agility * 0.5));
        this.stats.mag = Math.floor(1 + (this.stats.willpower * 0.5 + this.stats.intelligence * 0.5));
        this.stats.res = Math.floor(1 + (this.stats.wisdom * 0.5 + this.stats.intelligence * 0.5));
        equipOne(this, new Item(itemBlueprints.rags), 'body');
        equipOne(this, new Item(itemBlueprints.sword), 'rightHand');

        // somewhere around here... possible auto-mutate potential? sometimes, you just get a freaky mob :P


        console.log(`I gained stats! Look at me now, ma: `, this);
        return this;
    }



    mutate(type) {
        // THIS: be able to make something a Boss, Elite, Huge, whatever else, amending its properties accordingly from stats to description and loot values
        console.log(`${this.name} is attempting to mutate!`);
        return this;
    }



    actOut() {
        // should probably 'initialize' heat values? ... well, the Husk may be too 'simple' to worry about that, for now
        if (this.playStack.target == null) {
            this.playStack.target = this;
            console.log(`${this.name} appears enraged and confused! Watch out!`);
        }
        
        switch (this.playStack.mode) {
            case 'test2': {
// MHRhuskattacktest2

                if (this.dead) return console.log(`${this.name} attempted to act out, but cannot, due to being dead. Probably by its own hand at this stage.`);

                
                if (this.actionQueue.length === 0) {
                    let numberOfActions = rando(3, 5);
                    console.log(`The husk prepares ${numberOfActions} attacks...`);
                    for (let i = 1; i <= numberOfActions; i++) {
                        this.actionQueue[i - 1] = this.abilityBar[0];
                    }
                    this.actionIndex = 0;
                    prepareAbility(this);
                    return this;
                }

                // sooooo ideally right now what we'll see is the husk whacking itself 3-5 times and then not doing anything anymore :P

                // NOTE: currently I expect that, not calling actOut again once I get this started with PREPARE, we'll just hang after the first barrage
                // one solution would be to check entityType at various 'end result' scenarios (all should probably funnel into recoverEql unless dead)
                //      if !== 'player', then fire up actOut() real quick at that step
                // another solution is to have actOut fire periodically to self-monitor, which could lead to more dynamic behavior but higher fxn load back here

                return;



                // if we got here, we've got actionQueue items lined up!
                // OK! 
                
                // this.abilityBar[0].use(this);
                this.actionQueue[this.actionIndex].use(this);
                this.actionIndex += 1;

                // this.actionQueue.shift();
                // HERE: if actionQueue is depleted, set a new timeOut equal to eql recovery needed
                if (this.actionQueue[this.actionIndex + 1] == null) {
                    console.log(`${this.name} is all tuckered out. It quaffs a healing potion and recovers ${this.stats.hpmax - this.stats.hp} HP!`);
                    this.stats.hp = this.stats.hpmax;
                    this.actionIndex = 0;
                    this.actionQueue = [];
                    setTimeout(() => this.actOut(), (1000 - this.eql) * 10);
                }

                return this;
            }


            case 'chill': {
                break;
            }


            case 'battle': {
                if (this.playStack.battle?.id != null) {
                    // seek a target amongst factions: 'zenithican' in chatventure.events[battleEventID].factions.zenithican
                }
                break;
            }


            default: {
                break;
            };
        }
    }

    ouch(damageObject, source) {
        // hm let's go back and do m-att first to determine what our damageObject ends up looking like first...
        this.stats.hp -= damageObject.hpDamage;
        console.log(`${this.name} took a hit for ${damageObject.hpDamage} and is now at ${this.stats.hp} HP!`);
        if (this.stats.hp <= 0) this.ded();
        return this;
    }

    ded(cause) {
        // should clear the actionQueue, io.to every player involved, and then hang out until either status changes OR existence is cleared by other means
        this.actionIndex = -999;
        this.actionQueue = [];
        if (this.currentAction != null) {
            clearTimeout(this.currentAction);
            this.currentAction = null;
        }
        this.dead = true;
        console.log(`The final attack was just too much. The husk collapses with a heavy sigh and moves no more.`);
    }
}


// const Joe = new HuskMob().init(20).actOut();
// INTERESTING! ... so in order to CHAIN, each stage of the chain of functions needs to return THIS
// that makes sense, now that I reflect on it. Neat!

function handleAbilityInput(agent) {
    // THIS: player entered a command to do a thing -- how should we get that ball rolling?
    // if we're already doing stuff, add it to the list
    // if we're NOT doing a thing, get the thing(s) started

    // not sure yet if it makes any sense to apply this to npc/mob actions, or just have them actOut wildly, or both
    if (agent.actionIndex < 0) {
        console.log(`STILL RECOVERING EQL, CANNAE DO A THING, BARGLEBONGLE`);
    }
}

function prepareAbility(agent) {
    // send any io echoes, fire up the agent.currentAction timeout appropriately to USE upon
    /*
    
        Doopty whoopty... let's see now...
        we should have actionIndex set to the proper spot by now, right? let's say aye-sir, we call this prepareAbility AFTER we're set to go, autopilot from there
        sooooo check the agent.actionQueue[agent.actionIndex].windup, set a timeOut for that in agent.currentAction

        finalmente, in order to useAbility, we need to make sure it has everything 'in' it that a useAbility can get itself sorted...
        
        for now, we're ignoring agent.currentAbility; we may reintegrate the concept a bit later, after some testing here
            - the MAIN reason I wanted it in the first place was so I could clearTimeout @ it if a "cancelling effect" came in
            - we can approximate the same effect through a complex series of checks at every step here, buuuuuuuuuuuut
            - yeah, no, let's use agent.currentAbility = setTimeout(...) after testing this first flow setup
        
    */

    let ability = agent.actionQueue[agent.actionIndex];
    // FOR TESTING, we'll just use console.log here before we worry about io.to(e'erbody)
    // FIXING COMBAT: !MHR
    console.log(`${agent.name} is preparing to use ${ability.name} against ${agent.playStack.target.name}!`);
    if (ability.windup === 0) return ability.use();
    return agent.currentAction = setTimeout(() => ability.use(), ability.windup);
}

function useAbility(agent) {
    let ability = agent.actionQueue[agent.actionIndex];
    let resultObject = {hpDamage: 0, mpDamage: 0};
    let target = agent.playStack.target;
    // make sure agent is still in a condition to USE after any windup, and thennnnn...
    /*
    
        type: 'martial', action: 'movement', intent: 'attack', flavor: 'basic', effects: {damage: {base: 1, potency: 1, flavor: 'basic'}}
        also message: ``, just insert the agent before and target after, ezpz for now
    
    */
    // IF we hit an "oopsie cannot continue with actions" error that's substantial enough (too little eql, now dead or asleep, etc.)...
    //  ... reset actionIndex to null, for starters... OR we could do actionIndex as -1 if we're 'broken' and HAVE to chill out
    // intitiate a recoverEql timeout scenario
    // after we're done, chain to cooldownAbility()    
    if (agent.stats.hp <= 0) {
        return console.log(`Welp ${agent.name} can't do much in this state due to being dead. Whoopsie. Blep.`);
    }

    if (agent.eql <= ability.eqlCost) {
        recoverEql(agent);
        return console.log(`EQL too low! ${agent.name[0].toUpperCase()}${agent.substring(1)} falls over and cannot continue their actions.`);
    }

    if (agent.stats.mp <= ability.mpCost) {
        recoverEql(agent);
        return console.log(`MP too low! ${agent.name[0].toUpperCase()}${agent.substring(1)} stares blankly into the middle distance.`);
    }

    // add more conditions above as we go, but below, we'll assume we're GOOD, let's rock!

    // HERE: add up previous queue momentum... in a bit

    // HERE: call damage calculation functions, if applicable; also, define said fxns in a bit
    // oh. hrm. we don't currently take into consideration the ability's use stat and contest stat (in basic case, atk vs def)
    // also having atkDamage vs magDamage might cheerfully fix that concern

    let momentousAmp = 0;
    Object.keys(ability.effects).forEach(effect => {
        switch (effect) {
            case 'atkDamage': {

            }
            default: break;
        }
    })

    if (ability.effects.damage != null) {
        // baseDamage from type-action-intent-flavor... eh, we'll just doop up for now, but can amp differently later
        
        if (agent.actionIndex > 0) {
            
            for (let i = agent.actionIndex - 1; i--; i >= 0) {
                if (agent.actionQueue[i].type === agent.actionQueue[i].type) momentousAmp += 1;
                if (agent.actionQueue[i].action === agent.actionQueue[i].action) momentousAmp += 1;
                if (agent.actionQueue[i].intent === agent.actionQueue[i].intent) momentousAmp += 1;
            }
        }
        let baseDamage = Math.sqrt(agent.stats.atk) + ability.effects.damage.base + momentousAmp;
        let baseReduction = Math.sqrt(target.stats.def) / (1.5 + ((100 - target.eql) / 25));
        baseDamage -= baseReduction;
        baseDamage *= ability.effects.damage.potency;
        baseDamage = Math.floor(baseDamage);
        // somewhere around here, check hands for weapons and apply atkMod
        resultObject.hpDamage = baseDamage;
    }

    let actionMessage = `${agent.name[0].toUpperCase()}${agent.name.substring(1)} ${ability.message} ${agent.playStack.target.name}, hitting for ${resultObject.hpDamage} damage!`;

    // THIS AREA: create message echo, send to io and history
    console.log(actionMessage);
    agent.playStack.target.ouch(resultObject);

    return agent.currentAction = setTimeout(() => cooldownAbility(agent), ability.cooldown);
}

function cooldownAbility(agent) {
    /*
    
        HERE: 
        ... ok, so currentAction is the timeout that is set by these functions (well, it WILL be)
            - is there another ability waiting next in the queue?
                - YEP: increment actionIndex and PREPARE via the 'new' action
                - NAH: well, cooldown is all done, so currentAction should be set to chainCooldown for 3000
    
    */

    // hrm
    if (agent.actionQueue[agent.actionIndex + 1] != null) {
        // CASE: we have a new move coming up!
        agent.actionIndex += 1;
        prepareAbility(agent);
    } else {
        // CASE: no currently planned 'next move,' so use chainCooldown to await the next possible action
        return agent.currentAction = setTimeout(() => chainCooldown(agent), 3000);
    }
}


function chainCooldown(agent) {
    // if there's no new index entry, RESET - null activityIndex, [] out activityQueue, and currentAction is a timeout of recoverEql
    // final check... 
    if (agent.actionQueue[agent.actionIndex + 1] == null) {
        // CASE: no action planned, we've expired our 'chance' to keep chaining
        return recoverEql(agent);
    } else {
        // CASE: oh hi, something IS now planned, so let's get on that!
        agent.actionIndex += 1;
        prepareAbility(agent);
    }
}

function recoverEql(agent) {
    // gotta take a breather, y'know - when this function resolves, WOO! EQL to 100!
    // can also check for activityQueue and start it all over again if there are commands awaiting us post-recovery
    // I actually don't have a model for EQL recovery yet... could be based on speed, stats, remaining EQL, what have you
    // but for now, FIVE SECONDS IN THE PENALTY BOX :P
    agent.actionIndex = -1; // this'll be our shorthand for OUTTA COMMISSION FOR NOW
    agent.actionQueue = [];
    agent.currentAction = setTimeout(() => {
        agent.actionIndex = null;
        agent.eql = 100;
        agent.actionMomentum = {};
        console.log(`${agent.name} is ready to ACTION again!`);
        if (agent.entityType !== 'player') agent.actOut();
    }, 5000);
}



// what can ya build? how can ya build it? what does it do? 
/*



Constructing some structing
- nexus is the conduit for inter-chat travel
- perimeter is the perimeter of the township, the gateway to 'scouting'/patrolling/local area chatventuring

ALLSTRUCTS BRAINSTORM:
Many of the below can be constructed in various ways, such as a blacksmith tent or blacksmith cabin; class-buildings are likely an exception due to their nature
- tavern
- den (rogue)
- barracks (fighter)
- sanctuary (sympath)
- tower (mage)
- foolplace (only there in minstats scenario)
- general store (only the most basic equipment, some tools)
- tradehall / starter get-any-materials with no specificity
- lumberjack
- mining
- forager
- stonemason
- forge
- blacksmith (can focus on weapons, armor, accessories, general, etc.)
- leatherworker (same)
- woodworker
- clothier
- apothecary
- gemsmith
- stables
- training yard
- townhall
- town wall
- town gate
- stockpile
- well
- orchard
- farmland
- shipyard
- fishfellows
- hunterlodge
- scoutbase
- singlehouse
- grouphouse
- construction headquarters

STUFF THAT CAN BE BUILT LOCALLY:
- road
- mine (really required for better and more metal income; otherwise lots of copper, a little iron :P)
- logcamp
- guardtower


STARTING TOWNSHIP STRUCTS:
- tavern (most of initial pop, recruit for chatventures, rumors and shenanigans)
- player's class struct
- general store
- townwall (not visitable, just there :P)
- towngate
- tradehall (poor thing will be WILDLY overstuffed with duties :P) - can log, mine, forage, repair, construct, quarry, refine (metal and wood), and probably more
- stockpile
- townwell
- scoutbase (also provides some hunting)

start with say 5 or so NPC's, slotted into tavern, general store, starting class struct, tradehall, and scoutbase


ADD: popMin, popCurrent, popCap, npcSlots, townIncome (which may have to be calculated depending on worldMap data)

- popMin: always actually zero, buuuut popMin represents the minimum viable 'basic running' of a struct
- drop below popMin, and you get drastically suboptimal effects from it
- at zero, struct 'turns off' and fails to provide any income, and begins to fall into substantial disrepair


    NOTE: we can include 'extra' stuff the Class does NOT inherit here, such as special methods for naming, upgrade/level data, etc.
    ... and we can further play with method inheritance, if we're feeling especially spunky for future struct permutation

    don't forget to add HP to structs, as well as maintenance costs (fancier places with more use require more maintenance!)
        - or can have a 'static' calculated cost based on construction cost and popuation assigned to it?
        - eh, makes sense, and gives something for visitors to potentially help out with :P
        - there can also be static or multiplicative costs depending on worldMap factors
    
    can add a buildLimit for stuff like nexus that should be 'unique' in a township (likely also class structs)

    query: if we upgrade buildings with {...oldBuildingData, ...newBuildingData}, can we accomodate for upgrades?
        - probably yes, since the upgradeData wouldn't have overwrite data for upgrade bits

*/

function placeStruct(struct, area) {
    // not a strictly necessary function just yet
}

const structBlueprints = {
    'nexus': {
        type: 'nexus', nickname: `The Nexus Crystal`, 
        description: 'A blossom of milky blue-white crystal, standing twice the height of a tall man, that acts as the heart of the township.',
        innerDescription: 'How did you even get IN here? Crystals! Crystals everywhere!',
        level: 1, hp: 3000, interactions: {nexus: 'nexus'}, icon: {type: 'x'}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, 
        weight: 0, buildLimit: 1, operation: {min: 0, current: 0, cap: 0, slots: 0}, npcSlots: [], population: 0,
        construction: {main: {opalite: 100}},
        boosts: {township: {}, player: {}},
        inventory: {construction: {}},
        upgradeData: {
            2: {reqLevel: 1, reqMaterials: {opalite: 50}, buildTime: 3, newBuildData: {
                description: `It's a Level 2 Nexus. Fancy! I bet it does something neat. Besides glow more brightly than before, which it certainly does.`
            }},
            3: {},
            4: {},
            5: {},
        },

        nexus() {},
        init(newNexus, area) {
            /*
            
                INIT SHOULD: build the struct, initializing any 'randomized' values
                - eventually should probably accept coords to 'build on'
                - ... should every struct just be its own Class? Hmmmmmmm...
                - that WOULD make it easier to just new NexusStruct(whereat).init().place(coords).upgradeCheck().upgrade().etc()

            
            */
            // newNexus.description = `${area.nickname}'s Nexus is a jagged crownlike blossom of translucent blue crystal, standing twice the height of a tall man, that acts as the heart of this township.`;
            return;
        },
        tick() {
            /*
            
                THIS: figure out what to pass in to 'tick' to make it update the township properly
                    - 
            
            */
            // goal: thinking that going through the struct list and doing structBlueprints(struct.type).tick()
        }
    },
    // should probably copy the below into a new 'towngate' item, but for now, changing the below would break pre-existing players and mechanics
    'perimeter': {
        type: 'perimeter', nickname: `Township Gate`,
        description: `The town gate stands as a simple structure, looming tall enough for a mounted rider to comfortably fit through, and bearing a sturdy set of doors to keep out the unwanted.`,
        innerDescription: `You stand at the township gate, the wilderness beyond in clear view.`,
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
        explore(agent, origin) {
            // ideally, the mechanism to begin a chatventure to locate good resources for both player and township
        },
        visit(agent, origin) {
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
                    
                    
                    // console.log(`A NEW CHATVENTURE LOOKS LIKE THIS: `, newChatventure);

                    // HERE: allChatventures - created
                    allChatventures[newChatventure.id] = JSON.parse(JSON.stringify(newChatventure));

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
        level: 1, hp: 3000, interactions: {visit: {recruit: 'recruit', rest: 'rest'}, recruit: 'recruit', rest: 'rest'}, icon: {}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, // hm, gonna have to rethink how to define perimeter dimensions
        construction: {main: {lumber: 100}}, operation: {min: 1, current: 0, cap: 5, slots: 1}, npcSlots: [], population: 10,
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
        level: 1, hp: 3000, interactions: {visit: {trade: 'trade'}, trade: 'trade'}, icon: {}, gps: {}, dimensions: {x: 1, y: 1, z: 1}, // hm, gonna have to rethink how to define perimeter dimensions
        construction: {main: {lumber: 100}}, operation: {min: 1, current: 0, cap: 3, slots: 1}, npcSlots: [], population: 1,
        boosts: {township: {}, player: {}},
        inventory: {construction: {}, wares: {weapons: {}, armor: {}, tools: {}, items: {}}},

        init(newStore, player) {
            // takes in a store and mods its initial wares into some combination of useful stuff
            // it'd be neat if it read the "vibe" of the town to procure maximally useful starting wares for user's starting class
            // we're passing in the whole-arse player so we have access to ALL their variables, including township, to make some informed and whimsical choices
            // NOTE: all wares are 'blueprints,' so should meet all the necessary criteria to make a new Item()
            /*
            
                NEWEST: initialize with the player's CLASS in mind, and can later 
            
            */
            // we can get cheeky and use pre-existing blueprints as a model for shop wares, rolling fanciful to fruitful changes to baseline gear
        },
        trade() {
            // doopty doo ... init the 'trading' chatventure
        },
                  
    },
    'stockpile': {
        type: 'stockpile', nickname: `Township Stockpile`,
    },
    'town wall': {
        type: 'town wall', 
    }, 
    'town gate': {
        type: 'town gate', 
    },
    'tradehall': {
        type: 'tradehall', 
    }, 
    'town well': {
        type: 'town well', 
    },
    'scout base': {
        type: 'scout base', 
        operation: {min: 1, current: 0, cap: 5, slots: 1}, npcSlots: [],
    }

};

//!MHRinteract ... which we should totally generalize and not lock into specific structs, right?

// RIGHT!

const structActions = {
    gate(entity, township) {
            // removing the 'struct' part of this and refactoring to target the TOWNSHIP instead
            let mapToGrab = null;
            if (allWorlds[township.worldID] != null) {
                entity.playStack = {...entity.playStack, wps: township.wps, worldID: township.worldID, mode: 'worldMap'};
                // actually, we might have to sanitize the map obj a little, but for now we kinda need a lot of it, sooooooooo here ya go, bud:
                mapToGrab = allWorlds[township.worldID];
                
                return io.to(entity.name).emit('enter_world_map', {playStack: entity.playStack, mapObj: mapToGrab});
            }
            return console.log(`Someone tried to enter a world through a town gate, but it failed for some reason. We should look into why that is...`);        
    },
    nexus(entity, township) {
        console.log(`VWOOOOOM is the sound of crystals in the Nexus.`);
    },
    shop(entity, township) {
        // bring up those WARES!
        console.log(`${entity.name} wishes to go shopping! But ${township.nickname} is ill-equipped to handle such an idea.`);
    }

}

const structInteractions = {
    'town gate': {
        gate(entity, target) {
            // given the player entity and the target struct, backsolve to pop them into that township's world at the wps of said township
            let mapToGrab = null;

            if (allWorlds[allSouls[target.soulRef].township.worldID] != null) {
                let targetTownship = allSouls[target.soulRef].township;
                entity.playStack = {...entity.playStack, wps: targetTownship.wps, worldID: targetTownship.worldID, mode: 'worldMap'};
                // actually, we might have to sanitize the map obj a little, but for now we kinda need a lot of it, sooooooooo here ya go, bud:
                mapToGrab = allWorlds[allSouls[target.soulRef].township.worldID];
                
                return io.to(entity.name).emit('enter_world_map', {playStack: entity.playStack, mapObj: mapToGrab});
            }
            return console.log(`Someone tried to enter a world through a town gate, but it failed for some reason. We should look into why that is...`);
        }
    },
    'nexus': {
        nexus() {

        }
    },
    'gather': {
        refine(entity, target) {
            // we'll need another menu here to make this fly
            console.log(`${entity?.name} wishes to refine some materials.`);
        }
    },
    'tradepost': {
        shop(entity, target) {
            console.log(`${entity?.name} wishes to shop.`);
        }
    },
    'tradehall': {
        shop(entity, target) {

        }
    },
    'inn': {
        recruit(entity, target) {
            console.log(`${entity?.name} wishes to recruit someone to their team.`);
        }
    },
    'default': {
        default() {
            return true;
        }
    },

}



/*

-! nexus
-! town gate
-! (internal) tradehall - source of gathering/assigning external doots to get materials (+2 to start)
    - also serves as basic 'processing' capacity, turning ore into metal and such... slow but steady
-! (internal) build (1 slot to start, no mods)
-! (internal) storage (starts as stockpile, can get fancier later)
-! (internal) inn (with built-in tavern for tavern shenanigans) ... rest up, get travelers, recruit npc parties, make some grub
-! (internal) tradepost... starter struct that can upgrade as local shop as well as trade generator (based on wares, and later on a demand system)
    - first shop, assumed level 10 competency at crafting starter-tier gear      
-! (internal) class trainer structs: sanctuary, tower, den, arena/gymnasium
-! (internal) pit - +1 mineral, + 1 stone by default... can specialize into town mine/dungeon, but beware going too deep!



... NEW MATERIALS
wood, ore, stone, game, water, vegetation (more broad than 'herbs,' but inclusive of)
- gemstones can be a relatively rare side-effect of getting metal and stone for now

'refining facilities' can turn stuff like game into leather, but by default we'll assume game, freshwater, and food are consumed for sustenance?
    .. no mechanism for that yet, but that's fine :P
    .. alternatively, they can be 'spent' for specific purposes? 
anyway, we'll focus first on the building materials I suppose
... might come back to population concepts, hm... no longer oops all npcs

now then
wood, ore, stone, game, water, vegetation
resourceAmps, homeIncome... that's what the township specializes in. Want to boost specific tiles? Build on THEM, buddy!
ah! and refining. ore -> whatever, game -> meat, bone, leather
    - how much of this should be automatic versus 'hey start making this happen for us plz'?
    - eh, maybe advanced versions allow automation, but standard versions require you to pop in and be like 'hey manage us dummies'

when requesting to manage a township, we can grab just that itty-bitty slice of map, or throw the whole map at the client and let them sort it out :P
    - if we already have the correct map from when we visit the township initially, we're good to go?
    - so maybe whenever we visit any township with locationData, we throw the mapData in there for jolly good measure (if applicable)


CHANGEUP
homeIncome is now split into woodIncome, oreIncome, etc.
    - so we can loop through and all townstats per struct to our total
same for resourceAmps
    - i.e. waterAmp, woodAmp, etc.


PitStruct, TradePostStruct, InnStruct, StorageStruct, BuildStruct, GatherStruct, TownGateStruct, NexusStruct, WellStruct
known townstats: {
    woodIncome, oreIncome, stoneIncome, gameIncome, waterIncome, vegIncome,
    woodAmp, oreAmp, stoneAmp, gameAmp, waterAmp, vegAmp,
    gatherSlots, buildSlots, traffic, commerce
}
... so we need to set the township "starter stats" upon init, and then loop through all the buildings and add their townstat keys (all numbers!) to our starter numbers

traffic above for determining how generally inviting the township is for comers and goers... a high traffic count can help out with attempts to 
    recruit/do taverny things, though you need a tavern-y meeting place for that; commerce is assisted
commerce is... a currently poorly-defined reflection of the concept that folks come in and spend coin at the township :P

*/


//! MHRstructclass
// boy, if we want to get REALLY saucy, we could just have constructor(structObj) and then do this = {...structObj}? :P

class Struct {
    constructor(structObj) {
        this.type = structObj.type || ``;
        this.displayName = structObj.displayName || ``;
        this.id = null;
        this.soulRef = null;
        this.nickname = structObj.nickname || ``;
        this.description = structObj.description || `A mass of materials, in a shape, resembling a structure.`;
        this.level = structObj.level || 0;
        this.hp = structObj.hp || 10;
        this.townstats = structObj.townstats || {};
        this.refineOptions = structObj.refineOptions || [];
        this.interactions = structObj.interactions || null;
        this.specializations = structObj.specializations || {};
        this.icon = structObj.icon || null;
        this.weight = structObj.weight || 0;
        this.buildLimit = structObj.buildLimit || null;
        this.npcSlots = structObj.npcSlots || null;
        this.construction = structObj.construction || null;
        this.wares = structObj.wares || null;
    }

    init(place) {
        // take in a township or something... a referenced object that has structs or potential structs
        // NOTE: we should have place.type === 'tile' so we can update a world tile, if it's something that can be built 'outside'
        // assuming for now that place is a township in allSouls somewhere
        // console.log(`Well hi I'm a new struct about to be born unto the world! The old place: `, place);
        if (place.structs == null) place.structs = {};
        
        this.soulRef = place.soulRef; // works fine for townships, at any rate :P
        switch (this.type) {
            case 'crossroad': {
                this.id = 'crossroad';
                place.structs['crossroad'] = this;
                return this;
            }
            case 'tradehall': {
                this.id = 'tradehall';
                place.structs['tradehall'] = this;
                return this;
            }
            case 'mineshaft': {
                this.id = 'mineshaft';
                place.structs['mineshaft'] = this;
                return this;
            }
            case 'town wall': {
                this.id = 'town wall';
                place.structs['town wall'] = this;
                return this;
            }
            default: {
                let newID = generateRandomID('struct');
                this.id = newID;
                place.structs[newID] = this;
                return this;
            }
        }

    }

    beginBuilding(source, target) {
        // for when we actually plan to build the thing
        // source is where the materials and labor are coming from; target is assumed same as source unless explicitly defined
        // level 0 == unbuilt
    }

    beginUpgrading(source, target) {
        // null for now
    }

}

class WellStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'well';
        this.displayName = 'Town Well';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Town Well`;
        this.description = `A simple collection of gray and white bricks arranged around an earthbound man-made wellspring, a simple bucket-and-pulley attached for fetching water.`;
        this.level = 1;
        this.hp = 1000;
        this.interactions = null;
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [1,1,1];
        this.weight = 10;
        this.townstats = {waterIncome: 2};
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {stone: 5, wood: 3, grease: 240};
        this.inventory = null;
    }
}

class NexusStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'nexus';
        this.displayName = 'Nexus';
        this.id = null;
        this.soulRef = null;
        this.nickname = `The Nexus Crystals`;
        this.description = `A blossom of milky blue-white crystal, standing twice the height of a tall man, that acts as the heart of the township.`,
        this.level = 1;
        this.hp = 3000;
        this.interactions = {nexus: 'nexus', default: 'nexus'};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.dimensions = {x: 1, y: 1, z: 1};
        this.mapSpot = null;
        this.weight = 0;
        this.buildLimit = 1;
        this.npcSlots = null;
        this.construction = {opalite: 1000};
        this.inventory = null;
    }
}

class CrossroadStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'crossroad';
        this.displayName = 'Crossroad';
        this.id = null;
        this.soulRef = null;
        this.nickname = `The Crossroad`;
        this.description = `A sharply-angled two-story building of chalkstone and timber. The Nexus of the township rests within, through which all Zenithican traffic passes, making this the first and last stop for all travelers coming through crystalline means. As such, this stucture pulls additional duty as a tavern and inn, offering simple room, board, and feasting fare for the weary traveler.`,
        this.level = 1;
        this.hp = 5000;
        this.interactions = ['nexus'];
        this.townstats = {traffic: 1, commerce: 1, waterIncome: 2};
        this.refineOptions = [
            {name: 'Brew Beer', resource: 'water', from: {veg: 2, water: 2}, into: {beer: 2}, time: 60},
            {name: 'Prepare Vegetables', resource: 'veg', from: {veg: 4, water: 2}, into: {food: 2}, time: 60}
        ];
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.dimensions = {x: 1, y: 1, z: 1};
        this.mapSpot = null;
        this.weight = 0;
        this.buildLimit = 1;
        this.npcSlots = null;
        this.construction = {opalite: 10, timber: 40, chalkstone: 40};
        this.inventory = null;
    }
}

class TradehallStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'tradehall';
        this.displayName = 'Tradehall';
        this.id = null;
        this.soulRef = null;
        this.nickname = `The Tradehall`;
        this.description = `Currently little more than a gigantic tent, under which all manner of tools of crafting and gathering are stored.`,
        this.level = 1;
        this.hp = 3500;
        this.interactions = ['shop'];
        this.townstats = {actionSlots: 3, commerce: 2, storage: 250};
        this.refineOptions = [
            {name: 'Butcher Game', resource: 'game', from: {game: 4, water: 2}, into: {food: 2, leather: 2}, time: 60},
            {name: 'Cut Timber', resource: 'wood', from: {wood: 4}, into: {timber: 2}, time: 60},
            {name: 'Smelt Ore', resource: 'ore', from: {ore: 4}, into: {iron: 2, copper: 1}, time: 60},
            {name: 'Cut Chalkstone', resource: 'stone', from: {stone: 4}, into: {chalkstone: 2}, time: 60}
        ];
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.dimensions = {x: 1, y: 1, z: 1};
        this.mapSpot = null;
        this.weight = 0;
        this.buildLimit = 1;
        this.npcSlots = null;
        this.construction = {timber: 40, chalkstone: 40};
        this.inventory = null;
        this.wares = {};
    }
}

class TownGateStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'town wall';
        this.displayName = 'Town Wall'
        this.id = null;
        this.soulRef = null;
        this.nickname = `The Town Wall`;
        this.description = `A large wall made of sturdy weathered wood, with a stately gate on one side for traffic to pass through, and monsters to NOT pass through, if all goes well.`,
        this.level = 1;
        this.hp = 8500;
        this.interactions = ['gate'];
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.dimensions = {x: 1, y: 1, z: 1};
        this.mapSpot = null;
        this.weight = 0;
        this.buildLimit = 1;
        this.npcSlots = null;
        this.construction = {wood: 10};
        this.inventory = null;
    }
}

class GatherStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'gather';
        this.displayName = 'Tradesman Tent';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Tradesman Tent`;
        this.description = `A relatively large open-design tent, the main purpose is to serve as a storehouse for the various tools of mining, digging, and foraging. Several makeshift workstations sit haphazardly about, suitable for simple raw material refinement.`;
        this.level = 1;
        this.hp = 1200;
        this.interactions = {default: 'refine', refine: 'refine'};
        this.townstats = {gatherSlots: 2};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [1,1,1];
        this.weight = 40;
        this.refineActions = [
            {name: `Basic Butchery`, from: {water: 1, game: 2}, to: {meat: 1, leather: 1, bone: 1}},
            {name: `Simple Smelting`, from: {water: 1, ore: 2}, to: {metal: 1}},
            {name: `Wanton Woodcutting`, from: {wood: 2}, to: {lumber: 1}},
        ]; // not quiiiite where I want it to be, but a solid enough start
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {leather: 5, wood: 3, grease: 300};
        this.inventory = null;
    }
}

class BuildStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'build';
        this.displayName = 'Builder Tent';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Builders' Tent`;
        this.description = `Little more than several felled trees propping up a covering sheet of light leather, providing simple cover and a designated storage space for all manner of simplistic building tools.`;
        this.level = 1;
        this.hp = 800;
        this.interactions = null;
        this.townstats = {buildSlots: 1};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [1,1,1];
        this.weight = 25;
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {leather: 3, wood: 5, grease: 300};
        this.inventory = null;
    }
}

class StorageStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'storage';
        this.displayName = 'Storage Tent';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Storage Tent`;
        this.description = `Just a slight step up from leaving the spoils of the township's labours lying in the hole in the ground, instead we have a massive tent of raw logs and rugged leather, tightly enclosed, with various pits, boxes, and crannies dedicated to the storage of all manner of raw materials.`;
        this.level = 1;
        this.hp = 1200;
        this.interactions = null;
        this.townstats = {storage: 200};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [2,1,1];
        this.weight = 15;
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {leather: 5, wood: 5, grease: 600};
        this.inventory = null;
    }
}

class InnStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'inn';
        this.displayName = 'Simple Inn';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Simple Inn`;
        this.description = `A relatively bare but respectable building of simple constructed wood and stone, adorned with metal fittings, suitable for hosting travelers. A smallish tavern is set up just inside the entrance, just cozy and stocked enough to feature an ever-present collection of comers and goers.`;
        this.level = 1;
        this.hp = 2000;
        this.interactions = {default: 'recruit', recruit: 'recruit'};
        this.townstats = {traffic: 1, commerce: 1};
        // I was thinking of having an 'operating cost mode' where it consumes water and meat to boost traffic? not sure how to implement yet
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [2,1,1];
        this.weight = 20;
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {chalkstone: 20, mattle: 5, softwood: 20, grease: 720};
        this.inventory = null;
    }
}

class TradePostStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'tradepost';
        this.displayName = 'Small Tradepost';
        this.id = null;
        this.soulRef = null;
        this.nickname = `A Trading Post`;
        this.description = `A sturdy, small, square building of chalk cobblestone framed in wood. Serving as sort of a rustic general store and provisionary shop, it features a simple stock based on the local trades of the township.`;
        this.level = 1;
        this.hp = 1500;
        this.interactions = {default: 'shop'};
        this.townstats = {commerce: 2};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [1,1,1];
        this.weight = 20;
        this.buildLimit = null;
        this.npcSlots = null;
        this.construction = {chalkstone: 10, softwood: 10, grease: 600};
        this.inventory = null;
    }
}

class SpireStruct extends Struct {
    constructor(structObj) {
        super(structObj);
        this.type = 'mineshaft';
        this.displayName = `Delvers' Pit`;
        this.id = null;
        this.soulRef = null;
        this.nickname = `Moley Holey`;
        this.description = `Every township has one, and this is the most rudimentary version: a massive hole, dug downward at a slight angle, with the goal of being able to reach the choicest meats and fruits of the earth from the safety of the township.`;
        this.level = 1;
        this.hp = 3000;
        this.interactions = null;
        this.townstats = {oreIncome: 1, stoneIncome: 1};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.xyz = [1,1,1];
        this.weight = 0;
        this.buildLimit = 1;
        this.npcSlots = null;
        this.construction = {grease: 6000};
        this.inventory = null;
    }
}

class FighterStruct extends Struct {

}

class RogueStruct extends Struct {

}

class SorcererStruct extends Struct {

}

class SympathStruct extends Struct {
    
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
let allWorlds = {};
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

function capitalizeFirstLetter(string) {
    return `${string[0].toUpperCase()}${string.substring(1)}`;
}

/*

    LEVEL UP REDUX
    - player level goes up, stats go up! for a single class equipped, ezpz, multiply LEVEL * STATBUMPS
    - exp requirement for class-up 

    - since we're imagining player level 10 as the current 'endgame' for demo, second class equipped at that point, woooooo~


    huskSwat: {
        name: 'husk swat', tier: 1, active: true, type: 'martial', action: 'movement', intent: 'attack', flavor: 'basic', target: 'otherFaction', aoe: 'single',
        windup: 0, cooldown: 1500, mpCost: 0, eqlCost: 20, class: 'none', effects: {atkDamage: {base: 1, potency: 1, stagger: 1, flavor: 'basic'}},
        message: `wildly swipes a meaty paw at`, // can turn this into an array and then use pickOne for FLAVOR
        // how to handle messaging in this case?? hmmmmm... we couuuuuld init the skill on an agent to init the messaging for it, then delete the messagingInit fxn?
        // well, for now, let's just go generic and fill in the finer details later
        // we can also think through all possible EFFECTS to hook into useAbility, but for now, effects.damage {base, potency, flavor} will be accounted for
        // can also have easy-to-replace wildcard values such as $AGENTNAME and $TARGETNAME
        // Object.keys(ability.effects).forEach?
    },    
    

*/

/*

Building Classes - abilities

aim for seven actives per to start out with? wouldn't take toooo long to define seven abilities. probably. :P
... plus starter/universal ones here and there, as well. hm

ROGUE
    - Steal (steal1)
    - Ensnaggle
    - Staccato Stabbing
    - Mug (steal2)
    - Underdog's Bite - st eql swap
    - Backstab - big st finisher (works better if NOT being targeted; maybe when HEAT is a thing, that's part of it as well?)
    - Rend (debuff) - consumer, reduces DEF & SPR


FIGHTER
    - Assault - martial momentum consumer, give 'em the big bonk
    - Sweep - finisher, modest aoe physical dmg
    - Kiai - small ATK buff & momentum boost
    - Execute - finisher, attempts a big crit
    - Undermine - reduces ATK & MAG
    - Fury - BIG existing momentum boost, turns next attack into a finisher? ... can add finish: martial to actionMomentum, then add checks for that (finish: any also)
    - ???

SYMPATH
    - zephyr - mild factionwide healing hp/mp over time (wind1)
    - cleansing waves - mild panacea & protection vs poison, disease, some other ill effects (water1)
    - salt of the earth - aoe buff DEF/RES (earth1)
    - lulling breeze (wind2) - aoe calm/sleep
    - wash away wounds - st instant healing (water2)
    - quivery quake - aoe eql shenanigans (earth2)
    - (maybe barrier - absolute mitigation)

MAGE
    - sizzleshot - st dmg & attempt burn debuff (fire1)
    - frostfang - st dmg & debuff (ice1)
    - shockbolt - st zappy dmg & debuff (bolt1)
    - inferno (fire2) - aoe fire
    - frostbite (ice2) - aoe ice
    - shockstorm (bolt2) - aoe zap
    - charged air - field generation based on previous spell/impulse, with default 'magic energy field'


FOOL

TINKER

*/

class StrikeAbility {
    constructor() {
        this.name = 'strike';
        this.owner = null;
        this.tier = 1;
        this.level = 1;
        this.active = true;
        this.type = 'physical';
        this.family = '???';
        this.intent = 'attack';
        this.flavor = 'basic';
        this.target = 'otherFaction';
        this.aoe = 'single';
        this.deftMod = 1;
        this.exp = 0;
        this.mpCost = 0;
        this.pipCost = 0;
        this.effects = {
            attack: {
                base: 0,
                potency: 1,
                stagger: 1,
                flavor: 'basic'
            }
        }
    }

    learn(whomst) {
        console.log(`WHOMST ATTEMPTED TO LEARN TO STRIKE: `, whomst);
        this.owner = whomst;
        return this;
    }

    use(target) {
        let user = this.owner;
        if (user == null) return console.log(`Someone tried to STRIKE, but nobody can figure out whomst, as the user/this.owner failed to be defined properly.`);
        // HERE: maybe parse target.entityType for further considerations? like group targeting info... not relevant for this move, however
        if (target == null) return console.log(`Someone tried to STRIKE, but didn't have an appropriate target lined up.`);
        let ability = this;

        if (user.stats.hp <= 0) {
            return console.log(`Oops, cannot STRIKE whilst DED.`);
        }
        if (target.stats.hp <= 0) {
            // change later to automatically swing at a different target... this ain't OG FF1
            console.log(`${user.name} ceases their attack; their target is already quite vanquished.`);
            user.playStack.target = null;
            return recoverEql(user);
        }
        if (user.stats.mp < ability.mpCost) {
            recoverEql(user);
            return console.log(`${user.name} is forced to stare into the middle distance, realizing they're out of MP.`);
        }
        if (user.pips < ability.pipCost) {
            recoverEql(user);
            return console.log(`${user.name} attempts to Strike, but lacking the proper pip-itude, they topple over instead. THUD!`);
        }
        if (target?.faction === user?.faction) {
            return console.log(`Alas, ${user.name} attempted to Strike ${target.name}, but they're on the same team: ${target.faction}. No friendly fire here!`);
        }

        // HERE: make and call a canIAct(user) that returns true or false to cover sleeping, dead, paralyzed, etc.
        //      if incapacitated due to status effect, echo out accordingly and end turn

        // awkwardly, allMobs has to use ID instead of name, so we may have to do some workaround voodoo to parse source info in .ouch() later
        // actionObject can later include information on special effects such as debuffs, buffs, etc.
        // currently assuming NOT dual-wielding no matter what :P ... dual wielding considerations can be parsed later
        // aha! now attack.hits is an array of attacks, so one attack is just the one, but now we can handle multi-hit scenarios, including dual wield
        let actionObject = {
            source: {name: user?.name, id: user?.id || null},
            attack: {
                amount: Math.floor(user.stats.atk * action.effects.attack.potency),
                hits: [{
                    // floor out the damage result at the end after going through any ouches
                    rawPower: user.stats.atk / 2, potency: 1, stagger: 1, type: 'physical', damageType: 'crushing', flavor: 'basic', vs: 'def', coverable: true
                }],
            }
        };

        // THIS AREA: first message echo, send to io and history
        console.log(`${agent.name} strikes at ${target.name}!`);

        // maybe set up target.ouch to RETURN a string, so that we can have this ability usage send the information to the 'room'
        target.ouch(actionObject);

        // thinking... a multi-hit ability would use a forEach or somesuch, scrolling through the targets

        // HERE: maybe a final 

        return user.currentAction = setTimeout(() => cooldownAbility(user), ability.cooldown);        



        // AFTER: we add to the actionmomentum that the user currently has by +1 martial, +1 attack
    }
}



function learnAbility(whomst, which) {
    if (whomst == null || which == null) return console.log(`Someone that may not exist attempted to learn an ability that may not exist.`);
    if (whomst.abilities == null) whomst.abilities = {};

    switch (which) {
        case 'strike': return whomst.abilities['strike'] = new StrikeAbility().learn(whomst);
        default: break;
    }
}



// console.log(`Bob should have learned a new ability, STRIKE! Let's see him now: `, Bob);
// console.log(`Bob! I am King Thered. I shall gift you with 3000 experience points in STRIKE. You're welcome.`);
// Bob.abilities['strike'].gainExp(3000);

const jobClassExpReqs = {
    tier1: [null, 0, 100, 500, 1200, 2500, 999999999]
}


class RogueClass {
    constructor() {
        this.name = 'rogue';
        this.tier = 1;
        this.level = 1;
        this.exp = 0;
        this.ownerRef = null;
        this.insight = 0;
        this.abilityPoints = 0;
        this.statsMods = {strength: 1.1, agility: 1.2, vitality: 1, willpower: 0.6, intelligence: 0.9, wisdom: 0.7};
        // this.statBonuses = {strength: 0, agility: 0, vitality: 0, willpower: 0, intelligence: 0, wisdom: 0};
        this.abilities = [
            null,
            ['ability1', 'ability2']
        ];
    }

    gain(whomst) {
        // this: someone just learned this class! woo! set the initial abilities... which obviously should be defined ABOVE these classes, lest we error unto doom
        // set this.owner to player.name so we don't need to add extra steps to calling further methods, as we'll know who to apply everything to
        // ooh, so that npc's can have these classes as well, have the owner be an object ref rather than a shallow, foolish soulName ref
        this.ownerRef = whomst.name;

        // HERE: slap all starter abilities into the roster of this.abilities

        return this;
    }
    
    equip(slot) {
        // this: someone wishes to equip their class! ... check 
        if (slot == null) slot = 'main';
    }

    checkLevelUp(targetLevel) {
        // mostly to check reqs?
        return false;
    }

    levelUp() {
        // bump, recalc any stat stuff, add new abilities for the new level, add some Insight
    }
}



function calcStats(entity, type) {
    // THIS: the noble endeavor of summing up class(es), equipment, statuses, etc. to get an accurate 'final headcount' of entity's current stats, mods, etc.
    // NOTE: we'll need to check entityType, as we'll be using this with npcs and mobs as well, and they don't currently handle 'class' quite the same way
    // HERE: check and fire up the ol' statSeed
    // HERE: raise all stats according to class(es)
    // HERE: roll through all equipment and modify based off gear
    /*
    
    'short sword': {
        meta: 'equipment', type: 'weapon', build: 'sword', name: 'short sword', slot: 'hand', icon: null, materialReqs: {metal: 2}, minLevel: 1,
        description: `A simple short sword. It's a sword, but kinda short.`,
        equipStats: {
          atk: {
            flat: 5,
            amp: {strength: 0.2}
          }
        },
        damageType: 'slashing',
        variance: 0.1,
        useAbility: null
    },
    

    */
   
    // stat base reset
    entity.stats.hpmax = Math.floor(30 + entity.stats.vitality + (entity.level * entity.stats.vitality / 10));
    entity.stats.mpmax = Math.floor(30 + entity.stats.wisdom + (entity.level * entity.stats.wisdom / 10));

    entity.stats.atk = Math.floor((entity.stats.strength + entity.stats.agility) / 2);
    entity.stats.def = Math.floor((entity.stats.agility + entity.stats.vitality) / 2);  
    entity.stats.mag = Math.floor((entity.stats.willpower + entity.stats.intelligence) / 2);  
    entity.stats.spr = Math.floor((entity.stats.wisdom + entity.stats.intelligence) / 2);
    entity.stats.dft = Math.floor((entity.stats.agility + entity.stats.intelligence) / 2);
    entity.stats.hp = entity.stats.hpmax;
    entity.stats.mp = entity.stats.mpmax;


    // if no type is specified, calc ALL the stats; call of fxn can specify sub-calcs such as JUST equipment
    if (type == null) type = 'all';

    if (type === 'all' || type === 'equipment') {
        Object.keys(entity.equipment).forEach((equipmentSlot) => {
            console.log(`${entity.name} is attempting to equip stats from their ${equipmentSlot}...`);
            if (entity.equipment[equipmentSlot] == null) return;
            // HERE: not null, so add appropriate stats
            Object.keys(entity.equipment[equipmentSlot].equipStats).forEach(statKey => {
                entity.stats[statKey] += entity.equipment[equipmentSlot].equipStats[statKey].flat;
                Object.keys(entity.equipment[equipmentSlot].equipStats[statKey].amp).forEach(statToAmp => {
                    entity.stats[statKey] += Math.floor(entity.stats[statToAmp] * entity.equipment[equipmentSlot].equipStats[statKey].amp[statToAmp]);
                })
            });
            console.log(`We attempted to parse their ${entity.equipment[equipmentSlot].name}. How'd we do, I wonder?`);
        });
    }

}





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
        allSecrets: allSecrets,
        allWorlds: allWorlds
    };

    // console.log(`Attempting to save this gameState: `, gameState);

    const filter = { dateKey: todaysDateKey };
    const update = { $set: gameState };
    const options = { new: true, useFindAndModify: false, upsert: true };
    console.log(`Attempting to save the game state. If you see no further message after this about saving or failing to save, something is hinky.`);

    GameState.findOneAndUpdate(filter, update, options)
        .then(updatedResult => {
            
            console.log(`GameState entry for ${updatedResult.dateKey} has been saved and updated in the database.`);
            return gameSaveTimeout = setTimeout(() => saveGameState(), standardSaveInterval);
            // HERE might be a good spot to do the server-user update? user[updatedResult.userID]... though, we'd be pulling stuff we don't want to share, hm
            // nevermind, just do it below
        })
        .catch(err => {
            console.log(`We encountered an error saving the game state: ${err}.`);
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
            // let initialLocationData = {
            //     name: 'Zenithica',
            //     nickname: 'Zenithica',
            //     description: allSouls['Zenithica'].township.townMap.description,
            //     history: allSouls['Zenithica'].township.history.slice(-150),
            //     structs: allSouls['Zenithica'].township.structs
            // };
            return socket.emit('location_update', createLocationData('Zenithica'));
        }

        if (loginData.token != null) {
            let decodedPlayerName = jwt.verify(loginData.token, process.env.SECRET).name;
            // console.log(`${decodedPlayerName} has logged in via token.`);
            const newToken = craftAccessToken(decodedPlayerName);
            socket.emit('reset_token', newToken);
            if (allSouls[decodedPlayerName] == null) return console.log(`That player doesn't exist at this time, for some reason.`);
            thisPlayer = allSouls[decodedPlayerName]; // NOTE: it's possible to have an 'old token' with nothing to match it to in some loading scenarios
            thisPlayer.following.forEach(soulName => socket.join(soulName));
            // let initialLocationData = {
            //     name: thisPlayer.playStack.gps,
            //     nickname: allSouls[thisPlayer.playStack.gps].township.nickname,
            //     description: allSouls[thisPlayer.playStack.gps].township.townMap.description,
            //     history: allSouls[thisPlayer.playStack.gps].township.history.slice(-150),
            //     structs: allSouls[thisPlayer.playStack.gps].township.structs
            // };
            if (thisPlayer?.chatventure != null) thisPlayer.chatventure = allChatventures[thisPlayer.chatventure.id];
            socket.emit('player_update', sanitizePlayerObj(thisPlayer));
            return socket.emit('location_update', createLocationData(thisPlayer.playStack.gps));      
            
        }

        if (loginData.name != null) {
            if (allSouls[loginData.name] == null) return console.log(`This player just... doesn't exist.`);
            let testHash = createHash(loginData.password, allSouls[loginData.name]?.salt);
            if (testHash === allSouls[loginData.name].hash) {
                // console.log(`${loginData.name} has logged in via name and password.`);
                const newToken = craftAccessToken(loginData.name);
                socket.emit('reset_token', newToken);
                thisPlayer = allSouls[loginData.name];
                thisPlayer.following.forEach(soulName => socket.join(soulName));
                // let initialLocationData = {
                //     name: thisPlayer.playStack.gps,
                //     nickname: allSouls[thisPlayer.playStack.gps].township.nickname,
                //     description: allSouls[thisPlayer.playStack.gps].township.townMap.description,
                //     history: allSouls[thisPlayer.playStack.gps].township.history.slice(-150),
                //     structs: allSouls[thisPlayer.playStack.gps].township.structs
                // };
                if (thisPlayer?.chatventure != null) thisPlayer.chatventure = allChatventures[thisPlayer.chatventure.id];
                socket.emit('player_update', sanitizePlayerObj(thisPlayer));
                return socket.emit('location_update', createLocationData(thisPlayer.playStack.gps)); 
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

    socket.on('request_a_map', request => {
        // holdover from basic map testing; fine to placekeep this for now, since we can use it to play with map creation logic
        let newestWorld = createWorldMap({size: 'small', level: 5, continents: 1, rangeMax: true});
        let newSpawnPoint = [0,0];
        
        do {
            newSpawnPoint = [rando(0, newestWorld.map[0].length - 1), rando(0, newestWorld.map[0].length - 1)];
            // console.log(`I do loop! Newspawnpoint is `, newSpawnPoint)
            // console.log(`Looks like the square we're on is of the type ${newestWorld.map[newSpawnPoint[0]][newSpawnPoint[1]]}`)
        } while (newestWorld.map[newSpawnPoint[0]][newSpawnPoint[1]] === 'o');
        // console.log(`Picked a delightful new spawn point for you! It is `, newSpawnPoint);
        socket.emit('new_play_map', {mapData: newestWorld.map, spawnPoint: newSpawnPoint});
    });

    socket.on('build_new_struct', reqObj => {
        //!MHRBUILD
    });

    socket.on('begin_struct_upgrade', reqObj => {
        // validate that we CAN actually upgrade with

        const { targetStruct } = reqObj;
        const targetLevel = targetStruct.level + 1;

        // NOTE: we need to make sure we replace this with JWT authentication in the future, since we have the capability
        // a validator/fixer fxn would be ideal
        // for now we're doing it... not that securely, all told :P
        if (thisPlayer == null) thisPlayer = allSouls[targetStruct.soulRef];

        const township = thisPlayer.township;
        if (targetLevel > township.structs.crossroad.level && targetStruct.type !== 'crossroad') return console.log(`Oop, upgrade the crossroad to raise the upgrade cap to get back to this guy.`);

        // console.log(`${thisPlayer.name} wishes to upgrade ${targetStruct.displayName} to level ${targetLevel}.`);

        let constructionCost = {...allTownshipStructs[targetStruct.type].upgradeSpecs[targetLevel].construction};
        const { grease, wealth: wealthCost } = constructionCost;
        delete constructionCost.grease;
        delete constructionCost.wealth;
        let buildable = true;
        Object.keys(constructionCost).forEach(reqItemKey => {
            if (township?.inventory[reqItemKey] < constructionCost[reqItemKey]) buildable = false;
        });
        if (township.wealth < wealthCost) buildable = false;

        
        /*
            !MHRUPGRADE
            
            so we want to add a BUILDING obj to the township.building array
            {
                workers: 1,
                progress: 0,
                target: 10,
                lastTick: Date(),
                projectedFinish: Date(),
                type: 'build' or 'upgrade',
                buildTarget: 'township' or 'tile' (or anything else we can later check for),
                constructionMats: {},
            }

            ... we'd need a finishBuilding() fxn to figure out how to properly 'conclude' the process and give us the SHINY NEW THING
        
        */

        // console.log(buildable ? `Turns out, they could!` : `They just don't meet the costs or reqs, though.`);
        if (township.gatheringCoords.length + township.building.length + township.refining.length >= township.townstats.actionSlots) return console.log(`Oops. Need to free up some workers.`);

        if (!buildable) {
            console.log(`Missing something for the upgrade on ${targetStruct.displayName}. Wealth is ${township.wealth} and inventory is `, township.inventory);
            return console.log(`Hopefully that clarifies what's missing back here?`);
        } 

        const rightNow = new Date();

        // we're making assumptions right now due to lack of tile upgrade feature(s)
        // for tiles, we'd have to include additional information, such as wps and worldID
        // currently 'upgrade' allows +1 level, so we don't reaaaally need to include targetLevel or anything for that
        const newUpgradeProject = {
            workers: 1,
            progress: 0,
            goal: grease,
            lastTick: rightNow,
            projectedFinish: new Date(rightNow + (1000 * 60 * 60 * grease / 10)),
            type: 'upgrade',
            buildingAt: 'township',
            subject: targetStruct.id,
            constructionMats: {...constructionCost},
            soulRef: thisPlayer.name
        }

        Object.keys(constructionCost).forEach(reqItemKey => {
            township.inventory[reqItemKey] = township.inventory[reqItemKey] - constructionCost[reqItemKey];
        });
        township.wealth -= wealthCost;



        // gotta figure out what we're gonna pass back to the client now that we're all updated... let's ref similar socket actions
        // also have to add a way to see that 'building is being upgraded!' (OR specialized, for that matter) to struct overview
        // can do a little building array search to see if we can find anything matching subject === struct.id, ezpz, hopefully
        // having a little hammer or something would be neat, THUNK THUNK THUNK
        thisPlayer.township.building.push(newUpgradeProject);

        // HERE: socket to me, baby
        calcTownship(thisPlayer.township);

        calcTownIncome(township);

        let managementData = fetchManagementData(township);

        socket.emit('township_management_data', managementData);

    });

    socket.on('view_township_management', reqObj => {

        const { soul } = reqObj;
        const township = allSouls[soul].township;

        if (thisPlayer == null) thisPlayer = allSouls[soul];

        /*
            
            TO ADD TO MGMTDATA: 
            - building options available (curated back here?)
            allTownshipStructs is an OBJECT; we want to filter through a keys-array of that after we pop out anything with a buildLimit of 1
                nothing with a buildLimit
                everything else should be viable atm
                what do we need to preserve to pass down? 
                an ARRAY of OBJECTS:
                { type: '', construction: {}, description: '' }
            


            CONSIDER, here or client:
            - how to calculate net changes: income minus ongoing refining actions? and how to display most usefully


        */
        // !MHRmanage

        // const buildableStructs = Object.keys(allTownshipStructs).filter(structKey => allTownshipStructs[structKey].baseStats.buildLimit == null).map(structKey => {
        //     return {type: allTownshipStructs[structKey].baseStats.type, description: allTownshipStructs[structKey].baseStats.description, construction: {...allTownshipStructs[structKey].baseStats.construction}}
        // });

        calcTownIncome(township);

        let managementData = fetchManagementData(township);
        
        if (township.worldID != null) {
            managementData.mapObj = allWorlds[township.worldID];
            managementData.wps = township.wps;
        }

        thisPlayer.playStack.mode = 'township_management';

        socket.emit('township_management_data', managementData);


    });

    socket.on('update_management_data', newMgmtData => {
        const { newGatheringCoords, newRefining, newBuilding } = newMgmtData;
        // console.log(`Ho there! Backend here! We have received new gathering coords: ${newGatheringCoords}`);
        // so far, so good... now, to IMPLEMENT
        thisPlayer.township.gatheringCoords = [...newGatheringCoords];
        thisPlayer.township.refining = [...newRefining];
        thisPlayer.township.building = [...newBuilding];

        // console.log(`BEHOLD OUR NEW MANAGEMENT DATA- `, newMgmtData);

        // decided to make 'refining' just a list of refining option NAMES, so when we go to check refining status, we use the NAME to grab the option's actual data


        calcTownship(thisPlayer.township);

        const township = thisPlayer.township;
        calcTownIncome(township);

        let managementData = fetchManagementData(township);

        socket.emit('township_management_data', managementData);
    });

    socket.on('search_potential_friends', () => {
        // hm. it'd be more interesting to throw more information than JUST the name. eventually. :P
        let potentialFriendsList = Object.keys(allSouls);
        potentialFriendsList = potentialFriendsList.filter(soulName => thisPlayer.following.indexOf(soulName) == -1);

        console.log(`Sweet, here's our potential list of new friends: `, potentialFriendsList);
        socket.emit('potential_friends_list', potentialFriendsList);
    });

    socket.on('follow_soul', followObj => {
        const { soulName } = followObj;
        thisPlayer.following.push(soulName);
        socket.emit('player_update', sanitizePlayerObj(thisPlayer));
    });

    socket.on('interact_with_struct', interactionObj => {
        if (thisPlayer?.name == null) return;
        const { soulTarget, interaction } = interactionObj;
        const townshipTarget = allSouls[soulTarget].township;

        if (interaction == null) return console.log(`Got a nully interaction request, for some reason?`);
        structActions[interaction](thisPlayer, townshipTarget);


        // OLD COMMENTS to be skimmed and trimmed:

        // ok, this works... we can run with it as long as we bake in all structInteractions properly
        // note that doing stuff like 'well' just kind of breaks it because we don't handle that... so, default-default it is!
        // if (structToInteract.interactions != null) structInteractions[structToInteract.type][interaction](thisPlayer, structToInteract);

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
                        nameOrIdKey: entityRef // this is for super ease of targeting
                    },
                    factions: {
                        'zenithican': {}, // and THIS is for determining win/loss and who 'belongs' to who
                        'enemy': {}
                    },
                    parties: {}, // and finally, grouping data, although we can implement that quite a bit later for now
                    
                }

                anyone involved in the event.playersViewing should be mode: 'battle', menu: null, battle: {}
                AND they should be pushed into the participants, factions, and POSSIBLY parties

                for now, it's 1v1, so make sure that works before adding additional considerations and logistical load
                


                SUMMARY:
                [_] need to set up the player's end (INCLUDING ACTIONS THEY CAN TAKE... default Strike, Pew, Flee actions, may have to create then equip on brandNewPlayer)
                    - this is more of a global concept
                [_] mutate event thusly:
                    keep the event's prompt, type, id, and mobData
                    redefine prompt content, redefine type to battle
                    delete menuItems
                    add battleData                    
                [_] establish functionality for processing attacks (well, abilities do that)... rather, processing damage/effect objects within each entity
                    - related: maybe having separate mob classes, such as class Husk, ignoring blueprints and therefore assuming more robust type AI
                [_] fill up the battleData, make a copy for the clients, add it to the chatventure, and initialize it on the backend (make it 'live')
                [_] set up targeting logic (client-side, mob-side)
                    - upon initializing the battle, BEFORE the final io.to everyone, set a default 'target' for their playStack
                    - mobs also use playStack, likewise also with a target, to keep things consistent across agents



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
        brandNewPlayer.statSeed = {...brandNewPlayer.stats};
        brandNewPlayer.token = craftAccessToken(brandNewPlayer.name);

        brandNewPlayer.level = 1;
        brandNewPlayer.exp = 0;
        brandNewPlayer.mne = 0;
        brandNewPlayer.entityType = 'player';
        brandNewPlayer.faction = 'zenithican';

        // maaay go with the below instead, because chatventures have a LOT going on :P
        // latest: may integrate into playStack instead
        brandNewPlayer.chatventure = {
            id: null
        };

        // party members! it's soon to be a thing! party up!
        // party: {leader: true, suspended: false, slotRef: 0, comp: []}
        // so we get a circular reference error throwing ourselves right into our own party like that. makes sense. whoops!
        // brandNewPlayer.party = {leader: true, suspended: false, slotRef: 0, comp: [brandNewPlayer]};

        // HERE: we know their class, so we can apply the appropriate mods
        brandNewPlayer.currentClass = {main: brandNewPlayer.class};
        // BETTER: define and then use new RogueClass().gain(brandNewPlayer).main() etc.
        // NOTE: for posterity, we should probably NOT do this part until the allSouls for this character exists


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

        brandNewPlayer.abilityBar = [];

        let brandNewTownship = {
            nickname: `${brandNewPlayer.name}'s Township`,
            soulRef: `${brandNewPlayer.name}`,
            worldID: null,
            wps: [0,0], // also a gatheringCoord, technically!
            gatheringCoords: [],
            building: [],
            refining: [],
            refineOptions: [],
            wares: [],
            weight: 0,
            interactions: ['nexus', 'gate'],
            wealth: 100,
            inventory: {
                wood: 20, stone: 20, ore: 20, game: 20, water: 20, veg: 20,
                timber: 0, chalkstone: 0, iron: 0, copper: 0,
                hardwood: 0, granite: 0, steel: 0, silver: 0,
                leather: 10, food: 10, beer: 0
            },
            townstats: {
                woodIncome: 0, oreIncome: 0, stoneIncome: 0, gameIncome: 0, waterIncome: 0, vegIncome: 0,
                woodAmp: 1, oreAmp: 1, stoneAmp: 1, gameAmp: 1, waterAmp: 1, vegAmp: 1,
                timberAmp: 1, ironAmp: 1, copperAmp: 1, chalkstoneAmp: 1, foodAmp: 1,
                actionSlots: 0, traffic: 0, commerce: 0, storage: 0, buildCapacity: 1, upgradeCap: 2
            },
            tileIncomes: {
                'j': {woodIncome: 2, gameIncome: 1, vegIncome: 1},
                'w': {woodIncome: 2, gameIncome: 1},
                't': {woodIncome: 2, gameIncome: 1},
            
                's': {woodIncome: 1, waterIncome: 1, vegIncome: 2},
                'm': {waterIncome: 1, vegIncome: 2},
                'b': {waterIncome: 1, vegIncome: 2},
            
                'v': {woodIncome: 1, gameIncome: 1, vegIncome: 1},
                'p': {gameIncome: 1, vegIncome: 1},
                'u': {gameIncome: 1},
            
                'n': {oreIncome: 1},
                'd': {oreIncome: 1, stoneIncome: 1},
                'a': {oreIncome: 1},
            
                'c': {waterIncome: 2, gameIncome: 1},
                'l': {waterIncome: 2, gameIncome: 1},
                'f': {waterIncome: 1},
                'o': {gameIncome: 1},
            
                'g': {oreIncome: 1, stoneIncome: 1, vegIncome: 1},
                'h': {oreIncome: 1, stoneIncome: 1},
                'r': {oreIncome: 1, stoneIncome: 1},
                'M': {oreIncome: 2, stoneIncome: 2},
            },            
            constructionProjects: {}, // anywhere actionSlots are deployed for construction purposes!
            icon: {},
            aesthetic: {}, // for changing look of the chatroom/township visit around, ultimately
            npcs: {}, // currently unsupported
            vibe: {}, // currently wildly ignored; may come back later
            structs: {},
            townMap: {
                description: `You are in a small township governed by ${brandNewPlayer.name}. It rests in the center of a large savanna, a soothing expanse of gently rolling grasslands extending away from the town walls, the occasional majestic tree standing proudly in the distance.`,
                map: []
            },
            // population: 0, // maaay bring this back, as it turns out
            events: {},
            history: [],
            lastTick: null
        };
        brandNewPlayer.township = {...brandNewTownship};
        // REMINDER: we won't 'build' until player is in allSouls properly
        
        /*
        
        !MHRstructs (ALLSTRUCTS BRAINSTORM for the old list)
            TOWNSHIP MANAGEMENT CONCEPTS:
            - each struct and upgrade confers a 'weight'... generally upgrades are 'cheaper' than full new buildings?
                - weightCapacity can be derived or explicit... let's go with derived? player level plus other-building mods
                - ooh, structWeight and townWeight capacities separate? so first is how high things can be upgraded, second is how many things can be built
                - I like it! let's go with that
            - gathering parties available at start is 2
            
            - need variable to know where gathering parties are currently located 
            - don't forget the 'current spot' (req worldID != null)
            - need to know boosts conferred by buildings for gathering endeavors
            - need stockpile data
            - need construction data (what's being constructed, how many constructions are currently supported)

            - ideally, we decide on how materials work for equipment and scaling so we can decide how our initial tradepost (upgrades into something else?)
                - allocate to trading post 'income,' or let it happen auto-magically?
                - hm manually let them skim, and let that skim turn into products and MUNNEY for the ts
                - eh maybe it just goes based on current income? instead of doing extra math? hmmmm


            TOWNSHIP/WORLDBUILD STRUCT BRAINSTORM+
            - (external) road, which can only be built connecting from township or to another road (needs an 'anchor' adjacent tile)... now with moar TRADE
                - actually, maybe road makes it easier to transport, increasing raw income from a tile by x%
                - also does -threat while traveling
            - (external) dock - +resources, enables launching of light seacraft for shallow sea/freshwater exploration
            - (external) shipyard - ++resources, enables launching of proper boats
            - (external) mine: +minerals from hills, mountain(s), dryland
            - (external) guard tower: --threat in a radius, stacks with road; probably triggers events sometimes
                - can be specialized to boost game income... shootin' rabbits

            ! = starter struct
            -! nexus
            -! town gate
            -! (internal) tradehall - source of gathering/assigning external doots to get materials (+2 to start)
                - also serves as basic 'processing' capacity, turning ore into metal and such... slow but steady
            -! (internal) buildhall (1 slot to start, no mods)
            -! (internal) well - +2 water, upgrade for MOAR WATER; can potentially irrigate from rivers/freshwater to also add +1 water to local tiles
            -! (internal) storage (starts as stockpile, can get fancier later)
            -! (internal) inn (with built-in tavern for tavern shenanigans) ... rest up, get travelers, recruit npc parties, make some grub
            -! (internal) tradepost... starter struct that can upgrade as local shop as well as trade generator (based on wares, and later on a demand system)
                - first shop, assumed level 10 competency at crafting starter-tier gear      
            -! (internal) class trainer structs: sanctuary, tower, den, arena/gymnasium
            -! (internal) pit - +1 mineral, + 1 stone by default... can specialize into town mine/dungeon, but beware going too deep!
            ... I think we landed on each struct having its own class, accepting a new ClassStructGuy(initvalueobject) OR adding .newSoul(soul) init type
            homeTileBoost: {wood, mineral}, homeTileAmp: {...}
            township also needs to 'know' its own stats, so... township stats! or townstats!
            homeboosts/amps are special in that they're tile agnostic, yet specific tile masteries ALSO apply... spec up for great results!
            ... and then maybe some rarity chasers
            ... ooh and a struct to chase rares at the expense of the commons
            DON'T FORGET THE DRAGONS, MAN
            still, now that we've settled it, we can get it going
            ... upon townvisit, it'll do a quickie calculation, rather than automatically bothering our poor little server automatically
                - ideally we'd let the client handle this, but we'd have to safeguard against tampering by locking the process with a backend token of some sort?
                - ooh, that's a neat idea, we'll try that
            ... and then we can go to Zenithica and unload our extra supplies for rares, special currencies, etc.
            ... woo!
            ... world level helps guide 'drop rates' on materials, which is divided into tiles
                - OH OR SUPERTILES... black iron suddenly becomes possible in 'deep desert'? I like it!
            ... anyway, how should we 'roll' for common, uncommon, rare, etc.? 
                - world level is definitely a core part of it, bumping rates up (sometimes from effectively zero)
                - essentially we need to make a list of white/green/blue/purple/orange stuff? :P
                - or maybe less staggered, just spectrum of... hm, actually, I like different pools
                - so common, uncommon, rare for now... leave the hyper-rares for the future UFO commander
            Refactoring! Going even MORE abstract - all construction/township-level materials are abstracted away from their RL counterparts
                - specific materials CAN be found and stored, as rare rolls or during specific adventuring
                - OR, this represents 'raw material' gathered, and during special refining can give us specific types of material?
            COMMONS: 
                - softwood, hardwood
                - shinemetal, mattemetal
                - glittershard, palecryst
                - bitterleaf, greenroot
                - chalkstone, grayrock
                - pelt, hide
            UNCOMMONS:
                - burlwood, heartwood
                - 
                - runeshard
                - 
            RARE:
                - silverwood, ironwood


           
            - (internal) town hall - adds events, enhances trade, enables special options, increases weight potential
            - (internal) trader guild - traders go here! manage stock overflow sales? get some unique goods, amplify town income
            - (internal) specialized crafters: blacksmith, clothier, bowyer, leatherworker, artificer, etc.
            - (internal) guardhouse (reduces encounter level nearby)
            - (internal) refinement buildings: forge, lumberyard, etc. to turn raw ore/wood into ingots/lumber, animals into meat/hide/bone, etc.
            - (internal)specialization buildings: more specific resources from some selection of particular tiles
                - fisherman, hunter, miner, quarrymaster
                - jwt smb vpu nda clf ghr M

            - ok, so what's our projected 'income,' how often, and what's the build requirement projected to be (base, construction upgrades can help, plus friends)
            so a fairly bountiful tile will give 6-8 total resources an hour by default; some of the worst only give 2, but that's not a huge issue in starter areas


            - and FLUX


            WORLD GETTIN' MORE DANGEROUS
            - a later-concept, but should it happen over time? ... or with resources gathered? hm


            eh while we're ponderin'...
            GEAR!
            - I like trinkets being flat stats
            - accessories for wide usage, but generally specific action boosts or resistances
            - simple stat basis... a strength-based weapon boosts ALL listed stats by strength stat, so try to find gear that matches your build

            so players have 12 * 6 stats + 8, so can pretty readily have 2 stats at 20
                - currently set up to have stats go up by seed/10, so definitely gaining 1.2 (+6 per five levels due to flooring) minimum, 2 max from this
                - then CLASS STATS and CLASS MODS come into play
                - 0.7 average times 6 stats = 4.2 total level-up points in the class
                - fighter: 1.2str, 1.0agi, 1.0vit, 0.4wil, 0.3int, 0.3wis
                - rogue: 0.8str, 1.2agi, 0.8vit, 0.3wil, 0.8int, 0.3wis
                - sorcerer: 0.3str, 0.6agi, 0.3vit, 1.2wil, 1.0int, 0.8wis
                - sympath: 0.4str, 0.8agi, 0.4vit, 0.6wil, 0.8int, 1.2wis
            - ok, we'll do seed/20 for stats, which sets the class stats up to be more dramatic, which I'm fine with

            - where'd we end up on those weapon stats? ok, flat stats, but the equip calculation 2/3 favors the lower stat in any case
            - done and done
            - now all we have to do is figure out the rough scaling... let's sketch!
            - weapons/gear should roughly scale in a way that matches the stat growth of a projected character/mob
            - 2.2 is 'peak' scaling, ideal stats matched with ideal class (20 strength fighter, 20 agi rogue, etc.), but that'll be assumed to be pretty extreme atm
                - 20 stat base + 2 per level is "PEAK" scaling, S rank for that attribute
                - we'll say 16 stat + 1.6 total scaling is 'good', A rank
                - we'll say B is 12 + 1.2
                - C is 8 + 0.8
                - D would be 4 + 0.4
                - F... is nothin' :P
                - so by default, maybe a B (12) and C (8) stat on gear, with mods and/or mats being able to kick 'em up in rank
                NOTE: scaling is half equipment level, half guiding stat(s) of gear (so, all gear scales, but mostly off its own level, and a bit off user stats)
                ... great, sounds workable, done
                ... ooh, since it's a simple 5-point scale (base = points * 4, mod points / 2.5... or flat / 1.25 & stat / 1.25)
                    - actually, flat boost is POINT * 4; level scaling is POINT / 1.25; stat scaling is POINT / 1.25
                    - while we're planning a 3 and a 2 (B and a C), we can go up and down by partials and the math will still work fine, as math is wont to do


            MATERIALS (redux, reduxed)
            - should probably keep it relatively simple
            - basic typing and level; what kind of material (metal, etc.), level it supports, etc.
            - I can already foresee some issues with getting too specific with materials, but putting that aside for a sec...
            - families? all iron is good in one way, all copper is good in another?
            - something like iron: level 20, atk: 1, def: 1, mag: 0.8, res: 0.8, dft: 1; sword with 3 atk is 3 * 1 = 3 still, but a rod would be 3 * 0.8 = 2.4
                - iron rods, not great for magic! :P
            - one downfall I see is with only atk/def/mag/spr/dft, having every weapon doing 2 stats might stretch a bit
            - should we add hp/mp? hm maybe yes
            - but the scaling would be a bit different; +20 atk is one thing, but not convinced that scaling would work with hp/mp at all

            IN THE BEGINNING,
            - just being able to get basic materials with some rare stuff in our basic maps would be fantastic
            - and being able to build up a bit, help each other out, and go on chatventures, getting cool gear and having interesting encounters
        
        */



        // HERE: then whip through all those structs and apply the structBlueprints[structType].init(building, area) to give them their starting 'stuff' where applicable
        // ... this may be an 'old way' to do it? pending removal.
        // Object.keys(brandNewPlayer.township.structs).forEach(structID => {
        //     // NOTE: we can get away with this less specific calling of structID rather than digging up type because upon init all these ids === type
        //     structBlueprints[structID].init(brandNewPlayer.township.structs[structID], brandNewPlayer.township);
        // });

        // HERE: 'read the room' and throw some NPC's down :P

        /*
        
        So, in general, we're looking at actions having POTENCY, PRECISION, COST, SPEED
        ... mostly this is to give more purpose to equipment, such as equipping a Fire Staff of Flaming Flamey-O Hotman
        ... ok, everything is AMP value, make it easier on ourselves
        'three checks' concept? every ability gets just THREE things (or four, or five, but let's decide now) to check  
        
        
        */


        // HERE: init their 'derived' stats at base... hp, maxhp, mp, maxmp, atk, def, mag, res, etc. from core stats
        // consider any relevant abilities
        // also consider setting up a calcStats() type fxn to handle the lifting in the future (e.g. equipment changes, status effects, abilities, etc.)
        brandNewPlayer.stats.hpmax = Math.floor(30 + brandNewPlayer.stats.vitality + (brandNewPlayer.level * brandNewPlayer.stats.vitality / 10));
        brandNewPlayer.stats.mpmax = Math.floor(10 + brandNewPlayer.stats.wisdom + (brandNewPlayer.level * brandNewPlayer.stats.wisdom / 20));

        brandNewPlayer.stats.atk = Math.floor((brandNewPlayer.stats.strength + brandNewPlayer.stats.strength + brandNewPlayer.stats.agility) / 3);
        brandNewPlayer.stats.def = Math.floor((brandNewPlayer.stats.agility + brandNewPlayer.stats.agility + brandNewPlayer.stats.vitality) / 3);  
        brandNewPlayer.stats.mag = Math.floor((brandNewPlayer.stats.willpower + brandNewPlayer.stats.willpower + brandNewPlayer.stats.intelligence) / 3);  
        brandNewPlayer.stats.res = Math.floor((brandNewPlayer.stats.wisdom + brandNewPlayer.stats.intelligence + brandNewPlayer.stats.intelligence) / 3);
        brandNewPlayer.stats.dft = Math.floor((brandNewPlayer.stats.agility + brandNewPlayer.stats.intelligence) / 2);
        brandNewPlayer.stats.cha = 99;
        brandNewPlayer.stats.hp = brandNewPlayer.stats.hpmax;
        brandNewPlayer.stats.mp = brandNewPlayer.stats.mpmax; 

        brandNewPlayer.pips = 1;
        brandNewPlayer.actionQueue = [];
        brandNewPlayer.actionIndex = null;
        brandNewPlayer.actionMomentum = {};

        brandNewPlayer.id = generateRandomID(brandNewPlayer.name);

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

        brandNewPlayer.wallet = 50;
        
        // HERE: init flux? probably an object with {current: 0, max: 99, lastTick: Date()}, and some mechanism of calculating restoration (every 5 min seems fine :P)
        brandNewPlayer.flux = {current: 30, max: 30, lastTick: new Date()};



        // do we initialize different possible effects? ... think about how best to apply these for future considerations
        // anything from status ailments to breaks and buffs, rots and regens, here we are!
        brandNewPlayer.effects = {
            
        };

        // just a little catch-all variable :P
        brandNewPlayer.flags = {

        };

        brandNewPlayer.following = ['Zenithica', brandNewPlayer.name];
        brandNewPlayer.followedBy = [];
        brandNewPlayer.relationships = {};

        // -ideally-, we init all sorts of expected values/actions here so we don't have to later :P
        /*
        
            BRAINSTORM:
            battlesFought, battlesLost, battlesWon, spellsCast, abilitiesUsed,

            I'm not sure we need/want to check all these 'on the fly' for achievements...
            ... maybe have it tied to one-off player-driven events, like resting, etc. (Morrowind Model of Leveling Up :P)

            Anyway, let's put a pin in this history concept for now; not critical for core gameplay, which is the current goal
        
        */
        brandNewPlayer.history = {
            achievements: {},
            mneGained: 0,
            mneSpent: 0,
            mneMax: 0,
            fluxSpent: 0,
            mpSpent: 0,
            pipsSpent: 0,
            battlesWon: 0,
            battlesLost: 0,
            battlesFled: 0,
            spellsCast: 0,
            abilitiesUsed: 0,
            damageDealt: 0,
            damageReceived: 0,
        };

        // the power of crystalline memory stores objects, NPC's, maybe even townships in perpetuity under the right conditions
        brandNewPlayer.memories = {};

        const newPlayerToken = craftAccessToken(brandNewPlayer.name);
        //
        socket.join(brandNewPlayer.name);
        allSouls[brandNewPlayer.name] = JSON.parse(JSON.stringify(brandNewPlayer));
        
        // let newNexusID = generateRandomID('nexus');
        // let newGateID = generateRandomID('towngate');
        /*
        
        'crossroad': {
            baseStats: {
                type: 'crossroad', displayName: 'Crossroads Cabin', id: null, soulRef: null, nickname: `The Crossroads`, level: 1, hp: 2000, interactions: ['nexus'], icon: null, weight: 0,
                townstats: {traffic: 1, commerce: 1, waterIncome: 2},
                description: `A lovely place. The de facto seat of power of the township. It has a wet watery well, and is the entry and exit point for the township.`, 
                refineOptions: [
                    {name: 'Brew Beer', resource: 'water', from: {veg: 2, water: 2}, into: {beer: 2}, time: 60},
                    {name: 'Prepare Vegetables', resource: 'veg', from: {veg: 4, water: 2}, into: {food: 2}, time: 60}
                ],
                buildLimit: 1, npcSlots: null, construction: {opalite: 25, timber: 75, chalkstone: 75}
            },        
        */
        allSouls[brandNewPlayer.name].structs = {};
        // PitStruct, TradePostStruct, InnStruct, StorageStruct, BuildStruct, GatherStruct, TownGateStruct, NexusStruct, WellStruct
        // let structsToInit = [new NexusStruct(), new TownGateStruct(), new WellStruct(), new GatherStruct(), new BuildStruct(), new StorageStruct(), new InnStruct(), new TradePostStruct(), new PitStruct()];
        // let structsToInit = [new CrossroadStruct(), new TownGateStruct(), new TradehallStruct(), new SpireStruct()];
        const starterStructs = ['crossroad', 'tradehall', 'mineshaft', 'town wall'];
        //!MHRbrand
        // structsToInit.forEach(classyStruct => {
        //     // let's see if this does the trick!
        //     classyStruct.init(allSouls[brandNewPlayer.name].township);
        // });
        starterStructs.forEach(initialStructKey => {
            // console.log(`I wish to make a new struct out of this: `, allTownshipStructs[initialStructKey].baseStats);
            let newStruct = new Struct(allTownshipStructs[initialStructKey].baseStats).init(allSouls[brandNewPlayer.name].township);
        });
        // return;

        // HERE: init their class struct! ... and their tradepost stuff?


        // actually, the PARTY ref will be stale due to the parsing... so go back and 'refresh' intended object references, just in case
        // what other elements need this treatment?
        allSouls[brandNewPlayer.name].party = {leader: true, suspended: false, slotRef: 0, comp: [brandNewPlayer]};

        thisPlayer = allSouls[brandNewPlayer.name];


        // it'd be better to find some way to have a 'menu' of unused tutorial worlds sitting on a shelf ready to go
        // that'd be doable with a separate API, I suppose... just give it instructors to churn out some worlds here and there and keep them available for use
        // we could even do it upon player request, but since that's a bit slow, we'd have to figure out a good way to keep it non-blocking
        let newMap = createWorldMap({size: 'small', level: 5, continents: 1, rangeMax: true, creator: brandNewPlayer.name});
        
        let newSpawnPoint = newMap.savannaTileGPS;
        newMap.map[newSpawnPoint[0]][newSpawnPoint[1]] = 'v00T'; // not wholly safe, so we should do a substring replace in case those middle values end up being different

        // since the world is new, we don't have to worry about checking if something's 'in the way' when we plunk down here... yet
        // if we add automatically generating savanna structs, we miiight have to be more concerned?

        // OK! so allWorlds[id] should be LIVE as of now, soooo
        allWorlds[newMap.id] = newMap;

        // placeholder; eventually we'll want to provide only a useful subset of the actual township info :P
        // allWorlds[newMap.id].map[newSpawnPoint[0]][newSpawnPoint[1]].structs.township = brandNewPlayer.township;
        // allWorlds[newMap.id].townships[brandNewPlayer.name] = [newSpawnPoint[0], newSpawnPoint[1]];
        allWorlds[newMap.id].townships[`${newSpawnPoint[0]},${newSpawnPoint[1]}`] = thisPlayer.name;

        thisPlayer.township.worldID = newMap.id;
        thisPlayer.township.wps = [newSpawnPoint[0], newSpawnPoint[1]];

        calcTownship(allSouls[brandNewPlayer.name].township);

        // currently leaning towards having the playstack set up back here so we have 'positional information' about the player
        // let's try to set this up so we get relevant location data for their own baby township
        thisPlayer.playStack = {
            gps: thisPlayer.name,
            nickname: thisPlayer.township.nickname,
            wps: newSpawnPoint,
            worldID: newMap.id,
            target: null,
            chatventure: null,
            mode: '',
            doing: 'none',
            at: 'none',
            overlay: 'none',
            menu: null,
            battle: null
        };

        thisPlayer.township.lastTick = new Date();

        // we can do a little push for flavor... add a quick bit of history event-age, some messages for the creator

        // we'll need locationData here, as well
        // let locationData = {
        //     name: thisPlayer.name,
        //     nickname:thisPlayer.township.nickname,
        //     description: thisPlayer.township.townMap.description,
        //     history: thisPlayer.township.history.slice(-150),
        //     structs: thisPlayer.township.structs
        // };

        // MHRnao
        socket.emit('upon_creation', {playerData: sanitizePlayerObj(thisPlayer), token: newPlayerToken, locationData: createLocationData(thisPlayer.name), worldMap: newMap});


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
        console.log(`How lovely! Someone wants to visit `, name);
        thisPlayer.playStack.gps = name;
    
        // MAP IT UP
        // let locationData = {
        //     name: name,
        //     nickname: allSouls[name].township.nickname,
        //     description: allSouls[name].township.townMap.description,
        //     history: allSouls[name].township.history.slice(-150),
        //     structs: allSouls[name].township.structs
        // };
        // console.log(`The location data for ${name} is thus: `, locationData);
        // yup, all of the struct functions just... aren't there anymore, for some totally unknown reason?
        // console.log(`HI! ${thisPlayer.name} is attempting to visit a new township. HERE IS ALL THAT TOWNSHIP DATA: `, allSouls[thisPlayer.playStack.gps].township)
        socket.join(name);
        return socket.emit('location_update', createLocationData(name));
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
            structs: allSouls['Zenithica'].township.structs
        };
        socket.emit('location_update', createLocationData('Zenithica'));
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
                                    name: 'Zenithica',
                                    township: {
                                        soulRef: 'Zenithica',
                                        townMap: {
                                            description: `Two wide perpindicular cobblestone streets cross between tightly huddled, stern square buildings of dark mottled stone. These streets stop abruptly a few blocks in any direction, blocked by immensely tall walls that seem to hold up the very sky itself. To the north, a glance below the always-midday sun, a single crystalline spire is just visible above the wall.`,
                                        },
                                        structs: {},
                                        nickname: 'Zenithica',
                                        history: []                                        
                                    }
                                }
                            },
                            allChatventures: {},
                            allSecrets: {},
                            allWorlds: {}
                        }

             

                        // HERE: assuming that went well enough, saveGameState() so we're good to go for the future

                        // HERE: add checks to make sure everything is humming along, and then the server goes up

                        loadGame(freshGameObject);
                        return server.listen(PORT, () => console.log(`Township Chatventures is loaded and ready to play!`));
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
            // console.log(`Same-day load gameToLoad looks like this: `, gameToLoad);
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
    allWorlds = gameObject.allWorlds;
    // console.log(`Hi! Loading game object: `, gameObject);

    if (allSouls['Zenithica'].structs == null) {
        console.log(`Oh, dear. Zenithica is bare. Can't let that stand. At least have a Nexus, Z!`);
        allSouls.Zenithica.structs = {};
        // line below is what causes SUPER DOOM.
        // let newNexusID = generateRandomID('nex');
        // allSouls['Zenithica'].structs[newNexusID] = new NexusStruct().init(allSouls['Zenithica'], newNexusID);
        let shinyNewNexus = new NexusStruct().init(allSouls.Zenithica.township);
        // let shinyNewNexus = new NexusStruct();
    }

    // ooh we should add ouch and any other 'universal' functions to all our players
    Object.keys(allSouls).forEach(playerName => {
        allSouls[playerName].ouch = (attackObject) => {
            // can copy from mmob later
            this.hp -= 1;
        }
    })

    updateGame(allSouls, allChatventures, allSecrets, allWorlds);

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

function updateGame(allSouls, allChatventures, allSecrets, allWorlds) {
    // haxxy game update engine :P
    if (allSouls.Zenithica.township.nickname == null) allSouls.Zenithica.township.nickname = 'Zenithica';
}

function createLocalMap() {
    // for when townships can zippity
}

function createWorldMap(seedObject) {
    /*

        I apparently can't help myself so let's gooooo~!

        Onto creating a 'world.' Worlds cannot be created indefinitely and will 'fold in' upon themselves without a player in them after awhile.
            - well, they'll functionally cease to exist; they still exist in-lore, probably
        
        Anyway, upon creation, they're added to the allWorlds global object (currently does not exist - we'll fix that shortly)
        
        So, going in, we need a 'seed' object.
        {size: 'small', rules: [], level: 1, threatLevel: 1} ... tileAreas hrm
        NOTE: small is the only valid size for now and is the assumed default :P
        NOTE: 'starter' is the only explicit rule we'll start with, but it'll later be the basis of this idea:
            ZONE! - now WORLDTYPE!
            - first seed source, determines how many biome seeds are planted and how likely they are to proliferate
            - we're not going to worry about being scientific for these zones (macro biomes)
            - types: arid, frigid, fungal, lush, volcanic, peaceful
        

        for now, all 'oceans' act effectively as indefinite boundaries, as I haven't yet planned out any way to get across said oceans
        ... oh, hm, mounts or contexts?... ok, later, everyone can ride horses and boats. anyway:
        so ideally in a large theoretical world, we'd start with endless ocean, spawn up landmasses of a certain size, and then dot those landmasses
        - 'seed in' a certain number of forests with a certain level of aggression, and they'd 'spread' with certain logic
        - we'd have to handle collision concepts and derivative structuring
        - order of operations: big ol' sea, landmasses based on world attributes (but 'landing site' always of a certain minimum size and viability pending harsh rules)
        - for now, the 'landing site' is the center of the world and the sauce for at least one large landmass (though with infinite scrolling player doesn't need to know they're at the 'center' of the world per se)
        - array of arrays, here we go
        - generate an image to world with, a canvas upon which to paint our brave hero(es) and other noteworthy stuff
        - eh, landing site can be wherever, but STARTER landing site/township site should be on grasslands near forest... need that early wood, yo
        - even better, near forest AND hill but on grassland, great success
        - we can 'force' this outcome for now
        let's say SMALL WORLD is 100 tiles by 100 tiles (so actually NOT stupidly small... we can shrinky-dinky it if it's too much to work with, but it gives us some space to play)
        ... those are big arrays!
        so [
            [room, room, room, room, room, ...100 times total],
            [more rooms, this is y = 2]
            [here's y = 3 at index 2, so the FIRST INDEX is how far we are down from the 'top' of the world]
        ]
        so it's actually [y][x], with the topmost row being y index 0, and the left side of the world being x index 0. got it, easy enough.
        I'd like the top/bottom of the world to be more frosty, and the middle of the world to be more temperate, meaning the happy medium would be somewhere in between?
        so let's aim for y around 24 give or take 5ish and x wherever
        ... right now as I create the concept, it's somewhat moot as there are only two terrain types :P
        ... but soon as possible, more, so many more!

        what do we need to know? ... well, starting with OCEANS EVERYWHERE, which we don't yet do because oceans don't exist...
        ... we then need to "seed" in at least one large landmass, 
        "SEED PROCESS" - the thing(s) to seed, with enough data built in to determine a growth of some sort
        ... basically we just have waves of seed-and-grow until we have a finished result

        ... ok, so we'll treat OCEAN as drawable but not traversible for now
        ... we'll finish up adding basic biomes once we've tested creation of the grassland/forest concept



        All the rules for how everything works will go in this function, so as we change this fxn, nuance will grow. Fun!

        
        WILD STRUCTS! What are they? How do they work?

        BIOMES! ... quite zone-dependent, which we'll define more below
        ... NOTE: for this, 'biome' is a non-strict definition, and is more like "tileType" for the purposes of the flora, fauna, resources, and chatventures possible
        


        
        TAIGA and TUNDRA pop up in the highest latitudes on Earth, at least (60 - 90, top/bottom 'third' or so)
        0 - 30 (from middle up and down 1/3) tend to be rather tropical
        30 - 60 gives you most of your temperate options
        ... I've also seen 0 - 23 vs 66+, so this could be a world gen attribute as well... 'temperature band sizing'

        Ok, so if we upgrade record-keeping during landmass creation... we'll have more data to work with.
        Or we could just have a default seed of "%" of certain features (based on world gen quirks), rando-weight a bit, and then start planting
        - 'snake method': turn the total % into a discrete number of tiles, randomly divide into separate seeds (reduction method - roll for a chunk, then keep rolling until there's a remainder)
        - sounds good! now, let's define the %... just going off TYPE for now
        TYPES: forest, wetland, flatland, desert, freshwater, bumpy
        default weights: forest-20, wetland-10, flatland-30, desert-10, freshwater-15, bumpy-15 (weight 100 total, so right now those are %s)
            - we'll assume certain terrains tend to have higher or lower levels inherently?
            - and 'deeper parts' of zones are more dangerous
            - so when we grow a zone... actually, we need some bounding rules, some of our unbounded land shapes are pretty wild
            - it'd be hard to find a 'center' for the current continent-snakes...
            - but too much bounding and we'd get some really dull results, hmmm
            - well, we'll worry about level-seeding a bit later! little bit later. for now... LET'S GROW SOME FORESTS!

        


        We can simplify for now by defining a total range/weight of certain base elements based on world gen
        - if we upgrade the record-keeping mechanism, we'll also know what bands everything falls in for 'temperature-izing'


        ... and each can have its own weather and state, such as raining, flooded, snowing, snow-coated?

        ROLLING RESULTS FROM A PROBABILITY RANGE... fxn! define below, circle back ... effectively 0% forest in a desert, for example



        LEVEL & THREAT!
        - start with a fairly uniform threat with dips and spikes here and there, probably highest in seed spots
        - township involvement and struct placement can help lower the level/threat present proximate to township/special structs

        SIZE!




        PLAYSTACK OVERHAUL: pending

        LEVEL OVERHAUL:
        - gaining levels grants Insight, which can be spent to gain or level up classes (1 - 10)
        - achievements can also grant Insight
        - ooh, stat level-ups based on statSeed, and then the class MODIFIES this total both flatly and absolutely
        
        STATS OVERHAUL: 
        - same core stats; seed stats; statMods (effects); effectiveStats
        - still scale based off currentClass(es) and core level
        - attack, defense, magic, and spirit can scale based off equipment as before
            - 'sword tricks' type abilities that classes or general can learn
            - atk/def/mag/spr also have a 'default value' related to core stats and then scale by equipment
        - deftness also derived stat
        - charm or charisma, also?
        
        ABILITY OVERHAUL:
        - you know it or you don't! ... upgrades can be possible with class-specific ability points
        - some automatically learned, some found/bought? sure!
        - no longer 'belong' to individual classes, but we can set them up to be only available through classes exclusively (or mostly exclusively)
        
        EQUIPMENT OVERHAUL: mostly DONE!
        - got some more ideas on that... DQTish

        MATERIAL OVERHAUL: mostly DONE!
        - thinking of having 'versions' of stuff all the way up to level 99/100 (level 1 rotted pinewood; level 50 verdant copperpine)
        - dictate level and mod a bit
        - biomes seed with 'basic' spreads of expected materials based on level and then the meta generator throws in a few surprises here and there... some treats!

        COMBAT OVERHAUL:
        - turn-based combat... if we get any form of that up and running, even with dead-simple AI, we'll call it aces for our current purposes

        NPC/TOWNSHIP OVERHAUL:
        - no more generic 'population' - all npcs have a name and presence
        - most building output requires NPC presence, and upgrades lead to more possible slots
        - various ways to 'recruit' npcs... add them as we go!
        - main thing is to randomly generate a slew of 'starter' npcs and auto-slot them into some of our starting structs to bring them online before first tick
        - might do a 'zoom tick' to simulate a bunch of ticks to 'set the stage' for our area/world/township/etc.
        - mainly figuring out how management of 'core starter buildings' looks civ-wise and the same for buildings that you can get going in early play
        - being able to click an NPC and say 'come with me!' and bring them on chatventures would be great (or recruit from your tavern... or random town taverns)

        STRUCT OVERHAUL:
        - structs have buttons, boop a button to have a thing happen, each button corresponds with something doable
        - resource hub team automatically does their best?
        - towngate EXPLORE lets you pop out and wander the local world map



        

        I like "Deftness" instead of "spd." A more worthy derivative stat! derived from agility and intelligence

        SO WHAT IF I
        - made a supremely simple tileset - grass, forest, hill, and water - and sent it to myself
        - made a rendering test space in the client, using the file source to figure out how best to handle all that
        - sent down (can add a quick, login-less request boop) a worldMap, then figured out how to integrate camera/scrolling/movement (smooth or stepwise, whatever works)
        ... THEN I ...
        - rejiggered combat and stats to be deadsimple DQ-inspired with turn-based semi-active combat with turn order based on move and deftness
        - laid out a bunch of basic 'universal' abilities then just a small handful of specific class abilities to start with (so classes = mostly stat gain at first)



        BIG THINGS TO ADD/CHANGE FOR GRAPHICS UPDATE:
        - probably worldMap data globally, so each 'world' can be easily grabbed? ... living uniquely inside of player townships is a little backwards
        - allMobs and/or allNpcs (the latter would ONLY populate by 'sleeping' the township copy and copying over a 'live adventure' version)
        - let the client do a bunch more work... give it authority during exploration, at minimum, as that feels currently fairly 'safe'
        - basic stuff to 
        - tile triggers (walking over a town doesn't automatically put you inside, BUT walking over an angry muglin encampment? guards are gonna getcha)
        - if NOT stutter-stepping across the map, can ride/boat/fly?
            - that brings up an interesting question: how to handle when you're not the party leader and you're being walked around a map
            - 'easiest' way is to just leave them in the 'chat mode' while the leader walks around for 'em


        ... this sorta became a 'hrmmm for all current planning' space. Eh. That's fine.

        Newest game theory: Civ1 mixed with Dragon Quest mixed with just chattin'/global multi-model echoes

        So we have the 'current context window' up above and the 'chatty/text event window' down below
            - can minimize either, maximizing the other
            - poppin' windows such as inventory, stats, shopping, etc. probably can live in the 'current context window' and resize accordingly

        For tilemapping, maybe a 'substrate' (like edge-of-water vs flat green square), then 'topping' (forest, hills, mountains, etc.)
        - initial tilemapping images can be SUPER lazy, like just obvious squares everywhere (can go in and have stuff figure out 'edge behavior' after, or on newly gen'd maps)
        - test initial tilemapping with just basic color squares
        - canvas, AHOY



        Ok, so if we upgrade record-keeping during landmass creation... we'll have more data to work with.
        Or we could just have a default seed of "%" of certain features (based on world gen quirks), rando-weight a bit, and then start planting
        - 'snake method': turn the total % into a discrete number of tiles, randomly divide into separate seeds (reduction method - roll for a chunk, then keep rolling until there's a remainder)
        - sounds good! now, let's define the %... just going off TYPE for now
        TYPES: forest, wetland, flatland, desert, freshwater, bumpy
        default weights: forest-20, wetland-10, flatland-30, desert-10, freshwater-15, bumpy-15 (weight 100 total, so right now those are %s)



    
    */
    //
    
    /*
    
    seedObject = {
        size: stringy,
        level: number,
        continents: number,
        rangeMax: false,
        creator: soulRef
    }
    
    */

    if (seedObject?.creator == null) seedObject.creator = 'Zenithica';
    if (seedObject?.size == null) seedObject.size = 'small';
    if (seedObject?.rangeMax == null) seedObject.rangeMax = true;

    let mapSize;
    switch (seedObject.size) {
        case 'xsmall': {
            mapSize = 100;
            break;
        }
        case 'small': {
            mapSize = 200;
            break;
        }
        case 'medium': {
            mapSize = 350;
            break;
        }
        case 'large': {
            mapSize = 500;
            break;
        }
        case 'xlarge': {
            mapSize = 800;
            break;
        }
    }

    // we'll derive this programmatically/dynamically once everything's working and we want more scalability
    // can have 'presets' like specific challenges and then more granular for exploration and futzing around
    // we may want to make a separate, dedicated API for worldbuilding... it takes a sec!
    let landMassCount = seedObject?.continents || 3;
    let worldLevel = seedObject?.level || 5;
    let availableSeeds = Math.floor((mapSize * mapSize) / 5);
    availableSeeds = rando(availableSeeds / 1.3, availableSeeds * 1.3);
    let landMassGenerators = [];    
    let newWorldMap = new Array(mapSize);
    for (let i = 0; i < mapSize; i++) {
        newWorldMap[i] = new Array(mapSize);
    }
    let biomeRecords = {
        ocean: [],
        forest: [],
        flatland: []
    };

    // new char: please give us a createWorldMap({size: 'small', level: 5, continents: 1, rangeMax: true})
    
    // the world is all ocean by default
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            newWorldMap[y][x] = 'o000'; // let's try o for ocean :P
            biomeRecords.ocean.push([y,x]);
        }
    }


    // implement this later; continents running into each other isn't really problematic at this stage
    // let landMassSpawns = [];
    // landMassSpawns[0] = [rando(0,mapSize-1),rando(0,mapSize-1)];
    // if (landMassCount > 1) {
    //     for (let m = 1; i < landMassCount; i++) {
    //         let newCoords = [rando(0,mapSize-1),rando(0,mapSize-1)];
    //         do {
    //             // here: check newCoords for appropriate distance from landMassSpawns[0]'s [y,x] coords
    //             // oh. that only works for one. we need another whole-arse loop of previous coords to be truly comprehensive...
    //             let farEnough = true;
    //             let yDist = checkMinDistance(0, 0, mapSize);
    //         } while (farEnough === false);
    //     }
    // }


    for (let l = 1; l <= landMassCount; l++) {
        // -ideally-, for multiple landmass scenarios, we'd 'force adequate distance' by:
        // 1) adding a rangeMax (not in all cases)
        // 2) referencing previous landmasses to try to assure a minimum distance
        // 3) ... a third thing I had in mind and forgot a moment ago :P
        // ... and if they collide, they collide, I'm not against natural land bridges in most cases!
        // that said, we need to keep a record as we go so we can go back over those land spots and properly address 'own 

        // can adjust those based on world gen rules in here
        let newLandGPS = [0,0];
        do {
            newLandGPS = [rando(0,mapSize-1),rando(0,mapSize-1)];
        } while (false);
        let newGenerator = {
            gps: [...newLandGPS], // y, x instead of common x, y
            spawn: [...newLandGPS],
            rangeMax: null,
            numSeeds: 0,
            levelModifier: -10 + (l * 10),
            tiles: {forest: 20, wetland: 5, flatland: 20, desert: 10, bumpy: 15},
            // numZones: {forest: rando(1,3), wetland: 1, desert: rando(1,2), freshwater: rando(1,3), bumpy: rando(1,3)}, // probably gonna just nix this bit
            zones: {},
            replaceRules: {'..': true}, // might not have to worry about numZones since snakes will likely wildly crisscross anyway... hm
            seed: 'flatland',
            type: 'flatland',
            record: [], // doop de doo... object or array for this? hrmsicles...
            tileRecord: {forest: [], wood: [], jungle: [], taiga: [], wetland: [], swamp: [], marsh: [], bog: [], desert: [], arctic: [], dunescape: [], freshwater: [], cruisewater: [], lake: [], frostwater: [], bumpy: [], greenhill: [], hill: [], frostmound: [], flatland: [], savanna: [], plain: [], tundra: [], mountain: [], ocean: []},
            latitudeRecord: {},
            innerTiles: []
        }
        if (l === landMassCount) newGenerator.numSeeds = Math.floor(availableSeeds)
            else newGenerator.numSeeds = Math.floor(rando(availableSeeds / 3, availableSeeds / 1.5));
        console.log(`Landmass #${l} has claimed ${newGenerator.numSeeds} seeds!`);

        // quick maths: if a landmass has 100 seeds, it can occupy a 10x10 grid fully (boring :P)
        // but that means that we're 'covered' as long as we're allowed to go +5 in any x/y direction (11 x 11)
        // so bare minimum is seeds sqrt / 2 as the omni-directional limiter
        // should probably add at least... say... 30% to that? let's see what happens.
        if (seedObject.rangeMax) newGenerator.rangeMax = Math.floor((Math.sqrt(newGenerator.numSeeds) / 2 + 1) * 1.3);

        // randomly warping the initial 'seed weights' that the initial tiles values represent
        Object.keys(newGenerator.tiles).forEach(tileSeed => {
            // can manipulate based on world rules, but for now, just wild random rolls
            newGenerator.tiles[tileSeed] += rando(newGenerator.tiles[tileSeed],newGenerator.tiles[tileSeed] * 2);
        });

        let tileSum = Object.keys(newGenerator.tiles).map(tileKey => newGenerator.tiles[tileKey]).reduce((prev, current) => prev + current, 0);
        // console.log(`Initial tilesum: ${tileSum}`);

        // now we go ahead and try to derive actual number of tiles with some mathemagics
        Object.keys(newGenerator.tiles).forEach(tileSeed => {
            newGenerator.tiles[tileSeed] = Math.floor((newGenerator.tiles[tileSeed] / tileSum * newGenerator.numSeeds));
        });

        // console.log(`Final number of tiles for each should be here: `, newGenerator.tiles)

        // later can consider doing an extra loopty to adjust any rounding difference between actual tileSum and numSeeds, but not critical



        landMassGenerators.push(newGenerator);
    }

    let currentDirection = null;
    
    /*

        ok, the basic class TA stuff is looking pretty good, just about ready to implement... 
        
        oh, it'd be great to have an 'absolute distance finder' given map wrap-around antics
        a spot on the right edge of the map currently would read as SUPER FAR AWAY from a spot x+1 distance away based on simple mathery
        ... but if we define xRange and yRange, any xRange that's super large is necessarily probably actually really small in reality
    
    */

    // initial wild generator of 'default landmass types' not yet stratified by climate
    landMassGenerators.forEach(generator => {
        do {

            // so, this works, but very often leaves, say, flatland values high until the end, when it then has to place a TOOOON of flatland
            // so we still get very large swaths of largely featureless meh
            let currentBiome = pickOne(Object.keys(generator.tiles)); // this SHOULD helpfully just pick a key for us
            // console.log(`Up next we're going to plant ourselves a bit of ${currentBiome}, as the tile choices include `, generator.tiles)

            // check vs generator.spawn, which is initial coords
            // IF rangeMax, it's the max allowable distance from generator.spawn, so if it's OVER that, we teleport back to spawn and re-snake

            let numOfTilesToPlace;

            // hm, for larger maps, we still get MASSIVE swaths of terrain that don't work super well for Civ-style
            if (generator.tiles[currentBiome] <= 15) numOfTilesToPlace = generator.tiles[currentBiome]
                else numOfTilesToPlace = rando(5,15);
            // can add another rando before or after for 'critical roll! - weird result!' and do some wacky seed work
            // console.log(`I think I will do ${numOfTilesToPlace} tiles for ${currentBiome} this time through since we have ${generator.tiles[currentBiome]} left.`);

            do {
                // HERE: quick check to see if we're past rangeMax, and if so, correct generator.gps to be generator.spawn again




                if ((generator.rangeMax != null) && (checkMinDistance(generator.gps[0], generator.spawn[0], mapSize) > generator.rangeMax || checkMinDistance(generator.gps[1], generator.spawn[1], mapSize) > generator.rangeMax)) generator.gps = [...generator.spawn];

                if (newWorldMap[generator.gps[0]][generator.gps[1]][0] === 'o') {
                    newWorldMap[generator.gps[0]][generator.gps[1]] = currentBiome;
                    generator.tiles[currentBiome] -= 1;
                    if (generator.tiles[currentBiome] === 0) delete generator.tiles[currentBiome];
                    numOfTilesToPlace -= 1;
                    // if (generator.tiles[currentBiome])
                    generator.tileRecord[currentBiome].push([generator.gps[0],generator.gps[1]]);
                    if (generator.latitudeRecord[`${generator.gps[0]}`] == null) generator.latitudeRecord[`${generator.gps[0]}`] = [];
                    generator.latitudeRecord[`${generator.gps[0]}`].push([generator.gps[0],generator.gps[1]]);
                }
                switch (currentDirection) {
                    case 'up': {
                        generator.gps[0] -= 1;
                        if (generator.gps[0] < 0) generator.gps[0] = newWorldMap[0].length - 1;
                        currentDirection = pickOne(['up', 'right', 'left']);
                        break;
                    }
                    case 'right': {
                        generator.gps[1] += 1;
                        if (generator.gps[1] > newWorldMap[0].length - 1) generator.gps[1] = 0;
                        currentDirection = pickOne(['up', 'right', 'down']);
                        break;
                    }
                    case 'down': {
                        generator.gps[0] += 1;
                        if (generator.gps[0] > newWorldMap[0].length - 1) generator.gps[0] = 0;
                        currentDirection = pickOne(['right', 'down', 'left']);
                        break;
                    }
                    case 'left': {
                        generator.gps[1] -= 1;
                        if (generator.gps[1] < 0) generator.gps[1] = newWorldMap[0].length - 1;
                        currentDirection = pickOne(['up', 'down', 'left']);
                        break;
                    }
                    default: {
                        currentDirection = pickOne(['up', 'right', 'down', 'left']);
                        break;
                    };
                }
                // console.log(`Placed a tile! NEW GPS IS ${generator.gps}, while SPAWN is ${generator.spawn}`)
            } while (numOfTilesToPlace > 0);

        } while (Object.keys(generator.tiles).length > 0);

        // console.log(`Latitude record now looks like this... `, generator.latitudeRecord)

        // HELPFUL HERE, I hope: sort each latitude left-to-right in terms of x value


        // moved mountain generation to BEFORE freshwater generation, should help with some impassability issues
        for (let y = 0; y < newWorldMap[0].length; y++) {
            for (let x = 0; x < newWorldMap[0].length; x++) {
                if (newWorldMap[y][x] === 'bumpy') {
                    let bumpySides = 0;
                    
                    let yUp = y === 0 ? newWorldMap[0].length -1 : y - 1;
                    let yDown = y === newWorldMap[0].length - 1 ? 0 : y + 1;
                    let xRight = x === newWorldMap[0].length - 1 ? 0 : x + 1;
                    let xLeft = x === 0 ? newWorldMap[0].length -1 : x- 1;
                    if (newWorldMap[yUp][x] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yUp][x][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[yDown][x] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yDown][x][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[y][xRight] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[y][xRight][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[y][xLeft] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[y][xLeft][0] === 'o') bumpySides -= 1;

                    if (newWorldMap[yUp][xRight] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yUp][xRight][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[yUp][xLeft] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yUp][xLeft][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[yDown][xRight] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yDown][xRight][0] === 'o') bumpySides -= 1;
                    if (newWorldMap[yDown][xLeft] === 'bumpy') bumpySides += 1;
                    if (newWorldMap[yDown][xLeft][0] === 'o') bumpySides -= 1;
                    if (bumpySides >= 4) {
                        
                        newWorldMap[y][x] = 'mountain';
                        generator.tileRecord.mountain.push[[y,x]]; 
                    }
                }
            }
        }
        
        // kind of slow, actually. should:
        // 1) only go through the tiles of the landmass
        // 2) combine the 'loop-through' to do ocean AND bumpy
        // speed is key
        // oh, wait, we need to check OCEAN, not actual placed tiles. ok, welp, we can abbreviate bumpy below, but this will require more figuring to optimize
        // it definitely CAN be more optimized, though... plenty of ways to check 'ocean tiles' that fall within a certain range of our new landmass only and not the entire middle of the ocean, for example
        for (let y = 0; y < newWorldMap[0].length; y++) {
            for (let x = 0; x < newWorldMap[0].length; x++) {
                if (newWorldMap[y][x][0] === 'o') {
                    let landSides = 0;
                    // QUADRI-DIRECTIONAL CHECK
                    let yUp = y === 0 ? newWorldMap[0].length -1 : y - 1;
                    let yDown = y === newWorldMap[0].length - 1 ? 0 : y + 1;
                    let xRight = x === newWorldMap[0].length - 1 ? 0 : x + 1;
                    let xLeft = x === 0 ? newWorldMap[0].length -1 : x- 1;
                    if (newWorldMap[yUp][x][0] !== 'o') landSides += 1;
                    if (newWorldMap[yDown][x][0] !== 'o') landSides += 1;
                    if (newWorldMap[y][xRight][0] !== 'o') landSides += 1;
                    if (newWorldMap[y][xLeft][0] !== 'o') landSides += 1;

                    if (newWorldMap[yUp][xRight][0] !== 'o') landSides += 1;
                    if (newWorldMap[yUp][xLeft][0] !== 'o') landSides += 1;
                    if (newWorldMap[yDown][xRight][0] !== 'o') landSides += 1;
                    if (newWorldMap[yDown][xLeft][0] !== 'o') landSides += 1;
                    if (landSides >= 5) {
                        // oh we're almost totally surrounded by land, we're fresh water now, splash!
                        newWorldMap[y][x] = 'freshwater';
                        generator.tileRecord.freshwater.push[[y,x]]; 
                    }
                }
            }
        }

        // brute force mountain-maker :P ... actually, we could also just go through the tilerecord of BUMPY and do it a bit faster that way
        // that said, it works pretty darn well so far


        // ok! next up, using world's defined ZONES to transcribe forest: [], wetland: [], desert: [], freshwater: [], bumpy: [], flatland: [], mountain: [] into their various climate-counterparts
        // forest -> jungle, wood, taiga
        // wetland -> swamp, marsh, bog
        // flatland -> savanna, plain, tundra
        // desert -> dunescape, desert, arctic
        // freshwater -> cruisewater, lake, frostwater
        // bumpy -> greenhill, hill, frostmound
        // mountain -> mountain, for now :P
        // ocean remains ocean at this point
        // let's see... so we want 'probability bands' from top to bottom; what's the best way to accomplish that... I'd rather avoid just doing aggressive stripes across the world where you can see the 'line' of climate shave across
        // we should probably make a function or object that 'translates' for us at some point (tropical, temperate, arctic)
        // for now we can just zip through the world (well, just this landmass would be better, right now we're doing whole-world every time :P)
        // new TA().level(levelNum).biome(biomeString) for each
        let distanceFromEquator;
        let polarWeight = 0;
        let temperateWeight = 0;
        let tropicalWeight = 0;
        let biomeLevel = worldLevel + generator.levelModifier;


        // we MIGHT be hitting this issue because we go over the ENTIRE WORLD via every single landmass
        // so we're gonna have a lot of snakey overlap, which maaay be causing some issues, and definitely is slowing everything down a bit
        // 

        for (let y = 0; y < newWorldMap[0].length; y++) {
            for (let x = 0; x < newWorldMap[0].length; x++) {
                distanceFromEquator = Math.abs(Math.floor(mapSize / 2) - y);
                polarWeight = Math.floor(distanceFromEquator - (mapSize / 4)); // in size 100 map, highest is 25, dropping to 0 by 25 down
                if (polarWeight < 0) polarWeight = 0;
                tropicalWeight = (mapSize / 4) - distanceFromEquator; // in size 100 map, highest is 25, down to 0 by 25 away
                if (tropicalWeight < 0) tropicalWeight = 0;
                temperateWeight = (mapSize / 4) - polarWeight - tropicalWeight; // in the 'middles' temperate would reign in this model, it seems
                if (temperateWeight < 0) temperateWeight = 0;

                
                let biomeType = weightChoice({result: 'tropical', weight: tropicalWeight}, {result: 'temperate', weight: temperateWeight}, {result: 'polar', weight: polarWeight});
                //tileRecord: {forest: [], wood: [], jungle: [], taiga: [], wetland: [], swamp: [], marsh: [], bog: [], desert: [], arctic: [], dunescape: [], freshwater: [], cruisewater: [], lake: [], frostwater: [], bumpy: [], greenhill: [], hill: [], frostmound: [], flatland: [], savanna: [], plain: [], tundra: [], mountain: [], ocean: []},
                // console.log(`Okie dokie! Now we can seed the biome type ${biomeType} which is level ${biomeLevel}, which is ${typeof biomeLevel}`)
                switch (newWorldMap[x][y]) {
                    case 'forest': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 'j000';
                            generator.tileRecord.jungle.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'w000';
                            generator.tileRecord.wood.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 't000';
                            generator.tileRecord.taiga.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'wetland': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 's000';
                            generator.tileRecord.swamp.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'm000';
                            generator.tileRecord.marsh.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 'b000';
                            generator.tileRecord.bog.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'flatland': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 'v000';
                            generator.tileRecord.savanna.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'p000';
                            generator.tileRecord.plain.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 'u000';
                            generator.tileRecord.tundra.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'desert': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 'n000';
                            generator.tileRecord.dunescape.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'd000';
                            generator.tileRecord.desert.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 'a000';
                            generator.tileRecord.arctic.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'freshwater': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 'c000';
                            generator.tileRecord.cruisewater.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'l000';
                            generator.tileRecord.lake.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 'f000';
                            generator.tileRecord.frostwater.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'bumpy': {
                        if (biomeType === 'tropical') {
                            newWorldMap[x][y] = 'g000';
                            generator.tileRecord.greenhill.push([x,y]);
                            break;
                        }
                        if (biomeType === 'temperate') {
                            newWorldMap[x][y] = 'h000';
                            generator.tileRecord.hill.push([x,y]);
                            break;
                        }
                        if (biomeType === 'polar') {
                            newWorldMap[x][y] = 'r000';
                            generator.tileRecord.frostmound.push([x,y]);
                            break;
                        }
                        break;
                    }
                    case 'ocean': {
                        // solved for now! but we do it upon init, so until we segregate by latitude this is a blank placeholder
                        // should be 'o' next :P
                        break;
                    }
                    case 'mountain': {
                        newWorldMap[x][y] = 'M000';
                        generator.tileRecord.mountain.push([x,y]);
                        break;
                    }
                    
                    default: {
                        // huh. we're getting already-tiled areas in our loop. that shouldn't happen. :P
                        // console.log(`We hit a part of the world that isn't defined how we expect. WEIRD. This part of the world is apparently: `, newWorldMap[y][x]);
                        break;
                    }
                }
            }
        }


        /*
            MHRlakes
            NEXT UP:
            x lakey logic
            x mountain logic
            x tile gen: climate-based biome conversion & level setting
                - welp, it 'works,' buuuuuuuuuuuuuuuut east/west instead of north/south, whoopsiedoodle :P
                
            - adding mob logic to tiles (rarityWeight, encounterWeight, aggression for random encounters, etc.)
            - adding basic 'fun stuff' sprinkled either within every biome type OR indiscriminantly across any biome
                -> make sure to create the 'interesting bits' in a way that is replicable when adding more in the future
            - finally, mobfactions (can include npc stuff, though we need a 'working model' for township visiting as well to help this out)
            - ... and that should be sufficient to make a world 'alive' enough for play! WOO!
                -> we can probably remove the world's builder stuff such as tileRecord, latitudeRecord, etc.
                
            
            - (rivers/roads can wait a bit)
            - (as can sea vs ocean; I have a fair idea of how to do this, though - similar iteration as lake/mountain logic - 'shockwave' approach from land)
            - (beach/shore logic can be reverse-engineered from sea logic)
        
        */


    });



    // - when making the world, add: mapData (map), worldData (id, souls: {soulRef1: true, soulRef2: true}, creatorRef: creatorSoulRef)
    let newWorldMapObj = {
        id: generateRandomID('world'),
        townships: {}, // townships plopped down in here somewhere with their coords for quick reference
        creator: seedObject.creator,
        level: worldLevel,
        map: newWorldMap,
        savannaTileGPS: pickOne(landMassGenerators[0].tileRecord.savanna) // haxxy but efficient for now!
    }
    
    
    allWorlds[newWorldMapObj.id] = newWorldMapObj;

    return newWorldMapObj;
}
// ok, can console.table and as long as it's within a certain size we're golden... let's see what we can build!
// createWorldMap();

function checkMinDistance(index, targetIndex, length) {
    // given an array of length 'length,' what's the smallest distance between index and targetIndex?
    const distance1 = Math.abs(targetIndex - index);
    const distance2 = length - distance1;
    // console.log(`Checking a distance between ${targetIndex} and ${index}, which could either be ${distance1} or ${distance2}.`);
    // console.log(`Obviously I'll tell you that the minimum of those two is ${distance1 < distance2 ? distance1 : distance2}.`);
    if (distance1 < distance2) return distance1;
    return distance2;

}

function weightChoice(...choices) {
    // we're expecting any number of choices presented in the format 'weight: #, result: something to return'
    // oh. right. forEach does NOT stop for anyone or anything. the return is... valid but also invalid? yeesh
    let weightSum = 0;
    choices.forEach(choiceObj => weightSum += choiceObj.weight);
    let roll = rando(1, weightSum);
    // console.log(`Weighted roll! ${roll} vs ${weightSum}.`);
    for (let c = 0; c < choices.length; c++) {
        if (roll <= choices[c].weight) {
            // console.log(`Aha! We've made a choice. That choice is ${choices[c].result}.`);
            return choices[c].result;
        }
        roll -= choices[c].weight;
    }
    return console.log(`Somehow, we didn't land on ANY weight option. Logic flaw. Whoops.`);
}

/*

        known townstats: {
            woodIncome, oreIncome, stoneIncome, gameIncome, waterIncome, vegIncome,
            woodAmp, oreAmp, stoneAmp, gameAmp, waterAmp, vegAmp,
            gatherSlots, buildSlots, traffic, commerce
        }
        ... so we need to set the township "starter stats" upon init, and then loop through all the buildings and add their townstat keys (all numbers!) to our starter numbers        


        
        let brandNewTownship = {
            nickname: `${brandNewPlayer.name}'s Township`,
            soulRef: `${brandNewPlayer.name}`,
            worldID: null,
            wps: [0,0], 
            gatheringCoords: [], // decrement actionSlots by this figure
            townstats: {
                woodIncome: 0, oreIncome: 0, stoneIncome: 0, gameIncome: 0, waterIncome: 0, vegIncome: 0,
                woodAmp: 1, oreAmp: 1, stoneAmp: 1, gameAmp: 1, waterAmp: 1, vegAmp: 1, 
                actionSlots: 0, traffic: 0, commerce: 0
            },
            constructionProjects: {}, // keys.length?... hmmmm... well, pretty much DO have to be objects
            icon: {},
            aesthetic: {}, // for changing look of the chatroom/township visit around, ultimately
            npcs: {}, // currently unsupported
            vibe: {}, // currently wildly ignored; may come back later
            structs: {},
            townMap: {
                description: `You are in a small township governed by ${brandNewPlayer.name}. It rests in the center of a large savanna, a soothing expanse of gently rolling grasslands extending away from the town walls, the occasional majestic tree standing proudly in the distance.`,
                map: []
            },
            // population: 0, 
            events: {},
            history: [],
            lastTick: null
        };

*/


function finishBuilding(project, index) {
    /*
    
        THIS: fxn is called when a 'township.building' project is completed
        - so, it needs to be responsive to building AND upgrading in both township and tiles, at minimum
        - so we'll need a reference to the SOUL for building/upgrading @ township
        - we'll need the wps/worldID for same @ tiles
        ... can do a 'universal' obj in project or just the ones we'll need? eh, let's do 'ones we'll need' since we can split and check

            const newUpgradeProject = {
            workers: 1,
            progress: 0,
            goal: grease,
            lastTick: rightNow,
            projectedFinish: new Date(rightNow + (1000 * 60 * 60 * grease / 10)),
            type: 'upgrade',
            buildingAt: 'township',
            subject: targetStruct.id,
            constructionMats: {...constructionCost},
            soulRef: name
        }

        
    
    */

    switch (project.buildingAt) {
        case 'township': {
            const township = allSouls[project.soulRef].township;
            if (project.type === 'build') {
                
            }
            if (project.type === 'upgrade') {
                // the first scenario!
                let upgradingStruct = township.structs[project.subject];
                console.log(`Building is UPGRADING! Before: `, upgradingStruct);
                // NOTE: this method assumes we're defining each LEVEL in upgradeSpecs as an almost wholly standalone entity that includes all boosts from lower levels
                township.structs[project.subject] = {...upgradingStruct, ...allTownshipStructs[upgradingStruct.type].upgradeSpecs[upgradingStruct.level + 1]};
                console.log(`Now the actual township: `, township.structs[project.subject])
                return township.building[index] = null;
                // return township.building = township.building.filter(projObj => projObj.subject !== project.subject);
            }
            break;
        }
        case 'tile': {
            if (project.type === 'build') {
                
            }
            if (project.type === 'upgrade') {

            }
            break;
        }
        default: break;
    }

    // DON'T FORGET: remove the project from the soulRef's building array once we're all set, above or here, wherever makes the most sense
}

function calcTownship(townshipRef) {
    // console.log(`Township's townstats BEFORE: `, townshipRef.townstats);
    // resetti spaghetti
    const townLevel = townshipRef.structs.crossroad.level;
    townshipRef.townstats = {
        woodIncome: 0, oreIncome: 0, stoneIncome: 0, gameIncome: 0, waterIncome: 0, vegIncome: 0,
        woodAmp: 1, oreAmp: 1, stoneAmp: 1, gameAmp: 1, waterAmp: 1, vegAmp: 1,
        timberAmp: 1, ironAmp: 1, copperAmp: 1, chalkstoneAmp: 1, foodAmp: 1,
        hardwoodAmp: 1, steelAmp: 1, silverAmp: 1, marbleAmp: 1,
        actionSlots: townLevel, traffic: 0, commerce: 0, storage: 0, buildCapacity: townLevel, upgradeCap: townLevel
    };
    townshipRef.refineOptions = [];
    townshipRef.weight = 0;
    townshipRef.interactions = [];
    townshipRef.tileIncomes = {
        'j': {woodIncome: 2, gameIncome: 1, vegIncome: 1},
        'w': {woodIncome: 2, gameIncome: 1},
        't': {woodIncome: 2, gameIncome: 1},
    
        's': {woodIncome: 1, waterIncome: 1, vegIncome: 2},
        'm': {waterIncome: 1, vegIncome: 2},
        'b': {waterIncome: 1, vegIncome: 2},
    
        'v': {woodIncome: 1, gameIncome: 1, vegIncome: 1},
        'p': {gameIncome: 1, vegIncome: 1},
        'u': {gameIncome: 1},
    
        'n': {oreIncome: 1},
        'd': {oreIncome: 1, stoneIncome: 1},
        'a': {oreIncome: 1},
    
        'c': {waterIncome: 2, gameIncome: 1},
        'l': {waterIncome: 2, gameIncome: 1},
        'f': {waterIncome: 1},
        'o': {gameIncome: 1},
    
        'g': {oreIncome: 1, stoneIncome: 1, vegIncome: 1},
        'h': {oreIncome: 1, stoneIncome: 1},
        'r': {oreIncome: 1, stoneIncome: 1},
        'M': {oreIncome: 2, stoneIncome: 2},
    };

    // ADD: tileIncomes, where applicable
    Object.keys(townshipRef.structs).forEach(structKey => {
        townshipRef.weight += townshipRef.structs[structKey].weight;
        if (townshipRef.structs[structKey].townstats != null) {
            Object.keys(townshipRef.structs[structKey].townstats).forEach(townstatKey => {
                townshipRef.townstats[townstatKey] += townshipRef.structs[structKey].townstats[townstatKey];
            });
        }
        if (townshipRef.structs[structKey].refineOptions != null) {
            // might have to be wary of redundancies in the future, but we'll see!
            townshipRef.refineOptions = [...townshipRef.refineOptions, ...townshipRef.structs[structKey].refineOptions];
        }
        if (townshipRef.structs[structKey].interactions != null) {
            townshipRef.interactions = [...townshipRef.interactions, ...townshipRef.structs[structKey].interactions];
        }
    });

    if (townshipRef.worldID != null) {
        const refMap = allWorlds[townshipRef.worldID].map;
        // let homeTileIncome = calcTileIncome(refMap[townshipRef.wps[0]][townshipRef.wps[1]]);
        let homeTileIncome = townshipRef.tileIncomes[refMap[townshipRef.wps[0]][townshipRef.wps[1]][0]];
        Object.keys(homeTileIncome).forEach(incomeKey => townshipRef.townstats[incomeKey] += homeTileIncome[incomeKey]);


        if (townshipRef.gatheringCoords.length > 0) {
            townshipRef.gatheringCoords.forEach(gatherCoord => {
                // let thisTileIncome = calcTileIncome(refMap[gatherCoord[0]][gatherCoord[1]]);
                let thisTileIncome = townshipRef.tileIncomes[refMap[gatherCoord[0]][gatherCoord[1]][0]];
                Object.keys(thisTileIncome).forEach(incomeKey => townshipRef.townstats[incomeKey] += thisTileIncome[incomeKey]);
            })
        }
    }

    // console.log(`A post-init township `, townshipRef);
    // console.log(`Also, we should see that new WEIGHT starting out: ${townshipRef.weight}`);
}

function calcTownIncome(townshipRef) {
    // REFin' it up again
    // THIS: basically, not just income, but anything that's tick-centric, such as building

    const rightNow = new Date();
    const hoursElapsed = (rightNow - new Date(townshipRef.lastTick)) / 3600000;
    console.log(`Calculating income for ${townshipRef.soulRef}'s township. It's been ${hoursElapsed} hours!`);
    // if (hoursElapsed < (1 / 12)) return console.log(`Eh, it hasn't even been five minutes! Let's wait before calculating income.`);


    let woodIncome = townshipRef.townstats.woodIncome * townshipRef.townstats.woodAmp * hoursElapsed;
    let oreIncome = townshipRef.townstats.oreIncome * townshipRef.townstats.oreAmp * hoursElapsed;
    let stoneIncome = townshipRef.townstats.stoneIncome * townshipRef.townstats.stoneAmp * hoursElapsed;
    let gameIncome = townshipRef.townstats.gameIncome * townshipRef.townstats.gameAmp * hoursElapsed;
    let waterIncome = townshipRef.townstats.waterIncome * townshipRef.townstats.waterAmp * hoursElapsed;
    let vegIncome = townshipRef.townstats.vegIncome * townshipRef.townstats.vegAmp * hoursElapsed;
    const totalIncome = woodIncome + oreIncome + stoneIncome + gameIncome + waterIncome + vegIncome * hoursElapsed;
    let currentInventory = 0;
    Object.keys(townshipRef.inventory).forEach(invKey => currentInventory += townshipRef.inventory[invKey]);
    if (currentInventory + totalIncome > townshipRef.townstats.storage) {
        // uh oh, we have an issue with TOO MUCH STUFF, handle overflow somehow right about here
        // CURRENTLY: it's wildly unhandled :P
        // my premise is to 'sell off' chunks of the income totals until we're in the clear
        // ... a loop makes sense for that rather than a mere mortal IF, huh?
    }

    // all clear, add in the inventory!
    townshipRef.inventory.wood += woodIncome;
    townshipRef.inventory.ore += oreIncome;
    townshipRef.inventory.stone += stoneIncome;
    townshipRef.inventory.game += gameIncome;
    townshipRef.inventory.water += waterIncome;
    townshipRef.inventory.veg += vegIncome;

    // plan to do more with this later, but for now, commerce = straight $$ :P
    // commerce * 5 for now, and later maybe further amped by traffic
    // starting income is therefore 15/hr, so bear that in mind for costs
    //  ... though! we can also engage in some TRADE with Zenithica and others to bolster that, which would be super neat
    townshipRef.wealth += townshipRef.townstats.commerce * hoursElapsed * 5;

    if (townshipRef.refining.length > 0) {
        const minutesElapsed = Math.floor(hoursElapsed * 60);
        

        townshipRef.refining.forEach(refiningKey => {
            // changed to remove Math.floor() on times to run, so we avoid situations where checking on refining before an hour effectively resets refining progress
            const recipeObj = townshipRef.refineOptions.filter(refRecipe => refRecipe.name === refiningKey)[0];
            let maxTimesToRun = minutesElapsed / recipeObj.time;
            let timesToRun = 0;
            let costs = {};
            Object.keys(recipeObj.from).forEach(reqMat => {
                costs[reqMat] = recipeObj.from[reqMat] * maxTimesToRun;
                timesToRun = Math.floor(townshipRef.inventory[reqMat] / costs[reqMat]);
                if (timesToRun > maxTimesToRun) timesToRun = maxTimesToRun;
            });
            console.log(`Looks like we're looping through ${timesToRun} out of a initial max of ${maxTimesToRun} times while refining ${refiningKey}!`);
            // so we SHOULD have a valid timesToRun at the end of this to... redouble our efforts, so to speak
            // basically we want to go through and decrement by timesToRun * cost for each inventory item and then increment by into via the same amt
            Object.keys(recipeObj.from).forEach(reqMat => {
                townshipRef.inventory[reqMat] -= timesToRun * recipeObj.from[reqMat];
            });
            Object.keys(recipeObj.into).forEach(resMat => {
                let ampKey = `${resMat}Amp`;
                const ampAmount = townshipRef?.townstats[ampKey] || 1;
                if (townshipRef.inventory[resMat] == null) townshipRef.inventory[resMat] = 0;
                townshipRef.inventory[resMat] += timesToRun * recipeObj.into[resMat] * ampAmount;
                // console.log(`Adding ${resMat} to the user's stock! Brings us up to a total of ${townshipRef.inventory[resMat]}.`);
            });

        });
        
    }

    if (townshipRef.building.length > 0) {
        // Let's do some building and upgrading, but actually!
        /*
        
        const projObj = {
            workers: 1,
            progress: 0,
            goal: grease,
            lastTick: rightNow,
            projectedFinish: new Date(rightNow + (1000 * 60 * 60 * grease / 10)),
            type: 'upgrade',
            buildingAt: 'township',
            subject: targetStruct.id,
            constructionMats: {...constructionCost},
            soulRef: name
        }        
        
        */

        let jobsDone = 0;

        // actually, we have a rightNow in scope already in this fxn, so making a new one is a little redundant at best
        // const rightNow = new Date();
        townshipRef.building.forEach((project, index) => {
            project.progress = project.workers * hoursElapsed;
            project.lastTick = rightNow;
            if (project.progress > project.goal) {
                finishBuilding(project, index);
                jobsDone += 1;
            }
            // HM... finishBuilding actually currently changes the building array itself, which may mess with this 'outer' loopage
            // proposed solution: remove that change, instead just change the projObj to null inside the array in that fxn, and then out here do a quick null-removing filter, DONE
        });

        if (jobsDone > 0) {
            townshipRef.building = townshipRef.building.filter(buildObj => buildObj != null);
            calcTownship(townshipRef);
            let managementData = fetchManagementData(townshipRef);
            // removing the socket for now; every instance of this fxn already immediately does precisely this anyway
            // alternatively, since we would never use this fxn without sharing the data if applicable, we can scoot the socket feedback here instead
            // io.to(townshipRef.soulRef).emit('township_management_data', managementData);
        }
        

        // HERE: probably a socket message/data to let 'em know their buildings are done?
        // MESSAGE would be great, and we should add it ASAP
    
    }


    townshipRef.lastTick = rightNow;
}

function calcTileIncome(tileString) {
    // given a tilestring, return an income stats object with woodIncome, oreIncome, etc. that calcTownship can use to calc incomes
    // currently doing BLANK test cases - no struct considerations such as mine, caves, loded, wild, etc.

    switch (tileString[0]) {
        // jwt smb vpu nda clf ghr M

        // j (jungle): 2 wood, 1 game, 1 herb
        // w (wood): 2 wood, 1 game
        // t (taiga): 2 wood, 1 game
        case 'j': return {woodIncome: 2, gameIncome: 1, vegIncome: 1};
        case 'w': return {woodIncome: 2, gameIncome: 1};
        case 't': return {woodIncome: 2, gameIncome: 1};
        
        // s (swamp): 1 wood, 2 herb, 1 water
        // m (marsh): 2 herb, 1 water
        // b (bog): 2 herb, 1 water
        case 's': return {woodIncome: 1, waterIncome: 1, vegIncome: 2};
        case 'm': return {waterIncome: 1, vegIncome: 2};
        case 'b': return {waterIncome: 1, vegIncome: 2};

        // v (savanna): 1 wood, 1 game, 1 herb
        // p (plain): 1 game, 1 herb
        // u (tundra): 1 game            
        case 'v': return {woodIncome: 1, gameIncome: 1, vegIncome: 1};
        case 'p': return {gameIncome: 1, vegIncome: 1};
        case 'u': return {gameIncome: 1};

        // n (dunescape): 1 ore
        // d (desert): 1 ore, 1 stone
        // a (arctic): 1 ore            
        case 'n': return {oreIncome: 1};
        case 'd': return {oreIncome: 1, stoneIncome: 1};
        case 'a': return {oreIncome: 1};
        
        // c (cruisewater): 2 water, 1 game
        // l (lake): 2 water, 1 game
        // f (frostwater): 1 water            
        case 'c': return {waterIncome: 2, gameIncome: 1};
        case 'l': return {waterIncome: 2, gameIncome: 1};
        case 'f': return {waterIncome: 1};
        
        // g (greenhill): 1 ore, 1 stone, 1 herb
        // h (hill): 1 ore, 1 stone
        // r (frostmound): 1 ore, 1 stone
        case 'g': return {oreIncome: 1, stoneIncome: 1, vegIncome: 1};
        case 'h': return {oreIncome: 1, stoneIncome: 1};
        case 'r': return {oreIncome: 1, stoneIncome: 1};

        // M (mountain): 2 ore, 2 stone
        case 'M': return {oreIncome: 2, stoneIncome: 2};
    }
}

function createLocationData(soulName) {
    // since we make locationData SO many times in our code right now, let's function it up!
    // all we really need to make locationData is the soulName, whereupon we can derive the rest with access to global vars' info
    // let's add the mapData and management data... whiiiiich we still need to create, huh? ok, divergence! be back in a little bit...
    // ... well, that was a couple days ago. What were we up to, again? :P
    // at least we now have all our necessary stats. gonna emit back to player viewable info above before worrying about locationData (they should already have it there)
    // let locationData = {
    //     name: soul,
    //     nickname: township.nickname,
    //     description: township.townMap.description,
    //     history: township.history.slice(-150),
    //     structs: township.structs
    // };
    
    const township = allSouls[soulName].township;
    return {
        name: soulName,
        nickname: township.nickname,
        description: township.townMap.description,
        history: township.history.slice(-150),
        structs: township.structs,
        interactions: township.interactions
    }
}


// mines, towers, etc.
const allWorldStructs = {}


function fetchManagementData(township) {
    let managementData = {
        wealth: township.wealth,
        weight: township.weight,
        structs: township.structs,
        townstats: {...township.townstats},
        gatheringCoords: [...township.gatheringCoords],
        building: [...township.building],
        refining: [...township.refining],
        refineOptions: [...township.refineOptions],
        mapObj: null,
        wps: township.wps,
        inventory: township.inventory,
        buildableStructs: Object.keys(allTownshipStructs).filter(structKey => allTownshipStructs[structKey].baseStats.buildLimit == null).map(structKey => {
            return {type: allTownshipStructs[structKey].baseStats.type, displayName: allTownshipStructs[structKey].baseStats.displayName, description: allTownshipStructs[structKey].baseStats.description, construction: {...allTownshipStructs[structKey].baseStats.construction}}
        }),
        potentialStructSpecs: {},
        structUpgradeData: {}
    };
    Object.keys(township.structs).forEach(structID => {
        const structType = township.structs[structID].type;
        const structLevel = township.structs[structID].level;
        managementData.potentialStructSpecs[structID] = {...allTownshipStructs[structType].specializations};
        managementData.structUpgradeData[structID] = {...allTownshipStructs[structType].upgradeSpecs[structLevel + 1]};
    });
    return managementData;
}

/*

    MOAR BRAINSTORMS kathooooom
    TO STORM:
    [_] Level stats (seed, class) - mostly defined at this point
    [_] Equipment stats
        - both of the above are so we can reasonably scale encounters
    Regarding EQUIPMENT, rather than 'equipment level,' just a straight grade quality with perks based off that?
        - so 0-5 on each derived stat, guidingStat or whatever we're calling it for main stat
        - base value may be removed; 100% scaling based on guidingStat, so level/stat is main aspect
        - simple equipment with a B/C (3/2) spread, plenty of room for improvement

    [_] Responsiveness - currently canvas maps are very... not great if screen is smaller than 550px
    

*/