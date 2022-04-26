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

and further mod by tier, just 'cuz :P

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
            // !MHRnao -- amping equipment stats by boostRate
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
        this.description = ``;
        this.seedLevel = 1;
        this.activeLevel = 1;
        this.threatLevel = 1; // how aggressive the inner mobs are?
        this.extroversion = 0; // thinking of a variable as for 'how often this tile attempts to do something to surrounding or nearby tiles'
        this.resources = {
            metal: {quantity: 0, quality: 0, discovered: 0},
            stone: {quantity: 0, quality: 0, discovered: 0},
            gems: {quantity: 0, quality: 0, discovered: 0},
            wood: {quantity: 0, quality: 0, discovered: 0},
            water: {quantity: 0, quality: 0, discovered: 0},
            herbs: {quantity: 0, quality: 0, discovered: 0},
            game: {quantity: 0, quality: 1, discovered: 0},
        },
        this.access = 0; // how easy it is to get into the goodies of the area?
        this.structs = {};
        this.pointsOfInterest = {};
        this.mobTypes = [];
    }

    level(level) {
        this.seedLevel = level;
        this.activeLevel = level;
        return this;
    }

    biome(biome) {
        /*
        
            Real quick... what do we want to mean by quantity and quality?
            QUALITY = LEVEL OF MATERIAL, that's 'easy'
            Quantity is how much amount can be harvested per harvest action per tick, modified upward somehow by discovered #
            ... chance that at 0 discovered, quantity of 1 is basically a fool's errand

            ... can derive special biome-only materials from this data, or make it explicit, or both
        
        */
        this.biome = biome;
        // we'll start with the 'starter stuff'
        const lowQuantity = rando(1,3);
        const lowQuality = Math.floor(this.seedLevel / rando(3.5,5));
        const midQuantity = rando(3,5) + Math.floor(Math.sqrt(this.seedLevel));
        const midQuality = Math.floor(this.seedLevel / rando(1.5,3));
        const highQuantity = rando(5,7) + Math.floor(Math.sqrt(this.seedLevel));
        const highQuality = Math.floor(this.seedLevel / rando(0.8,1.2));
        
        switch (biome) {
            case 'grassland': {
                // can change the description a bit based on level... eventually :P
                this.description = `A lush grassland extends as far as the eye can see, dotted with shading trees, mighty bushes, and abundant life.`;
                this.resources = {
                    metal: {quantity: lowQuantity, quality: lowQuality, discovered: 0},
                    stone: {quantity: lowQuantity, quality: lowQuality, discovered: 0},
                    gems: {quantity: lowQuantity, quality: lowQuality, discovered: 0},
                    wood: {quantity: midQuantity, quality: midQuality, discovered: 0},
                    water: {quantity: midQuantity, quality: midQuality, discovered: 0},
                    herbs: {quantity: midQuantity, quality: midQuality, discovered: 0},
                    game: {quantity: highQuantity, quality: midQuality, discovered: 0},              
                };
                /*
                
                    MOB THINKIN TIME
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


                
                */
                this.mobs = [];
            }
            case 'plains': {}
            case 'forest': {
                this.description = `A verdant and relatively peaceful forest with wide, easily-traversed pathways between the many tall trees.`;
                this.resources = {
                    metal: {quantity: lowQuantity, quality: midQuality, discovered: 0},
                    stone: {quantity: midQuantity, quality: lowQuality, discovered: 0},
                    gems: {quantity: lowQuantity, quality: midQuality, discovered: 0},
                    wood: {quantity: highQuantity, quality: highQuality, discovered: 0},
                    water: {quantity: midQuantity, quality: midQuality, discovered: 0},
                    herbs: {quantity: highQuantity, quality: highQuality, discovered: 0},
                    game: {quantity: midQuantity, quality: highQuality, discovered: 0},
                };
                this.mobs = [];
            }
            case 'jungle': {}
            case 'swamp': {}
            case 'hills': {
                // doop2
            }
            case 'mountains': {
                // doop3
            }
            case 'tundra': {}
            case 'arctic': {}
            case 'river': {
                // doop also? perhaps
            }
            case 'ocean': {}
            default: break;
        }
        return this;
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
        console.log(`A new mob has spawned! Looks like this: `, this);

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

BRAINSTORM:
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
- townwall
- towngate (more than one is possible!)
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
                    
                    
                    console.log(`A NEW CHATVENTURE LOOKS LIKE THIS: `, newChatventure);

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

class NexusStruct {
    constructor() {
        this.type = 'nexus';
        this.soulRef = null;
        this.nickname = `The Nexus Crystals`;
        this.description = `A blossom of milky blue-white crystal, standing twice the height of a tall man, that acts as the heart of the township.`,
        this.level = 1;
        this.hp = 3000;
        this.interactions = {nexus: 'nexus'};
        this.icon = {type: 'x'};
        this.mapImage = null;
        this.dimensions = {x: 1, y: 1, z: 1};
        this.mapSpot = null;
        this.weight = 0;
        this.buildLimit = 1;
        this.operation = {min: 0, current: 0, cap: 0, slots: 0};
        this.npcSlots = null;
        this.population = 0;
        this.construction = {main: {opalite: 1000}};
        this.inventory = null;
    }

    init(soul) {
        this.soulRef = soul.name;
        this.nickname = `${soul.township.nickname}'s Nexus`;
        return this;
    }

    place(coords) {
        // this.mapSpot = cross-ref as to where this building lives in the map zone
        // then should peek at allSouls[this.soulRef].township.map, as well
        // this is a for-later concept at this stage
        return this;
    }

    upgradeCheck(targetLevel) {
        // this: just return the info on what is needed to upgrade to level X
        if (targetLevel == null) targetLevel = this.level + 1;
        switch (targetLevel) {
            case 2: {
                break;
            }
            case 3: {
                break;
            }
            case 4: {
                break;
            }
            case 5: {
                break;
            }
            case 6: {
                console.log(`Currently IMPOSHIBIBBLE`);
                break;
            }
            default: break;
        }
        // return this; // eh maybe not a chainable method; just return TRUE or FALSE, 
    }

    upgrade() {
        // this: do a final check we have the requirements met, and if so, begin construction!
        // reqs to check: stockpile inventory, weight capacity
    }

    sidegradeList() {}

    sidegrade() {}

    /*
    
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
    
    */
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
            if (allSouls[decodedPlayerName] == null) return console.log(`That player doesn't exist at this time, for some reason.`);
            thisPlayer = allSouls[decodedPlayerName]; // NOTE: it's possible to have an 'old token' with nothing to match it to in some loading scenarios
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

    socket.on('request_a_map', request => {
        // !MHRmap
        let newMap = createWorldMap();
        let newSpawnPoint = [0,0];
        
        do {
            newSpawnPoint = [rando(0, newMap[0].length - 1), rando(0, newMap[0].length - 1)];
            console.log(`I do loop! Newspawnpoint is `, newSpawnPoint)
            console.log(`Looks like the square we're on is of the type ${newMap[newSpawnPoint[0]][newSpawnPoint[1]]}`)
        } while (newMap[newSpawnPoint[0]][newSpawnPoint[1]] === 'ocean');
        console.log(`Picked a delightful new spawn point for you! It is `, newSpawnPoint);
        socket.emit('new_play_map', {mapData: newMap, spawnPoint: newSpawnPoint});
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
        brandNewPlayer.entityType = 'player';
        brandNewPlayer.faction = 'zenithican';

        // maaay go with the below instead, because chatventures have a LOT going on :P
        // latest: may integrate into playStack instead
        brandNewPlayer.chatventure = {
            id: null
        };

        // party members! it's soon to be a thing! party up!
        // party: {leader: true, suspended: false, slotRef: 0, comp: []}
        brandNewPlayer.party = {leader: true, suspended: false, slotRef: 0, comp: [brandNewPlayer]};

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
                description: `You are in a small township governed by ${brandNewPlayer.name}. It is currently rather bare.`,
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
            localMap: {
                // refactoring to localMap for text-based version; will use worldMap data instead for graphical version 
                // nexus level can open up more 'explorable slots'
                // this is just the 'initial zone' data that the player can wiff around with
                // can incept the concepts that will later move on into the g-ver
                // ... probably should have these become their own class TileArea, so we can set that up shortly here
                // !MHRlocalMap
                areas: {
                    grasslands: {
                        biome: 'plains', // basis for how this area 'responds' to different attempts to alter it, such as irrigation, mining, etc.
                        description: ``,
                        seedThreatLevel: 1, // the 'average' or expected threat level seed; kept around so that even in highly controlled scenarios, can still 'farm' at-level encounters
                        activeThreatLevel: 1, // modded through activity, structs, etc.
                        resources: {
                            metal: {quantity: 1, quality: 1, accessibility: 100}, // to help roll for 'whatchu get' per pulse; can focus on 'higher quality' for a quantity hit
                            gems: {quantity: 1, quality: 1, accessibility: 100},
                            wood: {quantity: 1, quality: 1, accessibility: 100},
                            game: {quantity: 2, quality: 1, accessibility: 100},
                            herbs: {quantity: 2, quality: 1, accessibility: 100},
                            water: {quantity: 1, quality: 1, accessibility: 100},
                            stone: {quantity: 1, quality: 1, accessibility: 100},
                        },
                        access: 50, // may rename, but how 'within reach' this area is to the township for resource gathering purposes, scale of 0 - 100?
                        structs: {
                            // capacity to build up structs in these localMap zones based on various township qualities
                            // some abandoned or natural structs can generate sometimes
                            // can cheerfully include meta-structs such as other townships (in the future) or encampments
                        },
                        pointsOfInterest: {
                            // loose term for now, but denoting special places that can be explored/interacted with/chatventured around
                        },
                        mobTypes: {
                            // mobTypes can, depending on various factors, have mods to their level range, and possibly special extra flags/weights added to them
                            // if no mobTypes are specified, HUSKS IT IS, with wildcard chance to encounter something truly random and bizarre
                            // group likelihood behavior can be defined here as well
                            // 'biome-type' mobs possible, such as wildland muglins, forest trolls, etc.
                        }
                    },
                    hills: {
                        biome: 'hills',
                        description: ``,                        
                        seedThreatLevel: 5,                     
                        activeThreatLevel: 5,
                    },
                    forest: {
                        biome: 'forest',
                        description: ``,                        
                        seedThreatLevel: 10,
                        activeThreatLevel: 10,
                    },
                    mountain: {
                        biome: 'mountain',
                        description: ``,                        
                        seedThreatLevel: 25,
                        activeThreatLevel: 25,
                    }
                }
                // map: []
            },
            population: 0,
            events: {},
            history: [],
            lastTick: null
        };
        brandNewPlayer.township = {...brandNewTownship};
        // HERE: use most current struct-placing model to place starting structs
        // latest: probably going to go with struct-specific classes instead of blueprints-based base Struct class
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
        brandNewPlayer.stats.hpmax = Math.floor(30 + brandNewPlayer.stats.vitality + (brandNewPlayer.level * brandNewPlayer.stats.vitality / 10));
        brandNewPlayer.stats.mpmax = Math.floor(30 + brandNewPlayer.stats.wisdom + (brandNewPlayer.level * brandNewPlayer.stats.wisdom / 10));

        brandNewPlayer.stats.atk = Math.floor((brandNewPlayer.stats.strength + brandNewPlayer.stats.agility) / 2);
        brandNewPlayer.stats.def = Math.floor((brandNewPlayer.stats.agility + brandNewPlayer.stats.vitality) / 2);  
        brandNewPlayer.stats.mag = Math.floor((brandNewPlayer.stats.willpower + brandNewPlayer.stats.intelligence) / 2);  
        brandNewPlayer.stats.spr = Math.floor((brandNewPlayer.stats.wisdom + brandNewPlayer.stats.intelligence) / 2);
        brandNewPlayer.stats.dft = Math.floor((brandNewPlayer.stats.agility + brandNewPlayer.stats.intelligence) / 2);
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
        brandNewPlayer.flags = {

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
            expGained: 0,
            mpSpent: 0,
            pipsSpent: 0,
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

        // actually, the PARTY ref will be stale due to the parsing... so go back and 'refresh' intended object references, just in case
        // what other elements need this treatment?
        allSouls[brandNewPlayer.name].party = {leader: true, suspended: false, slotRef: 0, comp: [brandNewPlayer]};

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

    // ooh we should add ouch and any other 'universal' functions to all our players
    Object.keys(allSouls).forEach(playerName => {
        allSouls[playerName].ouch = (attackObject) => {
            // can copy from mmob later
            this.hp -= 1;
        }
    })

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
        FORESTS
            - forest (temperate)
            - jungle (tropical rainforest, essentially)
            - taiga (boreal/northern/cold forest)
        WETLANDS
            - swamp (forest wetlands, slow moving waters with woody plants such as cypress and mangrove)
            - bog (mostly dead stuff, generally higher up)
            - marsh (same water as swamp but softer, non-woody)
        FLATLANDS
            - savanna (tree-studded/'tropical' grasslands, thanks to just enough seasonal rainfall -- actually many types, and tend to occur between forest and 'true' grassland?)
            - plain (or prairie; short to tall grasses, flowers, and herbs, but no trees due to not quite enough rainfall, just a tad too dry)
            - tundra (flat, cold, permafrost under the soil makes trees a no-go, grass and moss grow during short summer, birdless in winter, li'l burrowing game present)
        DESERTS
            - arctic (tons of water... locked in ice, so plants and animals ain't getting any)
            - desert
        MARINE
            - ocean
            - what else... bay, shoal, coast, ?
        FRESHWATER
            - lake (note: particularly small/shallow lakes are ponds, but for now we don't need to bother with this distinction)
            - stream (crossable on foot - more of an 'overlay' for our tile purposes)
            - river (not crossable on foot by default)
        BUMPY (not actually a biome type IRL :P)
            - hill
            - mountain (REAL high hills :P... we won't make them impassable for now due to limitations in our seed gen... generally in the middle of lots of hills)

        
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
    
    let mapSize = 200;
    let newWorldMap = new Array(mapSize);
    for (let i = 0; i < mapSize; i++) {
        newWorldMap[i] = new Array(mapSize);
    }
    let biomeRecords = {
        ocean: [],
        forest: [],
        flatland: []
    };

    
    // the world is all ocean by default
    for (let y = 0; y < mapSize; y++) {
        for (let x = 0; x < mapSize; x++) {
            newWorldMap[y][x] = 'ocean'; 
            biomeRecords.ocean.push([y,x]); 
        }
    }

    // lol yup it works just a cute little 900 item array no big deal, "... 800 more items" indeed
    // console.log(`Our oceans have been filled! Behold our record of the ocean: `, biomeRecords.ocean);
    // let allGenerators = [
    //     {
    //         gps: [14,14],
    //         rangeMax: null,
    //         numSeeds: 250,
    //         replaceRules: {'..': true},
    //         seed: '[]',
    //         type: 'flatland', // we'll have this be the default; we can math out the 'chunk' of 'not-flatland' easily enough
    //         record: {} // object with each 'key' being a latitude strip - add in record-keeping during initial land generation
    //     }
    // ]

    /*
    
        OK! The newest challenge: how to create a new gps origin for forests
        ... and randomize the gps for grassland above, too
        ... and also allow for the possibility of multiple separate generators... say, 3 separate landmasses
        ... we could move some of this logic into functions, and then loop around until we've exhausted some master list of 'stuff to generate'

        that would help, but first...  hmm...
        for each landmass, we want to
        1) let it decide where to put itself
        2) snake itself into a shape
        3) go through all its decoration phase to convert its mass into separate biomes, including recognizing pre-existing lakes
        ... maybe dividing itself into 'zones,' ooh, based on where it is in the world's axis (the world itself having climes???)
        ... this is entirely too much fun :P


        MHRlandmind
        we draw the land (flatland), find the innerTiles, then we splash in several water sources thoughtfully across the innerTiles, removing them from other records...
        ... recording new freshwater data as we do, in some fashion...
        ... then we presume those areas are 'wetter' and preferentially throw some bounded forest-snakes near these water sources to deplete our 'forest count'
        ... wetlands, such as swamps, are 'transition areas' and would be found near big rivers... may pop 'em out for now, pending better seeding logic
    
    */

    // we'll derive this programmatically/dynamically later
    // ... actually, we get some REALLY cool shapes when we let several large unbound snakes rampage across each other
    // we may want to make a separate, dedicated API for worldbuilding... it takes a sec!
    let landMassCount = 3;
    let availableSeeds = Math.floor((mapSize * mapSize) / 5);
    availableSeeds = rando(availableSeeds / 1.3, availableSeeds * 1.3)
    let landMassGenerators = [];

    // whoa, neat. at scale, it looks a LOT more interesting!
    // however, when we have multiple landmasses, without bounding they kind of just idly slam into and across each other
    // while visually awesome, it does mean that we can't guarantee any segregation :P
    // we're also still suffering from the 'all the hills are in one area, all the forests are in another' effects
    // freshwater is still kind of a mess, too... if we make them untraversible we hit issues, but then we have no proper lakes/non-ocean water bodies otherwise
    // though, if we limit freshwater (and maybe hilly areas?) to 'innerTiles' we might see less wacky behavior?

    for (let l = 1; l <= landMassCount; l++) {
        // -ideally-, for multiple landmass scenarios, we'd 'force adequate distance' by:
        // 1) adding a rangeMax (not in all cases)
        // 2) referencing previous landmasses to try to assure a minimum distance
        // 3) ... a third thing I had in mind and forgot a moment ago :P
        // ... and if they collide, they collide, I'm not against natural land bridges in most cases!
        // that said, we need to keep a record as we go so we can go back over those land spots and properly address 'own 

        // forest-20, wetland-10, flatland-30, desert-10, freshwater-15, bumpy-15
        // can adjust those based on world gen rules in here
        let newLandGPS = [0,0];
        do {
            newLandGPS = [rando(0,mapSize-1),rando(0,mapSize-1)];
        } while (false);
        let newGenerator = {
            gps: newLandGPS,
            spawn: newLandGPS,
            rangeMax: null,
            numSeeds: 0,
            // NOTE: it works, but I'm not sure the ratios are ideal, and same issue with imprecise gen...
            // but we could work around it, potentially, hrm
            tiles: {forest: 20, wetland: 5, flatland: 30, desert: 10, freshwater: 10, bumpy: 15},
            numZones: {forest: rando(1,3), wetland: 1, desert: rando(1,2), freshwater: rando(1,3), bumpy: rando(1,3)},
            zones: {},
            replaceRules: {'..': true}, // might not have to worry about numZones since snakes will likely wildly crisscross anyway... hm
            // so we can let wild criss-crossing 'accidentally' create separate areas visually, but that doesn't help us zone, so... nevermind I guess :P
            // then we definitely do need to be a little cautious about letting the snakes run too amok
            // ooh, for rangeMax, what if we 'return to center' and restart? that'd create tighter patterns than bonking against invisible walls
            seed: 'flatland',
            type: 'flatland',
            record: [], // doop de doo... object or array for this? hrmsicles...
            tileRecord: {forest: [], wetland: [], desert: [], freshwater: [], bumpy: []},
            innerTiles: []
        }
        if (l === landMassCount) newGenerator.numSeeds = availableSeeds
            else newGenerator.numSeeds = Math.floor(rando(availableSeeds / 5, availableSeeds / 2));
        console.log(`Landmass #${l} has claimed ${newGenerator.numSeeds} seeds!`);


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
    

    // initial 'flatland' generator on the ocean for a given generator
    landMassGenerators.forEach(generator => {
        do {
            // if the spot we're currently on isn't the seed string, turn it into the seed string and decrement seeds by 1
            // this later would better be generalized by referencing replaceRules
            if (newWorldMap[generator.gps[0]][generator.gps[1]] !== generator.seed) {
                newWorldMap[generator.gps[0]][generator.gps[1]] = generator.seed;
                // biomeRecords[generator.type].push([generator.gps[0], generator.gps[1]]);
                generator.record.push([generator.gps[0], generator.gps[1]]);
                generator.numSeeds -= 1;
            }
            
            
            // technically the IF statements below only check Y length and not X, so this would potentially break if we did NOT specify a perfectly square world
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
                    // ah, we're on the first loop through, hopefully, sooooo:
                    currentDirection = pickOne(['up', 'right', 'down', 'left']);
                    break;
                };
            }
    
        } while (generator.numSeeds > 0);

        // RESULT: everything below 'works' well enough in terms of snaking around and putting the proper number of everything down!
        /*
        
        
        */

        currentDirection = null;

        // for visualization purposes only at this stage; definitely refactor material once we have a client-side visualization tool
        const tileRef = {
            forest: 'forest',
            wetland: 'wetland',
            desert: 'desert',
            freshwater: 'freshwater',
            bumpy: 'bumpy'
        }

        // so we're definitely going to have to create an innerLandFinder fxn and pick from there
        // innerLand: any flatland space at this step that has more flatland n, e, s, and w of it
        // at this point, also, we have an array record of all our land spots, so can just shoot through real quick and make an innerTiles array
        generator.record.forEach(flatlandTile => {
            // tile should be a handy [y,x] [0][1]:
            let x = flatlandTile[1];
            let xRight = flatlandTile[1] + 1;
            if (xRight >= mapSize) xRight = 0;
            let xLeft = flatlandTile[1] - 1;
            if (xLeft <= -1) xLeft = mapSize - 1;

            let y = flatlandTile[0];
            let yUp = flatlandTile[0] - 1;
            if (yUp <= -1) yUp = mapSize - 1;
            let yDown = flatlandTile[0] + 1;
            if (yDown >= mapSize) yDown = 0;

            if (newWorldMap[y][xRight] === '[]' && newWorldMap[y][xLeft] === '[]' && newWorldMap[yUp][x] === '[]' && newWorldMap[yDown][x] === '[]') generator.innerTiles.push(flatlandTile);
        });

        // ... actually all of this is moot-ish if we have most rivers be streams and have separate river/lake logic :P
        // we have to decide if we want hills to be their own biome type OR a modifier to others
        // it makes the most sense if hills can exist as a modifier/subtyping of other biomes, akshully... hrm

        // along those lines, maybe having a 'height' attribute and having 'hilliness' or 'bumpiness' create a different tile if it's of certain... bumpitude
        // also, painting in layers makes sense...
        // which is to say, deciding on some attributes that are a substitution for weather or precursor to weather
        // then we get lakes that can form in the 'wetter' squares by a certain chance, recording as they do and 'forcing' if falling below threshold
        // the drier squares then have a chance at becoming desert, possibly also forcing to a threshold
        // high lake squares then have water run down 

        /*
        
            IF we do wet/dry and hot/cold, we can do a layered approach... first x, then y, then z, etc.

            Well, what's the goal? Visually interesting, with 'blocks' and regions of various different biomes
            - currently, we have a fairly high chance of getting a SINGLE block of a given biome
            - we can use rando and for-loops instead of do-while to do some choppin'?
        
        */

        // or we can just simulate all of the above, rejiggering biome concepts to just make something that's workable for play for now

        
        Object.keys(generator.tiles).forEach(biomeType => {
            // console.log(`Now tackling ${biomeType} biome!`);

            // hm, how would we encourage multiple seeds? single-seeding isn't quiiiite cutting it
            let newGPS;

            // scooting this down into the DO loop below after that first break causes a LOT more terrain variety, at the cost of sanity
            if (biomeType === 'freshwater' && biomeType === 'bumpy') newGPS = pickOne(generator.innerTiles)
            else newGPS = pickOne(generator.record);

            do {
                if (biomeType === 'flatland') break;

 

                // still FAR too choppy... oh, yeah, it fires like a quadrillion times for some reason, huh.
                
                let numOfTilesToPlace = Math.floor(rando(generator.tiles[biomeType] / 5, generator.tiles[biomeType]));
                console.log(`I think I will do ${numOfTilesToPlace} tiles for ${biomeType} this time through since we have ${generator.tiles[biomeType]} left.`);
                // for (let i = 0; i <= numOfTilesToLoop; i++) {
                //     if (newWorldMap[newGPS[0]][newGPS[1]] === 'flatland') {
                //         newWorldMap[newGPS[0]][newGPS[1]] = tileRef[biomeType];
                //         generator.tiles[biomeType] -= 1;
                //         // if (generator.tiles[biomeType])
                //         generator.tileRecord[biomeType].push([newGPS[0],newGPS[1]]);
                //     }
                // }
                do {
                    if (newWorldMap[newGPS[0]][newGPS[1]] === 'flatland') {
                        newWorldMap[newGPS[0]][newGPS[1]] = tileRef[biomeType];
                        generator.tiles[biomeType] -= 1;
                        numOfTilesToPlace -= 1;
                        // if (generator.tiles[biomeType])
                        generator.tileRecord[biomeType].push([newGPS[0],newGPS[1]]);
                    }
                    switch (currentDirection) {
                        case 'up': {
                            newGPS[0] -= 1;
                            if (newGPS[0] < 0) newGPS[0] = newWorldMap[0].length - 1;
                            currentDirection = pickOne(['up', 'right', 'left']);
                            break;
                        }
                        case 'right': {
                            newGPS[1] += 1;
                            if (newGPS[1] > newWorldMap[0].length - 1) newGPS[1] = 0;
                            currentDirection = pickOne(['up', 'right', 'down']);
                            break;
                        }
                        case 'down': {
                            newGPS[0] += 1;
                            if (newGPS[0] > newWorldMap[0].length - 1) newGPS[0] = 0;
                            currentDirection = pickOne(['right', 'down', 'left']);
                            break;
                        }
                        case 'left': {
                            newGPS[1] -= 1;
                            if (newGPS[1] < 0) newGPS[1] = newWorldMap[0].length - 1;
                            currentDirection = pickOne(['up', 'down', 'left']);
                            break;
                        }
                        default: {
                            currentDirection = pickOne(['up', 'right', 'down', 'left']);
                            break;
                        };
                    }
                } while (numOfTilesToPlace > 0);


                console.log(`Neato. After planting all of those, we only have ${generator.tiles[biomeType]} tiles left.`);


                
                
                // technically the IF statements below only check Y length and not X, so this would potentially break if we did NOT specify a perfectly square world


            } while (generator.tiles[biomeType] > 0);

            // do {
            //     if (biomeType === 'flatland') break;

            //     if (newWorldMap[newGPS[0]][newGPS[1]] === 'flatland') {
            //         newWorldMap[newGPS[0]][newGPS[1]] = tileRef[biomeType];
            //         // biomeRecords[generator.type].push([generator.gps[0], generator.gps[1]]);
            //         // generator.record.push([generator.gps[0], generator.gps[1]]);
            //         generator.tiles[biomeType] -= 1;
            //         // after subtracting, we should prooooobably add a zone-y record somewhere
            //     }
                
                
            //     // technically the IF statements below only check Y length and not X, so this would potentially break if we did NOT specify a perfectly square world
            //     switch (currentDirection) {
            //         case 'up': {
            //             newGPS[0] -= 1;
            //             if (newGPS[0] < 0) newGPS[0] = newWorldMap[0].length - 1;
            //             currentDirection = pickOne(['up', 'right', 'left']);
            //             break;
            //         }
            //         case 'right': {
            //             newGPS[1] += 1;
            //             if (newGPS[1] > newWorldMap[0].length - 1) newGPS[1] = 0;
            //             currentDirection = pickOne(['up', 'right', 'down']);
            //             break;
            //         }
            //         case 'down': {
            //             newGPS[0] += 1;
            //             if (newGPS[0] > newWorldMap[0].length - 1) newGPS[0] = 0;
            //             currentDirection = pickOne(['right', 'down', 'left']);
            //             break;
            //         }
            //         case 'left': {
            //             newGPS[1] -= 1;
            //             if (newGPS[1] < 0) newGPS[1] = newWorldMap[0].length - 1;
            //             currentDirection = pickOne(['up', 'down', 'left']);
            //             break;
            //         }
            //         default: {
            //             currentDirection = pickOne(['up', 'right', 'down', 'left']);
            //             break;
            //         };
            //     }
                
            // } while (generator.tiles[biomeType] > 0);

        });

        // aaaaand next up, check latitude rules to convert everything to their proper version?

    });





    /*
    
        so far so good!
        rangeMax isn't in use yet; we may not even need it in most cases after all
        we just 'snake 'til we're spent' and it creates some fun basic land shapes!

        next up, we want to have the ability to continue to iterate over our world until we've exhausted all our generators filled with seeds
        
        let's plant some (T)rees next! 
        ... so, it doesn't make sense to go back over the WHOLE map and look for our lands to randomly plant trees, as that feels exhaustive AND prone to 
            creating very predictable patterns of trees on the first found shores... northward shore-trees only? no thanks!
        
        it makes more sense to create a 'record' of the land as we build it, then iterate through pickOne(array of coords) X times to seed a few forests


        'shore' logic may be a little complicated, but we need beaches, yo! :P
        ... also, we very often get cool 'landlocked oceans' just during gen, so a way to go through and desalinate them and designate them as lakes would be neat
            - and give them a chance to 'search for the nearest ocean' to try to reach out with a river
        ... likewise, having a way to procedurally generate relatively mini-landmasses here and there would be fun
            - a way to go 'oh here's some ocean that's sufficiently not near anything, mark it as such'
        
        streams versus rivers?
        ... rivers should be default 'impassable' and have some directionality, the direction of flow from an origin
            - river origin by default should be a lake of at least two adjacent water squares


        ... and after that, maybe see if we can't translate this into an 'explorable' map :D
        ... that feels ideal, because my simplistic node-display map doesn't give a satisfying 'centered' experience
        ... in such a small map (30 by 30 is TINY), it's hard to make multiple reasonably traversible/livable landmasses by Civ rules
            - that said, having 'landmass gen' specifically attempt to distance the seeds from each other makes sense


        of course, the final step in this is to actually generate tileArea data that's actually usable!

    
    */

    /*

        reminder: freshwater as it currently works just absolutely floods :P
    
        Hm. Do we need to reimagine the return as an object to include metadata, or is it fine to just throw the raw array of arrays around?

        Can we save completed maps on the user's browser? That'd be quite handy, though we'd have to have ways to validate it hasn't changed.

        Also, let us consider LEVEL RULES! What level is everything? How does it spawn? Does only the backend know?

        
    
    */

    return newWorldMap;
}
// ok, can console.table and as long as it's within a certain size we're golden... let's see what we can build!
// createWorldMap();


function rollWithinRange() {
    /*
    
        Given a variable range of possible outcomes, pick from it! Rando and for-loop roll?
        OR! forEach, if the range of possibilities comes in an array or is put into an array
        -- relative weights

        we'll have to make a few assumptions as to the kind of 'return' we want from this function and provide it the necessary pieces to get useful feedback
        ... though that's true of any fxn, innit? :P
    
    */
    //
}