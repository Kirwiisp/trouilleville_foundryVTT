// Import document classes.
import { TrouillevilleActor } from "./documents/actor.mjs";
import { TrouillevilleItem } from "./documents/item.mjs";
// Import sheet classes.
import { TrouillevilleActorSheet } from "./sheets/actor-sheet.mjs";
import { TrouillevilleItemSheet } from "./sheets/item-sheet.mjs";
// Import helper/utility classes and constants.
import { preloadHandlebarsTemplates } from "./helpers/templates.mjs";
import { TROUILLEVILLE } from "./helpers/config.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", async function () {
	// initializing

	console.log(`
#######
   #    #####   ####  #    # # #      #      ###### #    # # #      #      ###### 
   #    #    # #    # #    # # #      #      #      #    # # #      #      #      
   #    #    # #    # #    # # #      #      #####  #    # # #      #      #####  
   #    #####  #    # #    # # #      #      #      #    # # #      #      #      
   #    #   #  #    # #    # # #      #      #       #  #  # #      #      #      
   #    #    #  ####   ####  # ###### ###### ######   ##   # ###### ###### ###### `);

	// Add utility classes to the global game object so that they're more easily
	// accessible in global contexts.
	game.trouilleville = {
		TrouillevilleActor,
		TrouillevilleItem,
		rollItemMacro,
	};

	// Add custom constants for configuration.
	CONFIG.TROUILLEVILLE = TROUILLEVILLE;

	/**
	 * Set an initiative formula for the system
	 * @type {String}
	 */
	CONFIG.Combat.initiative = {
		formula: "1d20 + @abilities.dex.mod",
		decimals: 2,
	};

	// Define custom Document classes
	CONFIG.Actor.documentClass = TrouillevilleActor;
	CONFIG.Item.documentClass = TrouillevilleItem;

	// Register sheet application classes
	Actors.unregisterSheet("core", ActorSheet);
	Actors.registerSheet("trouilleville", TrouillevilleActorSheet, {
		makeDefault: true,
	});
	Items.unregisterSheet("core", ItemSheet);
	Items.registerSheet("trouilleville", TrouillevilleItemSheet, {
		makeDefault: true,
	});

	// Preload Handlebars templates.
	return preloadHandlebarsTemplates();
});

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

// If you need to add Handlebars helpers, here are a few useful examples:
Handlebars.registerHelper("concat", function () {
	var outStr = "";
	for (var arg in arguments) {
		if (typeof arguments[arg] != "object") {
			outStr += arguments[arg];
		}
	}
	return outStr;
});

Handlebars.registerHelper("ifCond", function (a, operator, b, options) {
	let result = false;
	switch (operator) {
		case "==":
			result = a == b;
			break;
		case "===":
			result = a === b;
			break;
		case "!=":
			result = a != b;
			break;
		case "!==":
			result = a !== b;
			break;
		case "<":
			result = +a < +b;
			break;
		case "<=":
			result = +a <= +b;
			break;
		case ">":
			result = +a > +b;
			break;
		case ">=":
			result = +a >= +b;
			break;
		case "&&":
			result = a && b;
			break;
		case "||":
			result = a || b;
			break;
		case "includes":
			result = a && b && a.includes(b);
			break;

		// *** Cats! specific ***
		case "usableBy":
			// CBH usableBy cat
			result = a && b && a.includes(b.slice(0, 1).toUpperCase());
			break;
		default:
			break;
	}
	if (typeof options.fn === "function") {
		return result ? options.fn(this) : options.inverse(this);
	}
	return result;
});

Handlebars.registerHelper("toLowerCase", function (str) {
	return str.toLowerCase();
});

/* -------------------------------------------- */
/*  Ready Hook                                  */
/* -------------------------------------------- */

Hooks.once("ready", async function () {
	// Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
	Hooks.on("hotbarDrop", (bar, data, slot) => createItemMacro(data, slot));
});

/* -------------------------------------------- */
/*  Hotbar Macros                               */
/* -------------------------------------------- */

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {Object} data     The dropped data
 * @param {number} slot     The hotbar slot to use
 * @returns {Promise}
 */
async function createItemMacro(data, slot) {
	// First, determine if this is a valid owned item.
	if (data.type !== "Item") return;
	if (!data.uuid.includes("Actor.") && !data.uuid.includes("Token.")) {
		return ui.notifications.warn(
			"You can only create macro buttons for owned Items"
		);
	}
	// If it is, retrieve it based on the uuid.
	const item = await Item.fromDropData(data);

	// Create the macro command using the uuid.
	const command = `game.trouilleville.rollItemMacro("${data.uuid}");`;
	let macro = game.macros.find(
		(m) => m.name === item.name && m.command === command
	);
	if (!macro) {
		macro = await Macro.create({
			name: item.name,
			type: "script",
			img: item.img,
			command: command,
			flags: { "trouilleville.itemMacro": true },
		});
	}
	game.user.assignHotbarMacro(macro, slot);
	return false;
}

/**
 * Create a Macro from an Item drop.
 * Get an existing item macro if one exists, otherwise create a new one.
 * @param {string} itemUuid
 */
function rollItemMacro(itemUuid) {
	// Reconstruct the drop data so that we can load the item.
	const dropData = {
		type: "Item",
		uuid: itemUuid,
	};
	// Load the item from the uuid.
	Item.fromDropData(dropData).then((item) => {
		// Determine if the item loaded and if it's an owned item.
		if (!item || !item.parent) {
			const itemName = item?.name ?? itemUuid;
			return ui.notifications.warn(
				`Could not find item ${itemName}. You may need to delete and recreate this macro.`
			);
		}

		// Trigger the item roll
		item.roll();
	});
}
