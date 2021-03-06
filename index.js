// .env Variables
require('dotenv').config({path: './.env'});

// Node Modules
let discord = require('discord.js');
let client = new discord.Client();
let { parseAndRoll } = require("roll-parser");

// Bot Modules
let {sendPublicMessage, sendPrivateMessage, generateDialogFunction, isAdmin} = require("./utility.js");

//dialog system
let dialog = generateDialogFunction(require("./dialog.json"));

//variables to be used
let messagesSinceLastJoin = 0;
let alive = true;

let adminRoles = {}; //defined below
let validRoles = {}; //defined below

//ADAM dialog decorator
//NOTE: This isn't strictly necessary for the bots
dialog = function(baseDialog) {
	return function(key, ...data) {
		if (key === "help" && typeof(data[0]) !== "undefined") {
			//force the key and arg into camelCase
			let arg = data[0].toLowerCase();
			arg = arg.charAt(0).toUpperCase() + arg.substr(1);
			key += arg;
		}

		return baseDialog(key, ...data);
	}
}(dialog);

//handle errors
client.on('error', console.error);
client.on('uncaughtException', console.error);

// The ready event is vital, it means that your bot will only start reacting to information from discord _after_ ready is emitted
client.on('ready', async () => {
	// Generates invite link
	try {
		let link = await client.generateInvite(["SEND_MESSAGES", "MANAGE_MESSAGES"]);
		console.log("Invite Link: " + link);
	} catch(e) {
		console.log(e.stack || e);
	}

	// You can set status to 'online', 'invisible', 'away', or 'dnd' (do not disturb)
	client.user.setStatus('online');

	// Sets your "Playing"
	if (process.env.ACTIVITY) {
		client.user.setActivity(process.env.ACTIVITY, { type: process.env.TYPE })
			//DEBUGGING
			.then(presence => console.log("Activity set to " + (presence.game ? presence.game.name : 'none')) )
			.catch(console.error);
	}

	console.log("Logged in as: " + client.user.username + " - " + client.user.id);

	//now that you're logged in, parse the guild
	const jamGuild = client.guilds.find(g => g.name === "Decade Jam");

	if (jamGuild == null) {
		throw "Failed to find jam guild";
	}

	adminRoles = {
		"admin": jamGuild.roles.find(r => r.name === process.env.ADMIN_ROLE),
		"mod": jamGuild.roles.find(r => r.name === process.env.MOD_ROLE),
		"botoperator": jamGuild.roles.find(r => r.name === "Bot Operator"),
	};

	validRoles = {
		"programmer": jamGuild.roles.find(r => r.name === "Programmer"),
		"artist": jamGuild.roles.find(r => r.name === "Artist"),
		"audio": jamGuild.roles.find(r => r.name === "Audio"),
		"writer": jamGuild.roles.find(r => r.name === "Writer"),
		"roleplay": jamGuild.roles.find(r => r.name === "Roleplay"),

		"français": jamGuild.roles.find(r => r.name === "Français"),
		"francais": jamGuild.roles.find(r => r.name === "Français"),
		"español": jamGuild.roles.find(r => r.name === "Español"),
		"espanol": jamGuild.roles.find(r => r.name === "Español"),
		"english": jamGuild.roles.find(r => r.name === "English"),
		"deutsch": jamGuild.roles.find(r => r.name === "Deutsch"),
	};
});

// Create an event listener for messages
client.on('message', async message => {
	// Ignores ALL bot messages
	if (message.author.bot) {
		return;
	}

	// Has to be (prefix)command
	if (message.content.indexOf(process.env.PREFIX) !== 0) {
		try {
			passiveResponses(client, message); //watch passively
		} catch(e) {
			console.log(e.stack || e);
		}
		return;
	}

	try {
		//admin commands
		if (isAdmin(message.member) && processAdminCommands(client, message)) {
			return;
		}

		//basic user commands
		if (processBasicCommands(client, message)) {
			return;
		}
	} catch(e) {
		console.log(e.stack || e);
	}
});

//Log our bot in
client.login(process.env.TOKEN);

//each type of action the bot can take
function passiveResponses(client, message) {
	// "This is the best way to define args. Trust me."
	// - Some tutorial dude on the internet
	let args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	//channel-based
	switch(message.channel.name) {
		case "introductions":
			//urge the members into off-topic
			if (++messagesSinceLastJoin >= 20) {
				messagesSinceLastJoin = 0;
				const channel = message.guild.channels.find(channel => channel.name === "off-topic");
				sendPublicMessage(client, message.guild, message.channel, dialog("introUrging", `<#${channel.id}>`));
			}
			return true;

		case "server-suggestions":
			message.react("👍");
			message.react("👎");
			return true;
	}

	//copied verbatim
	if (message.content.toLowerCase().includes("joe")) {
		sendPublicMessage(client, message.guild, message.channel, "JOE MAMMA");
	}

	if (message.content.toLowerCase().includes("creeper")) {
		sendPublicMessage(client, message.guild, message.channel, "AWWWWWWWWW MAN");
	}
}

function processBasicCommands(client, message) {
	// "This is the best way to define args. Trust me."
	// - Some tutorial dude on the internet
	let args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	switch (command) {
		case "help":
			sendPublicMessage(client, message.guild, message.author, message.channel, dialog(command, args[0]));
			return true;

		case "roll":
			let roll = parseAndRoll(args);

			if (roll === null) {
				sendPublicMessage(client, message.guild, message.author, message.channel, dialog("noroll"));
				return true;
			}

			sendPublicMessage(client, message.guild, message.author, message.channel, dialog(command, roll.value, roll.rolls.toString() ));
			return true;

		case "add":
			if (args[0] && validRoles[args[0]]) {
				addRole(validRoles[args[0]], message);
			}
			return true;

		case "remove":
			if (args[0] && validRoles[args[0]]) {
				removeRole(validRoles[args[0]], message);
			}
			return true;

		case "vote": {
			const rand = randomHexCode();
			sendPrivateMessage(client, message.author, rand);
			sendPublicMessage(client, message.guild, 'token-vault', `${message.author} ${rand}`);
			return true;
		}

		case "welcome":
			if (args[0]) {
				sendPublicMessage(client, message.guild, message.channel, dialog(command, args[0]));
			}
			return true;

		case "kill":
			if (alive) {
				alive = false;
				sendPublicMessage(client, message.guild, message.channel, dialog("kill"));
			}
			return true;

		case "revive":
			if (!alive) {
				alive = true;
				sendPublicMessage(client, message.guild, message.channel, dialog("revive"));
			}
			return;

		case "stats":
			let roleCounter = {};
			let total = 0;

			//count each role instance
			message.guild.members.forEach(member => {
				if (member.user.bot) return; //skip bots
				total++;
				let noRole = true;
				Object.values(validRoles).forEach(role => { if (member.roles.has(role.id)) { roleCounter[role.id] = roleCounter[role.id] + 1 || 1; noRole = false; }});
				Object.values(adminRoles).forEach(role => { if (member.roles.has(role.id)) { roleCounter[role.id] = roleCounter[role.id] + 1 || 1; noRole = false; }});
				if (noRole) roleCounter[null] = roleCounter[null] + 1 || 1;
			});

			sendPublicMessage(client, message.guild, message.channel,
				"**Server Stats:**\n" +
				"\nMembers: "		+ total +
				"\nProgrammers: "	+ (roleCounter[validRoles["programmer"].id] || 0) +
				"\nArtists: "		+ (roleCounter[validRoles["artist"].id] || 0) +
				"\nAudio: "			+ (roleCounter[validRoles["audio"].id] || 0) +
				"\nWriters: "		+ (roleCounter[validRoles["writer"].id] || 0) +
				"\nRoleplayers: "	+ (roleCounter[validRoles["roleplay"].id] || 0) +

				"\nEnglish: "		+ (roleCounter[validRoles["english"].id] || 0) +
				"\nFrench: "		+ (roleCounter[validRoles["français"].id] || 0) +
				"\nSpanish: "		+ (roleCounter[validRoles["español"].id] || 0) +
				"\nGerman: "		+ (roleCounter[validRoles["deutsch"].id] || 0) +

				"\nAdministrators: "+ (roleCounter[adminRoles["admin"].id] || 0) +
				"\nModerators: "	+ (roleCounter[adminRoles["mod"].id] || 0) +
				"\nBot Operators: "	+ (roleCounter[adminRoles["botoperator"].id] || 0) +
				"\nWithout a role: " + (roleCounter[null] || 0)
			);

			return true;

		case "sacrifice":
			if (args[0]) {
				if (Math.floor(Math.random() * 20) == 0) {
					sendPublicMessage(client, message.guild, message.author, message.channel, dialog('badsacrifice'));
				} else {
					sendPublicMessage(client, message.guild, message.author, message.channel, `You have sacrificed ${args[0]}. ${dialog(command)}`);
				}
			}
			return true;

		case "badsacrifice":
			//dummied out
			return true;

		case "summon":
			if (args[0]) {
				sendPublicMessage(client, message.guild, message.channel, args[0]);
				sendPublicMessage(client, message.guild, message.channel, args[0]);
				sendPublicMessage(client, message.guild, message.channel, args[0]);
			}
			return true;

		case "cast":
			if (args[0]) {
				sendPublicMessage(client, message.guild, message.author, message.channel, `You cast ${args.join(" ")}! It was ${dialog('cast')}`);
			}
			return true;

		default: //!anydialog
			sendPublicMessage(client, message.guild, message.author, message.channel, dialog(command));
			return true;
	}

	return false;
}

function processAdminCommands(client, message) {
	// "This is the best way to define args. Trust me."
	// - Some tutorial dude on the internet
	let args = message.content.slice(process.env.PREFIX.length).trim().split(/ +/g);
	let command = args.shift().toLowerCase();

	switch (command) {
		case "ping": //DEBUGGING
			sendPublicMessage(client, message.guild, message.author, message.channel, "PONG!");
			return true;

		case "say":
			sendPublicMessage(client, message.guild, message.channel, args.join(" "));
			message.delete(10);
			return true;

		case "tell":
			sendPublicMessage(client, message.guild, args.shift(), message.channel, args.join(" "));
			message.delete(10);
			return true;

		case "whisper":
			sendPrivateMessage(client, args.shift(), args.join(" "));
			message.delete(10);
			return true;

		case "cleanup":
			if (args[0]) {
				message.channel.fetchMessages({ limit: +args[0] })
					.then( messages => messages.forEach(m => m.delete()) )
				;
			}
			return true;
	}

	return false;
}

//misc. functions
function addRole(role, message) {
	message.member.addRole(role).catch(console.error);
	sendPublicMessage(client, message.guild, message.author, message.channel, dialog("addrole", role.name));
}

function removeRole(role, message) {
	message.member.removeRole(role).catch(console.error);
	sendPublicMessage(client, message.guild, message.author, message.channel, dialog("removerole", role.name));
}

function randomHexCode() {
	return "000000".replace(/0/g, () => (~~(Math.random()*16)).toString(16));
}

client.on('guildMemberAdd', member => {
	messagesSinceLastJoin = 0;
	let channel = member.guild.channels.find(r => r.name === "introductions");
	channel.fetchMessages({ limit: 1 })
		.then(messages => {
			let message = messages.first();
			message.react('👋');
		})
	;
});
